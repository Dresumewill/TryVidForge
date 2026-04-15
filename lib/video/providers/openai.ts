import OpenAI from "openai";
import type { VideoAIProvider } from "../types";

/**
 * OpenAI script generation provider.
 *
 * Uses GPT-4o to produce a structured video script from the user's prompt.
 * Video rendering is handled separately by the background job (see
 * /api/cron/process-videos). This provider only generates the script.
 *
 * Required env var: OPENAI_API_KEY
 */

const SYSTEM_PROMPT = `You are an expert video scriptwriter specialising in short-form digital content.

Given a user's video prompt, produce a concise, production-ready script in the following format:

HOOK (0-3s)
<single punchy opening line designed to stop the scroll>

BODY (3-25s)
<3-5 bullet points, each a visual beat with on-screen text or voiceover line>

CTA (25-30s)
<one clear call-to-action>

VISUAL DIRECTION
<2-3 sentences describing aesthetic, pacing, and music tone>

Keep the total script under 200 words. Be concrete and specific — no filler phrases.`;

export function createOpenAIProvider(): VideoAIProvider {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  return {
    async generate({ videoId, prompt }) {
      const completion = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Video ID: ${videoId}\n\nUser prompt: ${prompt}`,
          },
        ],
        max_tokens: 500,
        temperature: 0.7,
      });

      const script = completion.choices[0]?.message?.content ?? "";

      return {
        script,
        // Video rendering is async — handled by the cron job.
        // Return empty string so the pipeline sets status to 'processing'.
        videoUrl: "",
      };
    },
  };
}
