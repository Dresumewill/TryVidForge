import type {
  AppSupabaseClient,
  PipelineInput,
  PipelineResult,
} from "./types";
import { logger } from "@/lib/api/logger";
import type { CreditsRow, DeductCreditResult } from "@/lib/supabase/types";

/**
 * Runs the credit-enforcement pipeline and creates a video job.
 *
 * This function is intentionally thin — it only handles the synchronous,
 * user-facing steps that must complete before we can return a job ID.
 * All compute-heavy steps (AI script generation, TTS, Runway, FFmpeg)
 * are handled asynchronously by the cron job (process-videos).
 *
 * Credit enforcement ordering — intentional and non-negotiable:
 *
 *   Step 1  Pre-flight read   — fast early exit before any write. Non-atomic;
 *                               the real enforcement is in Step 3.
 *   Step 2  Insert video row  — create the record before touching credits so
 *                               we always have a video_id for the audit log.
 *   Step 3  Atomic deduction  — deduct_credit() uses SELECT FOR UPDATE to lock
 *                               the credits row for the entire transaction.
 *                               Two concurrent requests with balance=1 can only
 *                               both pass Step 1; the second is rejected here.
 *                               On failure: delete the video row and return.
 *
 * After Step 3 the video row sits in "pending" status. The cron job picks it up
 * and advances it through: pending → processing → ready (or failed + refund).
 */
export async function runVideoGenerationPipeline(
  supabase: AppSupabaseClient,
  input: PipelineInput
): Promise<PipelineResult> {
  try {
    return await _runPipeline(supabase, input);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("pipeline:unexpected", { error: message });
    return {
      ok: false,
      code: "unknown",
      message: "An unexpected error occurred. Please try again.",
    };
  }
}

async function _runPipeline(
  supabase: AppSupabaseClient,
  input: PipelineInput
): Promise<PipelineResult> {
  const { userId, prompt } = input;

  // Cast — @supabase/ssr's createServerClient doesn't propagate the Database
  // generic into .insert()/.update()/.rpc() args; all resolve to `never`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // ── 1. Pre-flight balance check ──────────────────────────────────────────
  // Non-locking fast read. Catches the zero-credit case before creating any
  // DB rows. The authoritative check is the SELECT FOR UPDATE in Step 3.
  const { data: creditsRaw } = await supabase
    .from("credits")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const credits = creditsRaw as CreditsRow | null;

  if (!credits || credits.balance < 1) {
    logger.warn("pipeline:insufficient_credits:preflight", { userId });
    return {
      ok: false,
      code: "insufficient_credits",
      message: "You're out of credits. Top up your balance to keep creating.",
    };
  }

  // ── 2. Insert video row ──────────────────────────────────────────────────
  // Must exist before deduction so the audit log has a valid video_id FK.
  const { data: videoRow, error: insertError } = await db
    .from("videos")
    .insert({ user_id: userId, prompt, status: "pending" })
    .select("id")
    .single();

  if (insertError || !videoRow?.id) {
    logger.error("pipeline:insert_failed", {
      userId,
      error: insertError?.message,
    });
    return {
      ok: false,
      code: "insert_failed",
      message: "Failed to queue your video. Please try again.",
    };
  }

  const videoId: string = videoRow.id;

  // ── 3. Atomic credit deduction ───────────────────────────────────────────
  // deduct_credit() holds a row-level lock for the entire transaction.
  // It also verifies auth.uid() === p_user_id, preventing cross-user calls.
  const { data: rpcRaw, error: rpcError } = await db.rpc("deduct_credit", {
    p_user_id:  userId,
    p_video_id: videoId,
    p_reason:   "video_generation",
  });

  const rpcResult = rpcRaw as DeductCreditResult | null;

  if (rpcError || !rpcResult?.ok) {
    logger.error("pipeline:deduct_failed", {
      userId,
      videoId,
      rpcError: rpcError?.message,
      rpcResult,
    });

    // Best-effort cleanup — delete the video row so it doesn't linger.
    const { error: deleteError } = await db
      .from("videos")
      .delete()
      .eq("id", videoId);

    if (deleteError) {
      logger.warn("pipeline:cleanup_delete_failed", {
        videoId,
        error: deleteError.message,
      });
    }

    if (rpcResult?.error === "insufficient_credits") {
      logger.warn("pipeline:insufficient_credits:atomic", { userId });
      return {
        ok: false,
        code: "insufficient_credits",
        message: "You're out of credits. Top up your balance to keep creating.",
      };
    }

    if (rpcResult?.error === "unauthorized") {
      logger.error("pipeline:deduct_unauthorized", { userId });
    }

    return {
      ok: false,
      code: "deduction_failed",
      message: "Failed to deduct credit. Your video was not queued.",
    };
  }

  // Credit held. Video is now in "pending" status.
  // The cron job will advance it: pending → processing → ready.
  const creditsRemaining = rpcResult.balance ?? credits.balance - 1;

  logger.info("pipeline:queued", { userId, videoId, creditsRemaining });

  return {
    ok: true,
    videoId,
    status: "pending",
    creditsRemaining,
  };
}
