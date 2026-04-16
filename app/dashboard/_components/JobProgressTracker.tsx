"use client";

import { useEffect, useRef, useState } from "react";
import type { VideoStatusData } from "@/lib/api/response";

// ── Constants ─────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS  = 3_000;
const AUTO_DISMISS_MS   = 7_000;
/** Stop polling after this many consecutive errors to avoid hammering the server. */
const MAX_ERRORS        = 10;

// ── Types ─────────────────────────────────────────────────────────────────────

interface TrackerState {
  data:  VideoStatusData | null;
  error: string | null;
  done:  boolean;           // terminal status reached
}

// ── Step definitions ──────────────────────────────────────────────────────────

const STEPS = ["Script", "Audio", "Video"] as const;

// ── Step indicator ─────────────────────────────────────────────────────────────

function StepIndicator({
  stepIndex,
  done,
}: {
  stepIndex: 0 | 1 | 2 | null;
  done: boolean;
}) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((label, i) => {
        const isCompleted = done
          ? true
          : stepIndex !== null && i < stepIndex;
        const isCurrent = !done && stepIndex === i;
        const isFuture  = !done && (stepIndex === null || i > stepIndex);

        return (
          <div key={label} className="flex items-center">
            {/* Connector line — before first step hidden */}
            {i > 0 && (
              <div
                className={`h-px w-8 transition-colors duration-500 sm:w-12 ${
                  isCompleted ? "bg-blue-400" : "bg-gray-200"
                }`}
              />
            )}

            <div className="flex flex-col items-center gap-1">
              {/* Circle */}
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                  isCompleted
                    ? "border-blue-500 bg-blue-500"
                    : isCurrent
                    ? "border-blue-400 bg-white"
                    : "border-gray-200 bg-gray-50"
                }`}
              >
                {isCompleted ? (
                  // Checkmark
                  <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : isCurrent ? (
                  // Spinner
                  <svg className="h-3.5 w-3.5 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                ) : (
                  // Number
                  <span className={`text-xs font-medium ${isFuture ? "text-gray-300" : "text-blue-400"}`}>
                    {i + 1}
                  </span>
                )}
              </div>

              {/* Label */}
              <span
                className={`text-xs font-medium ${
                  isCompleted
                    ? "text-blue-600"
                    : isCurrent
                    ? "text-blue-700"
                    : "text-gray-400"
                }`}
              >
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function IndeterminateBar({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="relative h-1 w-full overflow-hidden rounded-full bg-gray-100">
      <div className="absolute inset-y-0 animate-[slide_1.8s_ease-in-out_infinite] rounded-full bg-blue-400 w-1/3" />
    </div>
  );
}

// ── Elapsed timer ─────────────────────────────────────────────────────────────

function useElapsed(running: boolean) {
  const [elapsed, setElapsed] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) {
      if (ref.current) clearInterval(ref.current);
      return;
    }
    ref.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [running]);

  return elapsed;
}

function formatElapsed(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

// ── Main component ─────────────────────────────────────────────────────────────

interface JobProgressTrackerProps {
  videoId: string;
  /** Called after terminal status + auto-dismiss delay. */
  onDone: (status: "completed" | "failed") => void;
}

export function JobProgressTracker({ videoId, onDone }: JobProgressTrackerProps) {
  const [tracker, setTracker] = useState<TrackerState>({
    data:  null,
    error: null,
    done:  false,
  });

  const elapsed = useElapsed(!tracker.done);
  const doneRef = useRef(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Polling ───────────────────────────────────────────────────────────────
  useEffect(() => {
    let stopped = false;
    doneRef.current = false;

    // Tracks ticks to skip (used for 429 Retry-After back-off).
    let skipTicks = 0;
    // Tracks consecutive failures; polling halts at MAX_ERRORS.
    let errorCount = 0;

    async function poll() {
      if (doneRef.current || stopped) return;

      // Honour Retry-After back-off from a previous 429 response.
      if (skipTicks > 0) {
        skipTicks--;
        return;
      }

      try {
        const res  = await fetch(`/api/video/${videoId}/status`);

        if (stopped) return;

        // Rate-limited — back off for however long the server asks.
        if (res.status === 429) {
          const retryAfter = Number(res.headers.get("Retry-After") ?? "10");
          skipTicks = Math.ceil((retryAfter * 1000) / POLL_INTERVAL_MS);
          setTracker((prev) => ({ ...prev, error: "Rate limited — retrying shortly…" }));
          return;
        }

        const json = await res.json();

        if (!res.ok || !json.success) {
          errorCount++;
          if (errorCount >= MAX_ERRORS) {
            doneRef.current = true;
            setTracker((prev) => ({
              ...prev,
              done: true,
              error: "Could not reach the server. Please refresh the page.",
            }));
          } else {
            setTracker((prev) => ({ ...prev, error: "Could not fetch status — retrying…" }));
          }
          return;
        }

        // Successful response — reset the error counter.
        errorCount = 0;

        const data: VideoStatusData = json.data;
        const isDone = data.status === "completed" || data.status === "failed";

        if (isDone) doneRef.current = true;
        setTracker((prev) => ({ ...prev, data, done: isDone, error: null }));

        if (isDone) {
          dismissTimer.current = setTimeout(
            () => onDone(data.status as "completed" | "failed"),
            AUTO_DISMISS_MS
          );
        }
      } catch {
        if (!stopped) {
          errorCount++;
          if (errorCount >= MAX_ERRORS) {
            doneRef.current = true;
            setTracker((prev) => ({
              ...prev,
              done: true,
              error: "Connection lost. Please refresh the page.",
            }));
          } else {
            setTracker((prev) => ({ ...prev, error: "Network error — retrying…" }));
          }
        }
      }
    }

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      stopped = true;
      clearInterval(id);
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  const { data, error, done } = tracker;
  const stepIndex  = data?.stepIndex  ?? 0;
  const phase      = data?.phase      ?? "Initialising…";
  const isActive   = data?.active     ?? true;
  const isFailed   = data?.status === "failed";
  const isComplete = data?.status === "completed";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-xl border p-5 transition-colors ${
        isFailed
          ? "border-red-200 bg-red-50"
          : isComplete
          ? "border-emerald-200 bg-emerald-50"
          : "border-blue-100 bg-blue-50/60"
      }`}
    >
      {/* Header row */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {isComplete ? (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100">
              <svg className="h-3.5 w-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ) : isFailed ? (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-red-100">
              <svg className="h-3.5 w-3.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100">
              <svg className="h-3.5 w-3.5 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            </div>
          )}

          <div>
            <p className={`text-sm font-semibold ${
              isFailed ? "text-red-700" : isComplete ? "text-emerald-700" : "text-blue-800"
            }`}>
              {isComplete ? "Video ready!" : isFailed ? "Generation failed" : "Generating your video…"}
            </p>
            <p className={`text-xs ${
              isFailed ? "text-red-500" : isComplete ? "text-emerald-600" : "text-blue-600"
            }`}>
              {isComplete
                ? "Your video will appear in the library below."
                : isFailed
                ? "Credits have been refunded to your account."
                : phase}
            </p>
          </div>
        </div>

        {/* Elapsed */}
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs tabular-nums font-medium ${
          isFailed ? "bg-red-100 text-red-500" : isComplete ? "bg-emerald-100 text-emerald-600" : "bg-blue-100 text-blue-600"
        }`}>
          {formatElapsed(elapsed)}
        </span>
      </div>

      {/* 3-step stepper */}
      <div className="flex justify-center py-2">
        <StepIndicator
          stepIndex={stepIndex as 0 | 1 | 2 | null}
          done={isComplete}
        />
      </div>

      {/* Indeterminate progress bar — hidden on terminal state */}
      <div className="mt-4">
        <IndeterminateBar active={isActive && !done} />
      </div>

      {/* Error inline notice */}
      {error && !done && (
        <p className="mt-3 text-xs text-red-500">{error}</p>
      )}

      {/* Auto-dismiss hint */}
      {done && (
        <p className="mt-3 text-center text-xs text-gray-400">
          {isComplete ? "Dismissing in a moment…" : "Dismiss to try again."}
        </p>
      )}
    </div>
  );
}
