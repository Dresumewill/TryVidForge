import { mockProvider } from "./mock";
import { createOpenAIProvider } from "./openai";
import { createAnthropicProvider } from "./anthropic";
import type { VideoAIProvider } from "../types";

/**
 * Returns the AI provider based on available environment variables.
 *
 * Priority:
 *   1. ANTHROPIC_API_KEY → Claude 3.5 Haiku (preferred)
 *   2. OPENAI_API_KEY    → GPT-4o (fallback)
 *   3. Neither           → mock (local dev without API keys)
 */
export function getAIProvider(): VideoAIProvider {
  if (process.env.ANTHROPIC_API_KEY) {
    return createAnthropicProvider();
  }

  if (process.env.OPENAI_API_KEY) {
    return createOpenAIProvider();
  }

  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[ai-provider] No ANTHROPIC_API_KEY or OPENAI_API_KEY set in production — falling back to mock provider."
    );
  }

  return mockProvider;
}
