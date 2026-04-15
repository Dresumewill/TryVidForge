"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { VideoRow } from "@/lib/supabase/types";
import { VideoCard } from "./VideoCard";

interface VideoListProps {
  videos: VideoRow[];
  totalCount: number;
}

/** Videos that are still being processed — need polling. */
const ACTIVE_STATUSES: VideoRow["status"][] = ["pending", "processing"];
const POLL_INTERVAL_MS = 5_000;

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50">
        <svg
          className="h-7 w-7 text-gray-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"
          />
        </svg>
      </div>
      <p className="text-sm font-medium text-gray-900">No videos yet</p>
      <p className="mt-1 max-w-xs text-xs text-gray-400">
        Write a prompt above and hit &ldquo;Generate Video&rdquo; to create your
        first one.
      </p>
    </div>
  );
}

export function VideoList({ videos, totalCount }: VideoListProps) {
  const router = useRouter();

  const hasActive = videos.some((v) => ACTIVE_STATUSES.includes(v.status));

  // Poll the server every 5 s while any video is still in progress.
  // router.refresh() re-executes the parent Server Component and passes
  // updated rows back down as new props — no separate state needed.
  useEffect(() => {
    if (!hasActive) return;
    const id = setInterval(() => router.refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [hasActive, router]);

  const activeCount = videos.filter((v) =>
    ACTIVE_STATUSES.includes(v.status)
  ).length;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Your Videos</h2>
          <p className="mt-0.5 text-xs text-gray-400">
            {totalCount === 0
              ? "No videos generated yet"
              : `${totalCount} video${totalCount === 1 ? "" : "s"} total`}
          </p>
        </div>

        {/* Live indicator while polling */}
        {hasActive && (
          <span className="flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
            {activeCount} processing
          </span>
        )}
      </div>

      {/* Grid or empty state */}
      {videos.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      )}
    </div>
  );
}
