import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /auth/callback
 *
 * Supabase redirects here after email confirmation, password reset, and
 * OAuth sign-in (PKCE flow).  The URL contains a one-time `code` param that
 * must be exchanged for a session before we forward the user onward.
 *
 * The `next` param (set by the caller via `redirectTo`) controls where the
 * user lands after a successful exchange.  Only same-origin relative paths
 * are accepted; anything else falls back to /dashboard.
 */
export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  // Guard against open-redirect via the `next` param.
  const safeNext =
    next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  // Exchange failed or no code present — redirect to login with a notice.
  return NextResponse.redirect(`${origin}/login?error=link_expired`);
}
