import { createClient } from "@/lib/supabase/server";
import type { VideoRow } from "@/lib/supabase/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns the UTC date string "YYYY-MM-DD" for a given offset from today. */
function utcDateLabel(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/** Short weekday label — "Mon", "Tue", etc. */
function dayLabel(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

interface AnalyticsPanelProps {
  userId: string;
}

export async function AnalyticsPanel({ userId }: AnalyticsPanelProps) {
  const supabase = await createClient();

  // Last 7 days (today + 6 previous days)
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 6);
  since.setUTCHours(0, 0, 0, 0);

  const { data } = await supabase
    .from("videos")
    .select("created_at, status")
    .eq("user_id", userId)
    .gte("created_at", since.toISOString());

  const rows = (data ?? []) as Pick<VideoRow, "created_at" | "status">[];

  // Build a map: dateStr → { total, completed }
  const days = Array.from({ length: 7 }, (_, i) => utcDateLabel(i - 6));

  const countMap = new Map<string, { total: number; completed: number }>(
    days.map((d) => [d, { total: 0, completed: 0 }])
  );

  for (const row of rows) {
    const day = row.created_at.slice(0, 10);
    const entry = countMap.get(day);
    if (!entry) continue;
    entry.total++;
    if (row.status === "ready") entry.completed++;
  }

  const entries = days.map((d) => ({ day: d, ...countMap.get(d)! }));
  const maxTotal = Math.max(...entries.map((e) => e.total), 1);

  const totalVideos = rows.length;
  const completedVideos = rows.filter((r) => r.status === "ready").length;
  const successRate =
    totalVideos > 0 ? Math.round((completedVideos / totalVideos) * 100) : null;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Last 7 days</h2>
          <p className="mt-0.5 text-xs text-gray-400">Videos generated per day</p>
        </div>

        {successRate !== null && (
          <div className="text-right">
            <p className="text-lg font-bold text-gray-900">{successRate}%</p>
            <p className="text-xs text-gray-400">success rate</p>
          </div>
        )}
      </div>

      {/* Bar chart */}
      <div className="px-6 py-5">
        <div className="flex h-24 items-end gap-1.5">
          {entries.map(({ day, total, completed }) => {
            const heightPct = Math.round((total / maxTotal) * 100);
            const completedPct = total > 0 ? Math.round((completed / total) * 100) : 0;

            return (
              <div
                key={day}
                className="group relative flex flex-1 flex-col items-center justify-end"
                title={`${total} video${total === 1 ? "" : "s"} (${completedPct}% succeeded)`}
              >
                {/* Bar */}
                <div
                  className="w-full rounded-t-sm bg-blue-100 transition-all duration-300 group-hover:bg-blue-200"
                  style={{ height: `${heightPct}%`, minHeight: total > 0 ? "4px" : "2px" }}
                >
                  {/* Completed fill */}
                  {total > 0 && (
                    <div
                      className="w-full rounded-t-sm bg-blue-500"
                      style={{ height: `${completedPct}%` }}
                    />
                  )}
                </div>

                {/* Value label (only when > 0) */}
                {total > 0 && (
                  <span className="absolute -top-5 text-[10px] font-semibold text-gray-600">
                    {total}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Day labels */}
        <div className="mt-2 flex gap-1.5">
          {entries.map(({ day }) => (
            <div key={day} className="flex-1 text-center text-[10px] text-gray-400">
              {dayLabel(day)}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 border-t border-gray-100 px-6 py-3">
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="h-2 w-2 rounded-sm bg-blue-500" />
          Completed
        </span>
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="h-2 w-2 rounded-sm bg-blue-100" />
          Failed / in progress
        </span>
      </div>
    </div>
  );
}
