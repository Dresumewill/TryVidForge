"use client";

import { useState } from "react";
import Link from "next/link";
import { formatPrice, type CreditPack } from "@/lib/stripe/products";

// Serialisable subset passed from the server component — no stripePriceId.
export interface PricingPackDisplay
  extends Omit<CreditPack, "stripePriceId"> {}

interface PricingCardsProps {
  packs: PricingPackDisplay[];
  /** null = visitor (not signed in) */
  userId: string | null;
}

// ── Free plan ────────────────────────────────────────────────────────────────

function FreePlanCard({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <div className="relative flex flex-col rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
        Free
      </p>
      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-5xl font-extrabold tracking-tight text-gray-900">
          €0
        </span>
        <span className="text-sm text-gray-400">/ forever</span>
      </div>
      <p className="mt-2 text-sm text-gray-500">
        Get started with no credit card required.
      </p>

      <ul className="mt-8 space-y-3 text-sm text-gray-600">
        {freePlanFeatures.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
            {f}
          </li>
        ))}
      </ul>

      <div className="mt-8">
        {isLoggedIn ? (
          <Link
            href="/dashboard"
            className="flex w-full items-center justify-center rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            Go to dashboard
          </Link>
        ) : (
          <Link
            href="/signup"
            className="flex w-full items-center justify-center rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            Sign up for free
          </Link>
        )}
      </div>
    </div>
  );
}

// ── Paid plan card ───────────────────────────────────────────────────────────

function PaidPlanCard({
  pack,
  isLoggedIn,
  isLoading,
  anyLoading,
  onBuy,
}: {
  pack: PricingPackDisplay;
  isLoggedIn: boolean;
  isLoading: boolean;
  anyLoading: boolean;
  onBuy: (packId: string) => void;
}) {
  const price = formatPrice(pack);
  const perCredit = (pack.priceCents / 100 / pack.credits).toFixed(2);
  const isFeatured = !!pack.badge;

  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-6 transition-shadow hover:shadow-md sm:p-8 ${
        isFeatured
          ? "border-blue-200 bg-gradient-to-b from-blue-50/70 to-white shadow-md ring-1 ring-blue-100"
          : "border-gray-100 bg-white shadow-sm"
      }`}
    >
      {/* Badge */}
      {pack.badge && (
        <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-blue-600 px-4 py-1 text-xs font-semibold text-white shadow">
          {pack.badge}
        </span>
      )}

      <p
        className={`text-xs font-semibold uppercase tracking-widest ${
          isFeatured ? "text-blue-500" : "text-gray-400"
        }`}
      >
        {pack.name}
      </p>

      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-5xl font-extrabold tracking-tight text-gray-900">
          {price}
        </span>
        <span className="text-sm text-gray-400">one-time</span>
      </div>

      <p className="mt-2 text-sm text-gray-500">{pack.description}</p>

      {/* Credit count + per-credit rate */}
      <div
        className={`my-6 flex items-center justify-between rounded-xl px-4 py-3 ${
          isFeatured ? "bg-blue-50" : "bg-gray-50"
        }`}
      >
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-extrabold text-gray-900">
            {pack.credits}
          </span>
          <span className="text-sm text-gray-500">credits</span>
        </div>
        <span className="text-xs font-medium text-gray-400">
          €{perCredit}/credit
        </span>
      </div>

      <ul className="mb-8 space-y-3 text-sm text-gray-600">
        {paidPlanFeatures.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <CheckIcon
              className={`mt-0.5 h-4 w-4 shrink-0 ${
                isFeatured ? "text-blue-500" : "text-green-500"
              }`}
            />
            {f}
          </li>
        ))}
        <li className="flex items-start gap-2.5">
          <CheckIcon
            className={`mt-0.5 h-4 w-4 shrink-0 ${
              isFeatured ? "text-blue-500" : "text-green-500"
            }`}
          />
          <strong>{pack.credits} video credits</strong> included
        </li>
      </ul>

      {/* CTA */}
      {isLoggedIn ? (
        <button
          onClick={() => onBuy(pack.id)}
          disabled={anyLoading}
          className={`mt-auto flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
            isFeatured
              ? "bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500 active:scale-[0.98]"
              : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 focus-visible:ring-gray-400 active:scale-[0.98]"
          }`}
        >
          {isLoading ? (
            <>
              <SpinnerIcon className="h-4 w-4 animate-spin" />
              Redirecting to Stripe…
            </>
          ) : (
            <>
              <CardIcon className="h-4 w-4" />
              Buy {pack.credits} credits for {price}
            </>
          )}
        </button>
      ) : (
        <Link
          href="/signup"
          className={`mt-auto flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-colors ${
            isFeatured
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
          }`}
        >
          Get started
        </Link>
      )}
    </div>
  );
}

// ── Main export ──────────────────────────────────────────────────────────────

export function PricingCards({ packs, userId }: PricingCardsProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleBuy(packId: string) {
    setLoadingId(packId);
    setError(null);

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });

      const json = await res.json();

      if (!res.ok || !json.data?.url) {
        setError(
          json.error?.message ?? "Failed to start checkout. Please try again."
        );
        return;
      }

      window.location.href = json.data.url;
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="w-full">
      {/* Error banner */}
      {error && (
        <div
          role="alert"
          className="mb-8 flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-600"
        >
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto shrink-0 text-red-400 hover:text-red-600"
            aria-label="Dismiss"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Cards grid */}
      <div className="grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
        <FreePlanCard isLoggedIn={!!userId} />
        {packs.map((pack) => (
          <PaidPlanCard
            key={pack.id}
            pack={pack}
            isLoggedIn={!!userId}
            isLoading={loadingId === pack.id}
            anyLoading={loadingId !== null}
            onBuy={handleBuy}
          />
        ))}
      </div>

      {/* Trust line */}
      <p className="mt-8 flex items-center justify-center gap-2 text-xs text-gray-400">
        <LockIcon className="h-3.5 w-3.5" />
        Secured by Stripe · No subscription · Credits never expire · VAT may
        apply
      </p>
    </div>
  );
}

// ── Feature lists ────────────────────────────────────────────────────────────

const freePlanFeatures = [
  "10 credits on sign-up",
  "AI script generation",
  "ElevenLabs voiceover",
  "720p video output",
  "Dashboard & history",
];

const paidPlanFeatures = [
  "AI script generation",
  "ElevenLabs voiceover",
  "Runway video generation",
  "FFmpeg audio merge",
  "720p MP4 download",
];

// ── Inline SVG icons ─────────────────────────────────────────────────────────

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
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

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
