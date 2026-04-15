import { createAdminClient } from "@/lib/supabase/admin";

export type AnalyticsEventName =
  | "user.signup"
  | "video.queued"
  | "video.completed"
  | "video.failed";

/**
 * Fire-and-forget analytics event — never throws, never blocks the caller.
 *
 * Written by the service role only.  No row is ever readable by normal users
 * (analytics_events has RLS enabled with zero user-level policies).
 */
export async function track(
  event: AnalyticsEventName,
  options: {
    userId?: string;
    properties?: Record<string, unknown>;
  } = {}
): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("analytics_events").insert({
      event,
      user_id:    options.userId ?? null,
      properties: options.properties ?? {},
    });
  } catch {
    // Analytics must never break the main request flow.
  }
}
