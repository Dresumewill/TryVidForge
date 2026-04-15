"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function login(_: unknown, formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const next = (formData.get("next") as string | null) ?? "/dashboard";

  // Basic server-side validation
  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Return error as state instead of encoding in URL — cleaner and avoids
    // sensitive info like "Invalid login credentials" appearing in history.
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  // Only allow relative redirects to prevent open-redirect attacks.
  const safeNext = next.startsWith("/") ? next : "/dashboard";
  redirect(safeNext);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
