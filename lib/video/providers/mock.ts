import type { VideoAIProvider } from "../types";

/**
 * Mock AI provider — used in tests and when no real provider is configured.
 * Returns a deterministic script and an empty videoUrl so the video stays
 * in 'processing' state (picked up by the background job).
 */
export const mockProvider: VideoAIProvider = {
  async generate({ videoId, prompt }) {
    return {
      script: [
        `[MOCK SCRIPT — ${videoId}]`,
        "",
        `Prompt: ${prompt}`,
        "",
        "HOOK: Open on a compelling scene that immediately grabs attention.",
        "",
        "BODY:",
        "  • Introduce the key concept in the first 5 seconds",
        "  • Build with 2-3 supporting visual beats",
        "  • Use dynamic pacing to maintain viewer engagement",
        "",
        "CTA: End with a clear, direct call to action.",
        "",
        "Visual notes: Clean, modern aesthetic. Upbeat background music.",
        "",
        "— Replace this provider with OpenAI by setting OPENAI_API_KEY —",
      ].join("\n"),
      // Empty URL — signals that rendering hasn't happened yet.
      // The background job will fill this in.
      videoUrl: "",
    };
  },
};
