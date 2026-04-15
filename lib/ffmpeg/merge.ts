/**
 * FFmpeg video + audio merge.
 *
 * Downloads a Runway-rendered video and an ElevenLabs voiceover MP3,
 * merges them with FFmpeg, and returns the final MP4 as a Buffer.
 *
 * The caller is responsible for uploading the Buffer and cleaning nothing up —
 * all temp files are created and deleted inside this module.
 *
 * FFmpeg binary is provided by `ffmpeg-static` — no system FFmpeg required.
 *
 * Merge strategy:
 *   • Video stream: copy directly (no re-encode — fast, lossless quality)
 *   • Audio stream: encode to AAC 128 kbps (MP3 → AAC for MP4 container)
 *   • Duration: -shortest clips to the shorter of the two inputs
 *     (Runway video is 5–10s; voiceover may be slightly longer or shorter)
 */

import { spawn } from "child_process";
import { createWriteStream, promises as fs } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { pipeline } from "stream/promises";
import ffmpegPath from "ffmpeg-static";

// ── Types ────────────────────────────────────────────────────────────────────

export interface MergeInput {
  /** Public MP4 URL from Runway CDN. */
  videoUrl: string;
  /** Public MP3 URL from Supabase Storage. */
  audioUrl: string;
}

export interface MergeResult {
  /** Final merged MP4 as a Buffer, ready to upload. */
  buffer: Buffer;
  contentType: "video/mp4";
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Merges a video file with a voiceover audio track.
 *
 * @throws if FFmpeg binary is missing, download fails, or FFmpeg exits non-zero.
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
    // ── 1. Download inputs in parallel ──────────────────────────────────────
    await Promise.all([
      downloadToFile(videoUrl, videoIn),
      downloadToFile(audioUrl, audioIn),
    ]);

    // ── 2. Run FFmpeg ────────────────────────────────────────────────────────
    await runFfmpeg([
      "-y",                      // overwrite output without prompting
      "-i", videoIn,             // input 0: video
      "-i", audioIn,             // input 1: audio
      "-map", "0:v:0",           // take video stream from input 0
      "-map", "1:a:0",           // take audio stream from input 1
      "-c:v", "copy",            // copy video — no re-encode
      "-c:a", "aac",             // encode audio to AAC (required for MP4)
      "-b:a", "128k",
      "-movflags", "+faststart", // move moov atom to front for streaming
      "-shortest",               // clip to shorter input
      output,
    ]);

    // ── 3. Read output into memory ───────────────────────────────────────────
    const buffer = await fs.readFile(output);
    return { buffer, contentType: "video/mp4" };
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

/** Downloads a URL to a local file path using Node streams. */
async function downloadToFile(url: string, dest: string): Promise<void> {
  const response = await fetch(url);

  if (!response.ok || !response.body) {
    throw new Error(
      `[ffmpeg] Failed to download ${url} — HTTP ${response.status}`
    );
  }

  // response.body is a Web ReadableStream; Node's pipeline handles it directly
  // in Node 18+ via the WHATWG stream interop.
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
