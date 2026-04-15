import type { CreditTransactionRow } from "@/lib/supabase/types";

interface ActivityFeedProps {
  transactions: Pick<
    CreditTransactionRow,
    "id" | "delta" | "reason" | "created_at" | "video_id"
  >[];
}

export function ActivityFeed({ transactions }: ActivityFeedProps) {
  if (transactions.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">
          Recent Activity
        </h2>
        <p className="text-sm text-gray-400">
          No activity yet. Generate your first video to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
      {/* Header */}
      <div className="border-b border-gray-100 px-6 py-4">
        <h2 className="text-sm font-semibold text-gray-900">Recent Activity</h2>
        <p className="mt-0.5 text-xs text-gray-400">
          Your last {transactions.length} credit transactions
        </p>
      </div>

      {/* List */}
      <ul className="divide-y divide-gray-50">
        {transactions.map((tx) => {
          const meta = describeTx(tx);
          return (
            <li key={tx.id} className="flex items-center gap-4 px-6 py-3.5">
              {/* Icon */}
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${meta.iconBg}`}
              >
                {meta.icon}
              </div>

              {/* Label + sub */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-800">
                  {meta.label}
                </p>
                <p className="text-xs text-gray-400">
                  {formatRelative(tx.created_at)}
                </p>
              </div>

              {/* Delta badge */}
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${
                  tx.delta > 0
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-600"
                }`}
              >
                {tx.delta > 0 ? `+${tx.delta}` : tx.delta}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

interface TxMeta {
  label: string;
  icon: React.ReactNode;
  iconBg: string;
}

function describeTx(
  tx: Pick<CreditTransactionRow, "delta" | "reason" | "video_id">
): TxMeta {
  const { delta, reason } = tx;

  // Deductions
  if (delta < 0) {
    if (reason === "video_generation") {
      return {
        label: "Video generated",
        iconBg: "bg-blue-50",
        icon: <VideoIcon className="h-4 w-4 text-blue-500" />,
      };
    }
    return {
      label: humaniseReason(reason),
      iconBg: "bg-red-50",
      icon: <MinusIcon className="h-4 w-4 text-red-500" />,
    };
  }

  // Credits added back (refunds)
  if (reason.endsWith("_refund") || reason === "refund") {
    return {
      label: "Credit refunded",
      iconBg: "bg-amber-50",
      icon: <RefundIcon className="h-4 w-4 text-amber-500" />,
    };
  }

  // Top-ups / purchases
  if (reason.startsWith("stripe_purchase")) {
    return {
      label: "Credits purchased",
      iconBg: "bg-green-50",
      icon: <CardIcon className="h-4 w-4 text-green-600" />,
    };
  }

  if (reason === "signup_bonus") {
    return {
      label: "Welcome bonus",
      iconBg: "bg-purple-50",
      icon: <GiftIcon className="h-4 w-4 text-purple-500" />,
    };
  }

  return {
    label: humaniseReason(reason),
    iconBg: "bg-green-50",
    icon: <PlusIcon className="h-4 w-4 text-green-600" />,
  };
}

function humaniseReason(reason: string): string {
  return reason
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: days > 365 ? "numeric" : undefined,
  });
}

// ── Inline SVG icons ──────────────────────────────────────────────────────────

function VideoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
    </svg>
  );
}

function MinusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function RefundIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
    </svg>
  );
}

function CardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  );
}

function GiftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
    </svg>
  );
}
