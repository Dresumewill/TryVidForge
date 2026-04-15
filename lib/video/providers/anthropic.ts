import Anthropic from "@anthropic-ai/sdk";
import type { VideoAIProvider } from "../types";

/**
 * Anthropic Claude script generation provider.
 *
 * Uses claude-3-5-haiku — fast, cost-efficient, and excellent at structured
 * creative output with strict word count adherence.
 *
 * Required env var: ANTHROPIC_API_KEY
 */

const SYSTEM_PROMPT = `You are an expert short-form video scriptwriter.

Given a user's video idea, write a production-ready script that is EXACTLY 100–150 words.

Use this structure:

HOOK
One punchy opening sentence (≤10 words) designed to stop the scroll.

BODY
Three to four short, visual beats — each a single sentence describing what appears on screen or is said in voiceover.

CTA
One clear call-to-action sentence.

VISUAL DIRECTION
One sentence describing the visual style, pacing, and music tone.

Rules:
- Total word count must be between 100 and 150 words (count every word including headers).
- Be specific and concrete — no filler, no vague language.
- Write for a 30-second video.
- Output only the script. No preamble, no commentary, no word count at the end.`;

export function createAnthropicProvider(): VideoAIProvider {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  return {
    async generate({ prompt }) {
      const message = await client.messages.create({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 400,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        system: SYSTEM_PROMPT,
      });

      const block = message.content[0];
      const script = block.type === "text" ? block.text.trim() : "";

      return {
        script,
        videoUrl: "",
      };
    },
  };
}
