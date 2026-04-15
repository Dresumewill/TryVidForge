"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generateVideoSchema } from "@/lib/video/schema";
import { runVideoGenerationPipeline } from "@/lib/video/pipeline";

export type GenerateVideoState = { error?: string; success?: true };

export async function generateVideo(
  _: GenerateVideoState,
  formData: FormData
): Promise<GenerateVideoState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Validate with the shared Zod schema — same rules as the API route
  const parsed = generateVideoSchema.safeParse({
    prompt: formData.get("prompt"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  // Delegate all business logic to the shared pipeline
  const result = await runVideoGenerationPipeline(supabase, {
    userId: user.id,
    prompt: parsed.data.prompt,
  });

  if (!result.ok) {
    return { error: result.message };
  }

  revalidatePath("/dashboard");
  return { success: true };
}
