import { createClient } from "@/lib/supabase/server";
import { Errors } from "@/lib/api/response";

/**
 * GET /api/download/[videoId]
 *
 * Authenticated download proxy.
 *
 * Why a proxy instead of a direct <a href download>?
 * The `download` attribute on an anchor tag is ignored by browsers for
 * cross-origin URLs (Supabase Storage CDN). This route fetches the file
 * server-side and re-streams it with `Content-Disposition: attachment` so
 * the browser always saves it to disk rather than opening it.
 *
 * Auth:  Supabase session cookie. Users can only download their own videos.
 * Error: 401 if unauthenticated, 403 if video belongs to another user,
 *        404 if video not found or has no video_url, 502 if CDN fetch fails.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  // ── 1. Auth ──────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return Errors.unauthorized();
  }

  // ── 2. Resolve params (Next.js 15: params is a Promise) ──────────────────
  const { videoId } = await params;

  // ── 3. Fetch video row ───────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: video, error: dbError } = await db
    .from("videos")
    .select("id, user_id, video_url, prompt")
    .eq("id", videoId)
    .maybeSingle() as {
      data: { id: string; user_id: string; video_url: string | null; prompt: string } | null;
      error: unknown;
    };

  if (dbError || !video) {
    return Errors.notFound("Video");
  }

  if (video.user_id !== user.id) {
    return Errors.forbidden();
  }

  if (!video.video_url) {
    return Errors.notFound("Video file");
  }

  // ── 4. Fetch from CDN ────────────────────────────────────────────────────
  let upstream: Response;
  try {
    upstream = await fetch(video.video_url);
  } catch {
    return Errors.internal("Could not reach video storage.");
  }

  if (!upstream.ok || !upstream.body) {
    return Errors.internal(`Storage returned HTTP ${upstream.status}.`);
  }

  // ── 5. Derive a clean filename from the prompt ───────────────────────────
  const slug = video.prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const filename = `${slug || "video"}-${video.id.slice(0, 8)}.mp4`;

  // ── 6. Stream back with download headers ────────────────────────────────
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="${filename}"`,
      // Forward length if known so the browser shows a progress bar
      ...(upstream.headers.get("content-length")
        ? { "Content-Length": upstream.headers.get("content-length")! }
        : {}),
    },
  });
}
