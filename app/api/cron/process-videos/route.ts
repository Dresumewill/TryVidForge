import { createAdminClient } from "@/lib/supabase/admin";
import { getAIProvider } from "@/lib/video/providers";
import { textToSpeech } from "@/lib/elevenlabs/client";
import { submitTextToVideo, pollTask } from "@/lib/runway/client";
import { mergeVideoAudio } from "@/lib/ffmpeg/merge";
import { logger } from "@/lib/api/logger";
import { NextResponse } from "next/server";

/**
 * GET /api/cron/process-videos
 *
 * Background job — three-phase async pipeline.
 *
 * ── Phase 0 — AI script generation (status = "pending") ─────────────────────
 *   1. Call AI provider: prompt → narration script (100-150 words)
 *   2. Save script + advance status to "processing"
 *   On failure: set status "failed", refund credit
 *
 * ── Phase 1 — TTS + render submit (processing, audio_url IS NULL) ────────────
 *   1. Call ElevenLabs: script → MP3
 *   2. Upload MP3 to Supabase Storage (bucket: "audio")
 *   3. Submit Runway text-to-video task (using original user prompt)
 *   4. Save audio_url + rendering_job_id → stay in "processing"
 *
 * ── Phase 2 — Poll Runway (processing, rendering_job_id IS NOT NULL) ─────────
 *   1. Call Runway GET /tasks/{id}
 *   2. SUCCEEDED → FFmpeg merge → upload MP4 → status "ready"
 *   3. FAILED    → refund credit → status "failed"
 *   4. PENDING / RUNNING → no-op; next cron tick picks it up
 *
 * Scheduled via Vercel Cron (vercel.json) — runs every minute.
 * Protected by CRON_SECRET (Vercel sets the Authorization header automatically).
 */

const CRON_SECRET = process.env.CRON_SECRET;
/** Max videos to process per phase per cron invocation */
const BATCH_SIZE = 5;
/** Skip videos queued less than this long ago — lets DB transactions commit */
const PHASE0_MIN_AGE_MS = 5_000;
const PHASE1_MIN_AGE_MS = 30_000;

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    logger.warn("Cron request rejected — invalid secret");
    return new NextResponse("Unauthorized", { status: 401 });
  }

  logger.info("cron:process-videos:start");
  const start = Date.now();

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  // All three phases run concurrently — they operate on disjoint row sets.
  const [phase0Result, phase1Result, phase2Result] = await Promise.allSettled([
    runPhase0(db),
    runPhase1(admin, db),
    runPhase2(admin, db),
  ]);

  const summary = {
    phase0: phase0Result.status === "fulfilled" ? phase0Result.value : { error: String(phase0Result.reason) },
    phase1: phase1Result.status === "fulfilled" ? phase1Result.value : { error: String(phase1Result.reason) },
    phase2: phase2Result.status === "fulfilled" ? phase2Result.value : { error: String(phase2Result.reason) },
    duration_ms: Date.now() - start,
  };

  logger.info("cron:process-videos:done", summary);
  return NextResponse.json(summary);
}

// ── Phase 0: AI script generation ────────────────────────────────────────────
// Picks up videos in "pending" status (no script yet) and generates a script.

async function runPhase0(
  db: any // eslint-disable-line @typescript-eslint/no-explicit-any
) {
  const cutoff = new Date(Date.now() - PHASE0_MIN_AGE_MS).toISOString();

  const { data, error } = await db
    .from("videos")
    .select("id, user_id, prompt")
    .eq("status", "pending")
    .is("script", null)
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    logger.error("cron:phase0:fetch-failed", { error: error.message });
    return { fetched: 0, succeeded: 0, failed: 0 };
  }

  const batch = (data ?? []) as Array<{
    id: string;
    user_id: string;
    prompt: string;
  }>;

  logger.info("cron:phase0:batch", { count: batch.length });

  const results = await Promise.allSettled(
    batch.map((video) => phase0Video(db, video))
  );

  return {
    fetched:   batch.length,
    succeeded: results.filter((r) => r.status === "fulfilled").length,
    failed:    results.filter((r) => r.status === "rejected").length,
  };
}

