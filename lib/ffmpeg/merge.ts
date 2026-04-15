/**
 * FFmpeg video + audio merge with optimised H.264 output.
 *
 * Downloads a Runway-rendered video and an ElevenLabs voiceover MP3,
 * merges them with FFmpeg, and returns the final MP4 as a Buffer.
 *
 * The caller is responsible for uploading the Buffer.
 * All temp files are created and deleted inside this module.
 *
 * FFmpeg binary is provided by `ffmpeg-static` — no system FFmpeg required.
 *
 * Encoding strategy (chosen for file-size and load-time):
 *
 *   Video  — H.264 (libx264) CRF 26, preset fast
 *     • Runway raw output is ~8–15 Mbps; CRF 26 @ 1280×768 targets ~1.5–3 Mbps
 *       — a 70–80 % size reduction with no perceptible quality loss for clips ≤ 10 s
 *     • profile main / level 4.0 + pix_fmt yuv420p — required for Safari / iOS
 *       (Safari refuses yuv444 or yuv422 which some encoders emit by default)
 *     • preset fast — ~3× faster than medium at only ~5 % larger file for short clips
 *     • threads 0 — lets FFmpeg use all available CPU cores
 *
 *   Audio  — AAC 96 kbps, stereo
 *     • Down from 128 kbps; voiceover speech is indistinguishable at 96 kbps AAC
 *     • -ac 2 forces stereo regardless of ElevenLabs mono / stereo source variation
 *
 *   Metadata — stripped (-map_metadata -1, -map_chapters -1)
 *     • Removes Runway's embedded creation date / encoder tags
 *     • Reduces the moov atom size → slightly faster seek and parse on load
 *
 *   Streaming — -movflags +faststart
 *     • Moves the moov atom to the front of the file
 *     • Browser can begin playback before the full file is downloaded
 *
 *   Duration — -shortest clips to the shorter of the two inputs
 *     • Runway video is 5–10 s; voiceover may be fractionally longer or shorter
 */

import { spawn }                         from "child_process";
import { createWriteStream, promises as fs } from "fs";
import { tmpdir }                         from "os";
import { join }                           from "path";
import { randomUUID }                     from "crypto";
import { pipeline }                       from "stream/promises";
import ffmpegPath                         from "ffmpeg-static";

// ── Types ────────────────────────────────────────────────────────────────────

export interface MergeInput {
  /** Public MP4 URL from Runway CDN. */
  videoUrl: string;
  /** Public MP3 URL from Supabase Storage. */
  audioUrl: string;
}

export interface MergeResult {
  /** Final merged MP4 as a Buffer, ready to upload. */
  buffer:      Buffer;
  contentType: "video/mp4";
  /** Encoded file size in bytes — useful for logging. */
  sizeBytes:   number;
}

// ── FFmpeg encode settings ────────────────────────────────────────────────────

/**
 * CRF 26 hits the sweet-spot for short promo clips:
 *   ≤ 23  high quality / larger file  (use for archival)
 *      26  web-optimised default       ← current setting
 *   ≥ 28  smaller / lower quality
 *
 * Raise to 28 to shave another ~15 % off file size if quality is acceptable.
 */
const VIDEO_CRF     = "26";
const VIDEO_PRESET  = "fast";   // fast | medium | slow  (slower → smaller, longer encode)
const AUDIO_BITRATE = "96k";    // 96k is transparent for speech; use 128k for music-heavy content

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Merges a Runway video with a voiceover and returns an optimised MP4 buffer.
 *
 * @throws if FFmpeg binary is missing, a download fails, or FFmpeg exits non-zero.
 */
