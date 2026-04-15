"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const AUTO_DISMISS_MS = 8000;

export function PaymentSuccessToast() {
  const router = useRouter();
  const [credits, setCredits] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    const n = Number(params.get("credits") ?? 0);

    if (payment === "success" && n > 0) {
      setCredits(n);
      setVisible(true);
      router.refresh(); // re-render Server Components so balance updates
      window.history.replaceState({}, "", "/dashboard");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-dismiss
  useEffect(() => {
    if (!visible) return;
    const id = setTimeout(() => setVisible(false), AUTO_DISMISS_MS);
    return () => clearTimeout(id);
  }, [visible]);

  if (!visible || credits === null) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="animate-in slide-in-from-top-2 fade-in duration-300 flex items-start gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 shadow-sm"
    >
      {/* Icon */}
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100">
        <svg
          className="h-5 w-5 text-emerald-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-emerald-800">
          Payment successful — {credits} credits added!
        </p>
        <p className="mt-0.5 text-xs text-emerald-600">
          Your balance has been updated. You&apos;re ready to create.
        </p>
      </div>

      {/* Dismiss */}
      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label="Dismiss"
        className="ml-auto shrink-0 rounded-lg p-1 text-emerald-500 transition-colors hover:bg-emerald-100 hover:text-emerald-700"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Auto-dismiss progress bar */}
      <div
        aria-hidden="true"
        className="absolute bottom-0 left-0 h-0.5 w-full overflow-hidden rounded-b-2xl bg-emerald-100"
      >
        <div
          className="h-full bg-emerald-400 origin-left"
          style={{ animation: `shrink ${AUTO_DISMISS_MS}ms linear forwards` }}
        />
      </div>
    </div>
  );
}