async function phase0Video(
  db: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  video: { id: string; user_id: string; prompt: string }
) {
  logger.info("cron:phase0:start", { videoId: video.id });

  try {
    const ai = getAIProvider();
    const { script } = await ai.generate({ videoId: video.id, prompt: video.prompt });

    if (!script) {
      throw new Error("AI provider returned an empty script");
    }

    const { error: updateError } = await db
      .from("videos")
      .update({ script, status: "processing" })
      .eq("id", video.id);

    if (updateError) {
      throw new Error(`DB update failed: ${updateError.message}`);
    }

    logger.info("cron:phase0:done", { videoId: video.id, scriptLength: script.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("cron:phase0:failed", { videoId: video.id, error: message });

    await db.from("videos").update({ status: "failed" }).eq("id", video.id);

    await db.rpc("refund_credit", {
      p_user_id:  video.user_id,
      p_video_id: video.id,
      p_reason:   "ai_error_refund",
    });

    throw err;
  }
}

// ── Phase 1: TTS → audio upload → Runway submit ───────────────────────────────

async function runPhase1(
  admin: ReturnType<typeof createAdminClient>,
  db: any // eslint-disable-line @typescript-eslint/no-explicit-any
) {
  const cutoff = new Date(Date.now() - PHASE1_MIN_AGE_MS).toISOString();

  const { data, error } = await db
    .from("videos")
    .select("id, user_id, prompt, script")
    .eq("status", "processing")
    .not("script", "is", null)
    .is("audio_url", null)
    .is("rendering_job_id", null)
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    logger.error("cron:phase1:fetch-failed", { error: error.message });
    return { fetched: 0, succeeded: 0, failed: 0 };
  }

  const batch = (data ?? []) as Array<{
    id: string;
    user_id: string;
    prompt: string;
    script: string;
  }>;

  logger.info("cron:phase1:batch", { count: batch.length });

  const results = await Promise.allSettled(
    batch.map((video) => phase1Video(admin, db, video))
  );

  return {
    fetched:   batch.length,
    succeeded: results.filter((r) => r.status === "fulfilled").length,
    failed:    results.filter((r) => r.status === "rejected").length,
  };
}

async function phase1Video(
  admin: ReturnType<typeof createAdminClient>,
  db: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  video: { id: string; user_id: string; prompt: string; script: string }
) {
  logger.info("cron:phase1:start", { videoId: video.id });

  try {
    // ── 1. ElevenLabs TTS ─────────────────────────────────────────────────
    const { audio, contentType } = await textToSpeech({ text: video.script });
    logger.info("cron:tts:done", { videoId: video.id, bytes: audio.byteLength });

    // ── 2. Upload MP3 to Supabase Storage ─────────────────────────────────
    const storagePath = `${video.id}.mp3`;

    const { error: uploadError } = await admin.storage
      .from("audio")
      .upload(storagePath, audio, {
        contentType,
        upsert: true,
        cacheControl: "3600",
      });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    const { data: urlData } = admin.storage
      .from("audio")
      .getPublicUrl(storagePath);

    const audioUrl: string = urlData.publicUrl;
    logger.info("cron:audio:uploaded", { videoId: video.id, audioUrl });

    // ── 3. Submit Runway text-to-video ────────────────────────────────────
    const { taskId } = await submitTextToVideo(video.prompt);
    logger.info("cron:runway:submitted", { videoId: video.id, taskId });

    // ── 4. Save audio_url + rendering_job_id — stay in "processing" ───────
    const { error: updateError } = await db
      .from("videos")
      .update({ audio_url: audioUrl, rendering_job_id: taskId })
      .eq("id", video.id);

    if (updateError) {
      throw new Error(`DB update failed: ${updateError.message}`);
    }

    logger.info("cron:phase1:done", { videoId: video.id, taskId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("cron:phase1:failed", { videoId: video.id, error: message });

    await db.from("videos").update({ status: "failed" }).eq("id", video.id);

    await db.rpc("refund_credit", {
      p_user_id:  video.user_id,
      p_video_id: video.id,
      p_reason:   "phase1_error_refund",
    });

    throw err;
  }
}

// ── Phase 2: Poll Runway tasks ────────────────────────────────────────────────

async function runPhase2(
  admin: ReturnType<typeof createAdminClient>,
  db: any // eslint-disable-line @typescript-eslint/no-explicit-any
) {
  const { data, error } = await db
    .from("videos")
    .select("id, user_id, audio_url, rendering_job_id")
    .eq("status", "processing")
    .not("rendering_job_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    logger.error("cron:phase2:fetch-failed", { error: error.message });
    return { fetched: 0, succeeded: 0, failed: 0, pending: 0 };
  }

  const batch = (data ?? []) as Array<{
    id: string;
    user_id: string;
    audio_url: string | null;
    rendering_job_id: string;
  }>;

  logger.info("cron:phase2:batch", { count: batch.length });

  const results = await Promise.allSettled(
    batch.map((video) => phase2Video(admin, db, video))
  );

  const counts = { fetched: batch.length, succeeded: 0, failed: 0, pending: 0 };
  for (const r of results) {
    if (r.status === "fulfilled") {
      counts[r.value]++;
    } else {
      counts.failed++;
    }
  }
  return counts;
}

async function phase2Video(
  admin: ReturnType<typeof createAdminClient>,
  db: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  video: { id: string; user_id: string; audio_url: string | null; rendering_job_id: string }
): Promise<"succeeded" | "failed" | "pending"> {
  logger.info("cron:phase2:poll", {
    videoId: video.id,
    taskId: video.rendering_job_id,
  });

  const task = await pollTask(video.rendering_job_id);

  logger.info("cron:runway:polled", {
    videoId: video.id,
    taskId: video.rendering_job_id,
    status: task.status,
    progress: task.progress,
  });

  if (task.status === "SUCCEEDED") {
    if (!task.videoUrl) {
      throw new Error(
        `Runway task ${video.rendering_job_id} SUCCEEDED but returned no output URL`
      );
    }

    let finalVideoUrl: string;

    if (video.audio_url) {
      logger.info("cron:ffmpeg:start", { videoId: video.id });

      const { buffer, contentType, sizeBytes } = await mergeVideoAudio({
        videoUrl: task.videoUrl,
        audioUrl: video.audio_url,
      });

      logger.info("cron:ffmpeg:done", {
        videoId: video.id,
        sizeKb: Math.round(sizeBytes / 1024),
      });

      const storagePath = `${video.id}.mp4`;

      const { error: uploadError } = await admin.storage
        .from("videos")
        .upload(storagePath, buffer, {
          contentType,
          upsert: true,
          cacheControl: "3600",
        });

      if (uploadError) {
        throw new Error(`Merged video upload failed: ${uploadError.message}`);
      }

      const { data: urlData } = admin.storage
        .from("videos")
        .getPublicUrl(storagePath);

      finalVideoUrl = urlData.publicUrl;
      logger.info("cron:videos:uploaded", { videoId: video.id, finalVideoUrl });
    } else {
      finalVideoUrl = task.videoUrl;
      logger.warn("cron:phase2:no-audio", {
        videoId: video.id,
        note: "Saving raw Runway URL — audio_url was null",
      });
    }

    await db
      .from("videos")
      .update({ video_url: finalVideoUrl, status: "ready" })
      .eq("id", video.id);

    logger.info("cron:phase2:ready", { videoId: video.id });
    return "succeeded";
  }

  if (task.status === "FAILED" || task.status === "CANCELLED") {
    logger.error("cron:runway:failed", {
      videoId: video.id,
      taskId: video.rendering_job_id,
      failure: task.failure,
    });

    await db.from("videos").update({ status: "failed" }).eq("id", video.id);

    await db.rpc("refund_credit", {
      p_user_id:  video.user_id,
      p_video_id: video.id,
      p_reason:   "rendering_failed_refund",
    });

    return "failed";
  }

  // PENDING or RUNNING — next cron tick polls again
  return "pending";
}
