import { createClient } from "@/lib/supabase/server";
import { generateVideoSchema } from "@/lib/video/schema";
import { runVideoGenerationPipeline } from "@/lib/video/pipeline";
import { apiSuccess, apiError, Errors } from "@/lib/api/response";
import { logger } from "@/lib/api/logger";

/**
 * POST /api/generate-video
 *
 * Body:    { prompt: string }
 * Returns: { success: true, data: { videoId, status: "pending", creditsRemaining, message } }
 *
 * This endpoint is intentionally fast — it performs only the synchronous
 * credit-check + DB insert and returns a job ID immediately (< 300 ms).
 * All compute-heavy work (AI script, TTS, Runway, FFmpeg) is handled by the
 * background cron job (GET /api/cron/process-videos).
 *
 * Clients should poll GET /api/video/[videoId]/status to track progress.
 */
export async function POST(req: Request) {
  const start = Date.now();
  logger.request(req);

  // ── 1. Authentication ──────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    logger.response(req, 401, Date.now() - start, { reason: "no_session" });
    return Errors.unauthorized();
  }

  // ── 2. Parse request body ──────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Errors.badRequest("Request body must be valid JSON.");
  }

  // ── 3. Validate input ──────────────────────────────────────────────────────
  const parsed = generateVideoSchema.safeParse(body);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input.";
    logger.response(req, 422, Date.now() - start, {
      reason: "validation_error",
      issues: parsed.error.issues,
    });
    return Errors.validationError(message);
  }

  const { prompt } = parsed.data;

  // ── 4. Run pipeline — credit check + DB insert only ────────────────────────
  logger.info("pipeline:start", { userId: user.id, promptLength: prompt.length });

  let result;
  try {
    result = await runVideoGenerationPipeline(supabase, { userId: user.id, prompt });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("pipeline:uncaught", { userId: user.id, error: message });
    return Errors.internal("Video generation failed unexpectedly. Please try again.");
  }

  // ── 5. Map pipeline result to HTTP response ────────────────────────────────
  if (!result.ok) {
    const statusMap: Record<string, number> = {
      insufficient_credits: 402,
      insert_failed:        503,
      deduction_failed:     503,
      unknown:              500,
    };
    const status = statusMap[result.code] ?? 500;
    logger.response(req, status, Date.now() - start, {
      userId: user.id,
      errorCode: result.code,
    });
    return apiError(result.code, result.message, status);
  }

  // ── 6. Respond with job ID ─────────────────────────────────────────────────
  logger.response(req, 201, Date.now() - start, {
    userId:  user.id,
    videoId: result.videoId,
    status:  result.status,
  });

  return apiSuccess(
    {
      videoId:          result.videoId,
      status:           result.status,          // "pending"
      creditsRemaining: result.creditsRemaining,
      message:          "Your video has been queued. Processing starts shortly.",
    },
    201
  );
}

export async function GET() {
  return Errors.badRequest("Use POST /api/generate-video.");
}
