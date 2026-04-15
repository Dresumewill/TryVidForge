import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, VideoStatus } from "@/lib/supabase/types";

export type AppSupabaseClient = SupabaseClient<Database>;

// ── Pipeline input / output ──────────────────────────────────────────────────

export interface PipelineInput {
  userId: string;
  prompt: string;
}

export interface PipelineSuccess {
  ok: true;
  videoId: string;
  /** Always "pending" — AI generation and rendering are handled by the cron job. */
  status: VideoStatus;
  creditsRemaining: number;
}

export type PipelineError =
  | { ok: false; code: "insufficient_credits"; message: string }
  | { ok: false; code: "insert_failed";        message: string }
  | { ok: false; code: "deduction_failed";     message: string }
  | { ok: false; code: "unknown";              message: string };

export type PipelineResult = PipelineSuccess | PipelineError;

// ── AI provider interface ────────────────────────────────────────────────────

export interface AIGenerationInput {
  videoId: string;
  prompt: string;
}

export interface AIGenerationOutput {
  script: string;
  videoUrl: string;
}

export interface VideoAIProvider {
  generate(input: AIGenerationInput): Promise<AIGenerationOutput>;
}
