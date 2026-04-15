/**
 * ElevenLabs text-to-speech client.
 *
 * Uses the REST API directly — no SDK dependency.
 *
 * Required env var : ELEVENLABS_API_KEY
 * Optional env var : ELEVENLABS_VOICE_ID  (defaults to "Rachel")
 *
 * Docs: https://elevenlabs.io/docs/api-reference/text-to-speech
 */

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1";

/** Rachel — clear, professional, neutral accent. Change via env var. */
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

export interface TTSOptions {
  /** The script text to convert. Keep under ~2 500 characters for turbo model. */
  text: string;
}

export interface TTSResult {
  /** Raw MP3 audio bytes. */
  audio: ArrayBuffer;
  /** MIME type — always "audio/mpeg" for mp3 output. */
  contentType: "audio/mpeg";
}

/**
 * Converts `text` to speech via ElevenLabs and returns the raw MP3 bytes.
 *
 * Throws if:
 *  - ELEVENLABS_API_KEY is not set
 *  - The API returns a non-2xx status
 */
export async function textToSpeech({ text }: TTSOptions): Promise<TTSResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "[elevenlabs] ELEVENLABS_API_KEY is not set. Add it to .env.local."
    );
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID ?? DEFAULT_VOICE_ID;

  const response = await fetch(
    `${ELEVENLABS_BASE}/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2_5",
        output_format: "mp3_44100_128",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true,
        },
      }),
    }
  );

  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json();
      detail = JSON.stringify(body);
    } catch {
      detail = await response.text();
    }
    throw new Error(
      `[elevenlabs] TTS request failed — HTTP ${response.status}: ${detail}`
    );
  }

  const audio = await response.arrayBuffer();
  return { audio, contentType: "audio/mpeg" };
}
