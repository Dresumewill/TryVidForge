/**
 * Runway ML text-to-video client.
 *
 * Uses the REST API directly — no SDK dependency.
 * Runway tasks are async: submit returns a task ID, then poll until complete.
 *
 * Required env var : RUNWAY_API_KEY
 * Optional env vars:
 *   RUNWAY_MODEL    — defaults to "gen4_turbo"
 *   RUNWAY_DURATION — "5" or "10" (seconds), defaults to "5"
 *   RUNWAY_RATIO    — e.g. "1280:768" (16:9) or "768:1280" (9:16), defaults to "1280:768"
 *
 * Docs: https://docs.dev.runwayml.com
 */

const RUNWAY_BASE = "https://api.dev.runwayml.com/v1";
const RUNWAY_VERSION = "2024-11-06";

// ── Types ────────────────────────────────────────────────────────────────────

export type RunwayTaskStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";

export interface RunwaySubmitResult {
  /** Task ID returned by Runway — store in `rendering_job_id`. */
  taskId: string;
}

export interface RunwayTaskResult {
  status: RunwayTaskStatus;
  /** Public CDN URL for the rendered MP4. Only set when status is SUCCEEDED. */
  videoUrl: string | null;
  /** Human-readable failure reason. Only set when status is FAILED. */
  failure: string | null;
  /** 0–1 progress float. Only populated while RUNNING. */
  progress: number | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getApiKey(): string {
  const key = process.env.RUNWAY_API_KEY;
  if (!key) {
    throw new Error(
      "[runway] RUNWAY_API_KEY is not set. Add it to .env.local."
    );
  }
  return key;
}

function runwayHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "X-Runway-Version": RUNWAY_VERSION,
    "Content-Type": "application/json",
  };
}

// ── API calls ────────────────────────────────────────────────────────────────

/**
 * Submits a text-to-video task to Runway and returns the task ID.
 *
 * Does NOT wait for completion — call `pollTask()` on subsequent cron ticks.
 *
 * @param prompt  Visual description of the video (user's original prompt, not the narration script).
 */
export async function submitTextToVideo(prompt: string): Promise<RunwaySubmitResult> {
  const apiKey = getApiKey();

  const model    = process.env.RUNWAY_MODEL    ?? "gen4_turbo";
  const duration = Number(process.env.RUNWAY_DURATION ?? "5") as 5 | 10;
  const ratio    = process.env.RUNWAY_RATIO    ?? "1280:768";

  const response = await fetch(`${RUNWAY_BASE}/text_to_video`, {
    method: "POST",
    headers: runwayHeaders(apiKey),
    body: JSON.stringify({
      model,
      promptText: prompt,
      duration,
      ratio,
    }),
  });

  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json();
      detail = JSON.stringify(body);
    } catch {
      detail = await response.text();
    }
    throw new Error(
      `[runway] Submit failed — HTTP ${response.status}: ${detail}`
    );
  }

  const json = await response.json() as { id: string };
  return { taskId: json.id };
}

/**
 * Polls the status of a previously submitted Runway task.
 *
 * Returns the current status + video URL (when succeeded) without blocking.
 * The caller decides whether to retry on the next cron tick.
 */
export async function pollTask(taskId: string): Promise<RunwayTaskResult> {
  const apiKey = getApiKey();

  const response = await fetch(`${RUNWAY_BASE}/tasks/${taskId}`, {
    method: "GET",
    headers: runwayHeaders(apiKey),
  });

  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json();
      detail = JSON.stringify(body);
    } catch {
      detail = await response.text();
    }
    throw new Error(
      `[runway] Poll failed — HTTP ${response.status}: ${detail}`
    );
  }

  const json = await response.json() as {
    id: string;
    status: RunwayTaskStatus;
    output?: string[];
    failure?: string;
    progressRatio?: number;
  };

  return {
    status:   json.status,
    videoUrl: json.output?.[0] ?? null,
    failure:  json.failure ?? null,
    progress: json.progressRatio ?? null,
  };
}
