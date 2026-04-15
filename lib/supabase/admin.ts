import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Service-role Supabase client.
 *
 * Bypasses RLS — use ONLY in trusted server-side code (Server Actions,
 * Route Handlers, background jobs). NEVER expose to the browser.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in the environment (never NEXT_PUBLIC_).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars."
    );
  }

  return createClient<Database>(url, key, {
    auth: {
      // Service role must never persist sessions
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
