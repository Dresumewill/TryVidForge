import { createClient } from "@/lib/supabase/server";
import { apiSuccess, Errors } from "@/lib/api/response";
import type { VideoStatusData } from "@/lib/api/response";
import { logger } from "@/lib/api/logger";
import type { VideoRow } from "@/lib/supabase/types";

/**
 * GET /api/video/[videoId]/status
 *
 * Returns the current processing status of a video job.
 * Clients poll this endpoint (every 5 s) to track async progress.
 *
 * Response shape: { success: true, data: VideoStatusData }
 *
 * Status lifecycle:
 *   pending    → AI script not yet generated (cron Phase 0 pending)
 *   processing → Script ready; TTS / Runway / FFmpeg in progress
 *   completed  → Video available for download  (DB: "ready")
 *   failed     → Pipeline failed; credit refunded
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const start = Date.now();

  // ── Auth ────────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return Errors.unauthorized();
  }

  const { videoId } = await params;

  // ── Fetch video — ownership enforced by RLS (auth.uid() = user_id) ──────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row, error: fetchError } = await (supabase as any)
    .from("videos")
    .select("id, status, video_url, rendering_job_id")
    .eq("id", videoId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchError) {
    logger.error("video:status:fetch-failed", {
      videoId,
      userId: user.id,
      error: fetchError.message,
    });
    return Errors.internal();
  }

  if (!row) {
    return Errors.notFound("Video");
  }

  const video = row as Pick<VideoRow, "id" | "status" | "video_url" | "rendering_job_id">;

  logger.info("video:status", {
    videoId,
    userId: user.id,
    status: video.status,
    duration_ms: Date.now() - start,
  });

  return apiSuccess(toStatusData(video));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toStatusData(
  video: Pick<VideoRow, "id" | "status" | "video_url" | "rendering_job_id">
): VideoStatusData {
  switch (video.status) {
    case "pending":
      return {
        videoId:    video.id,
        status:     "pending",
        phase:      "Waiting for AI script generation",
        stepIndex:  0,
        active:     true,
        videoUrl:   null,
      };

    case "processing":
      if (video.rendering_job_id) {
        return {
          videoId:    video.id,
          status:     "processing",
          phase:      "Rendering video",
          stepIndex:  2,
          active:     true,
          videoUrl:   null,
        };
      }
      return {
        videoId:    video.id,
        status:     "processing",
        phase:      "Generating audio & submitting render",
        stepIndex:  1,
        active:     true,
        videoUrl:   null,
      };

    case "ready":
      return {
        videoId:    video.id,
        status:     "completed",
        phase:      "Complete",
        stepIndex:  null,
        active:     false,
        videoUrl:   video.video_url,
      };

    case "failed":
      return {
        videoId:    video.id,
        status:     "failed",
        phase:      "Failed — credit refunded",
        stepIndex:  null,
        active:     false,
        videoUrl:   null,
      };
  }
}
