import { NextResponse } from "next/server";

// ── Typed response envelopes ─────────────────────────────────────────────────

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// ── Domain-specific response payloads ────────────────────────────────────────

export interface GenerateVideoResponseData {
  videoId: string;
  /** Always "pending" — video is queued for async processing. */
  status: "pending";
  creditsRemaining: number;
  message: string;
}

export type GenerateVideoResponse = ApiResponse<GenerateVideoResponseData>;

/**
 * Returned by GET /api/video/[videoId]/status.
 *
 * `status` maps the internal DB value to a user-facing term:
 *   DB "pending"    → "pending"    (queued, waiting for AI)
 *   DB "processing" → "processing" (script ready, rendering in progress)
 *   DB "ready"      → "completed"  (video available)
 *   DB "failed"     → "failed"     (credit refunded)
 *
 * `phase` is a human-readable label for the current pipeline step.
 */
export interface VideoStatusData {
  videoId: string;
  status: "pending" | "processing" | "completed" | "failed";
  phase: string;
  /**
   * Current pipeline step index (0 = script, 1 = audio/submit, 2 = rendering).
   * null when the job has reached a terminal state (completed or failed).
   */
  stepIndex: 0 | 1 | 2 | null;
  /** True while the video can still transition to a new status. */
  active: boolean;
  videoUrl: string | null;
}

export type VideoStatusResponse = ApiResponse<VideoStatusData>;

// ── Helpers ──────────────────────────────────────────────────────────────────

export function apiSuccess<T>(data: T, status = 200): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json({ success: true, data }, { status });
}

export function apiError(
  code: string,
  message: string,
  status: number
): NextResponse<ApiErrorResponse> {
  return NextResponse.json({ success: false, error: { code, message } }, { status });
}

// ── Common error shortcuts ───────────────────────────────────────────────────

export const Errors = {
  unauthorized: () =>
    apiError("unauthorized", "Authentication required.", 401),

  forbidden: () =>
    apiError("forbidden", "You do not have permission to perform this action.", 403),

  badRequest: (message: string) =>
    apiError("bad_request", message, 400),

  validationError: (message: string) =>
    apiError("validation_error", message, 422),

  notFound: (resource = "Resource") =>
    apiError("not_found", `${resource} not found.`, 404),

  conflict: (message: string) =>
    apiError("conflict", message, 409),

  tooManyRequests: (retryAfterSec = 60) =>
    NextResponse.json(
      { success: false, error: { code: "too_many_requests", message: "Rate limit exceeded. Please slow down." } },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    ) as NextResponse<ApiErrorResponse>,

  internal: (message = "An unexpected error occurred.") =>
    apiError("internal_server_error", message, 500),
} as const;
