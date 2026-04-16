"use server";

import { createClient } from "@/lib/supabase/server";

export async function sendResetEmail(
  _: unknown,
  formData: FormData
): Promise<{ error?: string; sent?: boolean }> {
  const email = (formData.get("email") as string | null)?.trim() ?? "";

  if (!email) {
    return { error: "Email is required." };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    return { error: "Server configuration error. Please contact support." };
  }

  const supabase = await createClient();

  // redirectTo points at the PKCE callback route, which exchanges the code
  // and then forwards the user to /reset-password to set a new password.
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/auth/callback?next=/reset-password`,
  });

  if (error) {
    return { error: error.message };
  }

  // Always return success — never confirm whether an email address exists.
  return { sent: true };
}
