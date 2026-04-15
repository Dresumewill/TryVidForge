"use client";

import { useRef } from "react";
import type { VideoRow } from "@/lib/supabase/types";

// ── Status / phase derivation ─────────────────────────────────────────────────

interface PhaseConfig {
  label: string;
  step: string;          // e.g. "1 of 3"
  badge: string;         // Tailwind classes for the badge
  dot: string;           // Tailwind classes for the status dot
  phaseLine?: string;    // Subtitle shown below the badge
}

function getPhase(video: VideoRow): PhaseConfig {
  switch (video.status) {
    case "pending":
      return {
        label:     "Queued",
        step:      "1 of 3",
        badge:     "bg-gray-100 text-gray-500",
        dot:       "bg-gray-400",
        phaseLine: "Waiting for AI script generation",
      };

    case "processing":
      if (!video.rendering_job_id) {
        return {
          label:     "Generating",
          step:      "2 of 3",
          badge:     "bg-blue-50 text-blue-600",
          dot:       "bg-blue-400 animate-pulse",
          phaseLine: "Creating audio & submitting render",
        };
      }
      return {
        label:     "Rendering",
        step:      "3 of 3",
        badge:     "bg-yellow-50 text-yellow-700",
        dot:       "bg-yellow-400 animate-pulse",
        phaseLine: "Generating your video",
      };

    case "ready":
      return {
        label: "Ready",
        step:  "Done",
        badge: "bg-emerald-50 text-emerald-700",
        dot:   "bg-emerald-500",
      };

    case "failed":
      return {
        label: "Failed",
        step:  "—",
        badge: "bg-red-50 text-red-600",
        dot:   "bg-red-500",
      };
  }
}

// ── Thumbnail ─────────────────────────────────────────────────────────────────

function Thumbnail({ video }: { video: VideoRow }) {
  const ref = useRef<HTMLVideoElement>(null);

  const handleMouseEnter = () => ref.current?.play().catch(() => undefined);
  const handleMouseLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
  };

  if (video.status === "ready" && video.video_url) {
    return (
      <div
        className="relative h-full w-full overflow-hidden bg-black"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <video
          ref={ref}
          src={video.video_url}
          preload="metadata"
          muted
          playsInline
          loop
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-100 transition-opacity duration-200 group-hover:opacity-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow">
            <svg className="h-4 w-4 translate-x-0.5 text-gray-800" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  // ── In-progress placeholder with step indicators ──────────────────────────
  const isActive = video.status === "pending" || video.status === "processing";

  const gradients: Record<VideoRow["status"], string> = {
    pending:    "from-gray-50   to-gray-100",
    processing: "from-blue-50   to-indigo-100",
    failed:     "from-red-50    to-rose-100",
    ready:      "from-emerald-50 to-teal-100",
  };

  return (
    <div className={`flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br px-4 ${gradients[video.status]}`}>
      {isActive ? (
        <>
          {/* Animated ring */}
          <div className="relative flex h-12 w-12 items-center justify-center">
            <svg className="absolute h-12 w-12 animate-spin text-blue-200" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
          </div>

          {/* Step dots */}
          <StepDots video={video} />
        </>
      ) : (
        // Failed icon
        <svg className="h-7 w-7 text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      )}
    </div>
  );
}

function StepDots({ video }: { video: VideoRow }) {
  const stepIndex =
    video.status === "pending"                    ? 0 :
    video.status === "processing" && !video.rendering_job_id ? 1 :
    video.status === "processing" && video.rendering_job_id  ? 2 : 3;

  return (
    <div className="flex items-center gap-1.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i < stepIndex
              ? "w-3 bg-blue-400"          // completed step
              : i === stepIndex
              ? "w-4 bg-blue-500 animate-pulse" // active step
              : "w-1.5 bg-gray-300"         // future step
          }`}
        />
      ))}
    </div>
  );
}

// ── Named step bar ────────────────────────────────────────────────────────────

const STEP_LABELS = ["Script", "Audio", "Video"] as const;

function NamedStepBar({ video }: { video: VideoRow }) {
  const activeIndex =
    video.status === "pending"                                    ? 0 :
    video.status === "processing" && !video.rendering_job_id     ? 1 :
    video.status === "processing" && !!video.rendering_job_id    ? 2 : 3;

  return (
    <div className="flex items-center gap-1">
      {STEP_LABELS.map((label, i) => {
        const isCompleted = i < activeIndex;
        const isCurrent   = i === activeIndex;
        return (
          <div key={label} className="flex items-center gap-1">
            {i > 0 && (
              <div className={`h-px w-3 ${isCompleted ? "bg-blue-300" : "bg-gray-200"}`} />
            )}
            <span
              className={`text-[10px] font-medium ${
                isCompleted ? "text-blue-400" : isCurrent ? "text-blue-600" : "text-gray-300"
              }`}
            >
              {label}
              {isCurrent && (
                <span className="ml-0.5 inline-block h-1 w-1 animate-pulse rounded-full bg-blue-500 align-middle" />
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Download button ───────────────────────────────────────────────────────────

function DownloadButton({ videoId }: { videoId: string }) {
  return (
    <a
      href={`/api/download/${videoId}`}
      download
      className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-700 active:scale-95"
      title="Download MP4"
    >
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      Download
    </a>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

export function VideoCard({ video }: { video: VideoRow }) {
  const phase = getPhase(video);
  const date = new Date(video.created_at).toLocaleDateString("en-US", {
    month: "short",
    day:   "numeric",
    year:  "numeric",
  });

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md">
      {/* Thumbnail — 16:9 */}
      <div className="relative aspect-video w-full overflow-hidden bg-gray-100">
        <Thumbnail video={video} />
      </div>

      {/* Card body */}
      <div className="flex flex-1 flex-col gap-2.5 p-4">
        {/* Prompt */}
        <p className="line-clamp-2 text-sm font-medium leading-snug text-gray-900">
          {video.prompt}
        </p>

        {/* Status badge + step counter */}
        <div className="flex items-center justify-between">
          <span
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${phase.badge}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${phase.dot}`} />
            {phase.label}
          </span>
          <span className="text-xs tabular-nums text-gray-400">
            Step {phase.step}
          </span>
        </div>

        {/* Named step bar — only for active jobs */}
        {phase.phaseLine && (
          <div className="space-y-1.5">
            <p className="text-xs text-gray-400">{phase.phaseLine}</p>
            <NamedStepBar video={video} />
          </div>
        )}

        {/* Date + actions */}
        <div className="mt-auto flex items-center justify-between pt-1">
          <time className="text-xs text-gray-400" dateTime={video.created_at}>
            {date}
          </time>

          {video.status === "ready" ? (
            <DownloadButton videoId={video.id} />
          ) : video.status === "failed" ? (
            <span className="text-xs text-red-400">Credit refunded</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