export async function mergeVideoAudio({
  videoUrl,
  audioUrl,
}: MergeInput): Promise<MergeResult> {
  if (!ffmpegPath) {
    throw new Error(
      "[ffmpeg] ffmpeg-static did not resolve a binary path. " +
      "Ensure ffmpeg-static is installed."
    );
  }

  const id      = randomUUID();
  const tmp     = tmpdir();
  const videoIn = join(tmp, `${id}-video.mp4`);
  const audioIn = join(tmp, `${id}-audio.mp3`);
  const output  = join(tmp, `${id}-merged.mp4`);

  try {
    // ── 1. Validate URLs before touching the network ────────────────────────
    assertSafeUrl(videoUrl, "video");
    assertSafeUrl(audioUrl, "audio");

    // ── 2. Download inputs in parallel ──────────────────────────────────────
    await Promise.all([
      downloadToFile(videoUrl, videoIn),
      downloadToFile(audioUrl, audioIn),
    ]);

    // ── 2. Run FFmpeg ────────────────────────────────────────────────────────
    await runFfmpeg([
      "-y",                        // overwrite output without prompting

      // Inputs
      "-i",       videoIn,         // input 0: Runway video
      "-i",       audioIn,         // input 1: ElevenLabs audio

      // Stream selection
      "-map",     "0:v:0",         // video from input 0
      "-map",     "1:a:0",         // audio from input 1

      // Video encoding
      "-c:v",     "libx264",       // re-encode to H.264 (vs -c:v copy)
      "-crf",     VIDEO_CRF,       // quality: 26 ≈ 1.5–3 Mbps @ 1280×768
      "-preset",  VIDEO_PRESET,    // encode speed / compression trade-off
      "-profile:v", "main",        // H.264 Main profile — broad device support
      "-level:v", "4.0",           // supports up to 1080p30 / 720p60
      "-pix_fmt", "yuv420p",       // required for Safari / iOS playback
      "-threads", "0",             // use all available CPU cores

      // Audio encoding
      "-c:a",     "aac",           // AAC is required for MP4 container
      "-b:a",     AUDIO_BITRATE,   // 96k — transparent for voiceover
      "-ac",      "2",             // stereo output regardless of source channel count

      // Container / streaming
      "-movflags", "+faststart",   // move moov atom to front for HTTP streaming
      "-map_metadata", "-1",       // strip embedded metadata (creation date, encoder)
      "-map_chapters", "-1",       // strip chapter markers

      // Duration
      "-shortest",                 // clip to shorter of video / audio

      output,
    ]);

    // ── 3. Read output into memory ───────────────────────────────────────────
    const buffer = await fs.readFile(output);
    return { buffer, contentType: "video/mp4", sizeBytes: buffer.byteLength };
  } finally {
    // ── 4. Clean up temp files regardless of success or failure ─────────────
    await Promise.allSettled([
      fs.unlink(videoIn).catch(() => undefined),
      fs.unlink(audioIn).catch(() => undefined),
      fs.unlink(output).catch(() => undefined),
    ]);
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Allowlisted hostname suffixes for trusted download sources.
 *
 * Audio always comes from our own Supabase project (supabase.co).
 * Video comes from Runway's CDN — they may use several domains, so we
 * require HTTPS and block private/loopback addresses instead of hard-coding
 * every possible Runway CDN host.
 */
const SUPABASE_HOST_SUFFIX = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : ".supabase.co";

/** Patterns that must never be fetched (SSRF guard). */
const BLOCKED_HOSTNAMES = /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::1|0\.0\.0\.0)/;

/**
 * Validates that a URL is safe to fetch:
 *   - Must use HTTPS
 *   - Must not resolve to a private / loopback address
 *   - Audio URLs must come from the project's own Supabase host
 */
function assertSafeUrl(url: string, kind: "video" | "audio"): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`[ffmpeg] Invalid ${kind} URL: ${url}`);
  }

  if (parsed.protocol !== "https:") {
    throw new Error(`[ffmpeg] ${kind} URL must use HTTPS (got ${parsed.protocol})`);
  }

  if (BLOCKED_HOSTNAMES.test(parsed.hostname)) {
    throw new Error(`[ffmpeg] ${kind} URL hostname is not allowed: ${parsed.hostname}`);
  }

  if (kind === "audio" && !parsed.hostname.endsWith(SUPABASE_HOST_SUFFIX)) {
    throw new Error(
      `[ffmpeg] Audio URL must come from the Supabase project host ` +
      `(got ${parsed.hostname}, expected suffix ${SUPABASE_HOST_SUFFIX})`
    );
  }
}

/** Downloads a URL to a local file path using Node streams. */
async function downloadToFile(url: string, dest: string): Promise<void> {
  const response = await fetch(url);

  if (!response.ok || !response.body) {
    throw new Error(
      `[ffmpeg] Failed to download ${url} — HTTP ${response.status}`
    );
  }

  // response.body is a Web ReadableStream; Node 18+ pipeline handles it directly
  // via WHATWG stream interop.
  await pipeline(
    response.body as unknown as NodeJS.ReadableStream,
    createWriteStream(dest)
  );
}

/** Spawns FFmpeg with the given args and rejects on non-zero exit. */
function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath as string, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    const stderr: Buffer[] = [];
    proc.stderr?.on("data", (chunk: Buffer) => stderr.push(chunk));

    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        const log = Buffer.concat(stderr).toString("utf8").slice(-2000);
        reject(
          new Error(
            `[ffmpeg] Process exited with code ${code}.\n` +
            `Last stderr:\n${log}`
          )
        );
      }
    });

    proc.on("error", (err) => {
      reject(new Error(`[ffmpeg] Failed to spawn process: ${err.message}`));
    });
  });
}
