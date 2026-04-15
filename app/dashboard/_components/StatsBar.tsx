import Link from "next/link";

interface StatsBarProps {
  videoCount: number;
  creditBalance: number;
  creditsUsed: number;
  videosThisMonth: number;
}

export function StatsBar({
  videoCount,
  creditBalance,
  creditsUsed,
  videosThisMonth,
}: StatsBarProps) {
  const isLow = creditBalance <= 3;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Videos generated */}
      <StatCard
        label="Videos Generated"
        value={videoCount}
        sub="all time"
        icon={<VideoIcon />}
        iconBg="bg-blue-50"
      />

      {/* This month */}
      <StatCard
        label="This Month"
        value={videosThisMonth}
        sub="videos created"
        icon={<CalendarIcon />}
        iconBg="bg-green-50"
      />

      {/* Credits used */}
      <StatCard
        label="Credits Used"
        value={creditsUsed}
        sub="all time"
        icon={<SpentIcon />}
        iconBg="bg-purple-50"
      />

      {/* Credits remaining */}
      <StatCard
        label="Credits Remaining"
        value={creditBalance}
        sub={isLow ? "running low" : "available"}
        subClassName={isLow ? "text-amber-500 font-semibold" : undefined}
        icon={<CreditIcon warn={isLow} />}
        iconBg={isLow ? "bg-amber-50" : "bg-yellow-50"}
        highlight={isLow}
        action={
          isLow ? (
            <Link
              href="/pricing"
              className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-amber-600 hover:text-amber-800 hover:underline"
            >
              Top up →
            </Link>
          ) : undefined
        }
      />
    </div>
  );
}

// ── Shared card ───────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  sub?: string;
  subClassName?: string;
  icon: React.ReactNode;
  iconBg: string;
  highlight?: boolean;
  action?: React.ReactNode;
}

function StatCard({
  label,
  value,
  sub,
  subClassName,
  icon,
  iconBg,
  highlight,
  action,
}: StatCardProps) {
  return (
    <div
      className={`flex items-center gap-4 rounded-2xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md ${
        highlight ? "border-amber-200" : "border-gray-100"
      }`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg}`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-gray-400">{label}</p>
        <div className="flex items-baseline gap-1.5">
          <p className="text-2xl font-bold tabular-nums text-gray-900">
            {value.toLocaleString()}
          </p>
          {sub && (
            <span className={`text-xs ${subClassName ?? "text-gray-400"}`}>
              {sub}
            </span>
          )}
        </div>
        {action}
      </div>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function VideoIcon() {
  return (
    <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function SpentIcon() {
  return (
    <svg className="h-5 w-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  );
}

function CreditIcon({ warn }: { warn: boolean }) {
  return (
    <svg
      className={`h-5 w-5 ${warn ? "text-amber-500" : "text-yellow-500"}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}
