"use client";

import { useState } from "react";
import { CREDIT_PACKS, formatPrice, type CreditPack } from "@/lib/stripe/products";

interface CreditShopProps {
  onClose?: () => void;
}

function PackCard({
  pack,
  isLoading,
  anyLoading,
  onBuy,
}: {
  pack: CreditPack;
  isLoading: boolean;
  anyLoading: boolean;
  onBuy: (pack: CreditPack) => void;
}) {
  const price      = formatPrice(pack);
  const perCredit  = (pack.priceCents / 100 / pack.credits).toFixed(2);
  const isFeatured = !!pack.badge;

  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-6 transition-shadow hover:shadow-md ${
        isFeatured
          ? "border-blue-200 bg-gradient-to-b from-blue-50/60 to-white shadow-sm"
          : "border-gray-100 bg-white"
      }`}
    >
      {/* Badge */}
      {pack.badge && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-blue-600 px-3 py-0.5 text-xs font-semibold text-white shadow-sm">
          {pack.badge}
        </span>
      )}

      {/* Name + description */}
      <p className="text-sm font-semibold text-gray-900">{pack.name}</p>
      <p className="mt-0.5 text-xs text-gray-400">{pack.description}</p>

      {/* Credits */}
      <div className="my-5 flex items-baseline gap-1.5">
        <span className="text-4xl font-extrabold tracking-tight text-gray-900">
          {pack.credits}
        </span>
        <span className="text-sm font-medium text-gray-400">credits</span>
      </div>

      {/* Divider */}
      <div className="mb-5 border-t border-gray-100" />

      {/* Price */}
      <div className="flex items-baseline justify-between">
        <span className="text-2xl font-bold text-gray-900">{price}</span>
        <span className="text-xs text-gray-400">€{perCredit}/credit</span>
      </div>

      {/* CTA */}
      <button
        onClick={() => onBuy(pack)}
        disabled={anyLoading}
        className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
          isFeatured
            ? "bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]"
            : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 active:scale-[0.98]"
        }`}
      >
        {isLoading ? (
          <>
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Redirecting to Stripe…
          </>
        ) : (
          <>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            Buy {pack.credits} credits for {price}
          </>
        )}
      </button>
    </div>
  );
}

export function CreditShop({ onClose }: CreditShopProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  async function handleBuy(pack: CreditPack) {
    setLoading(pack.id);
    setError(null);

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId: pack.id }),
      });

      const json = await res.json();

      if (!res.ok || !json.data?.url) {
        setError(json.error?.message ?? "Failed to start checkout. Please try again.");
        return;
      }

      // Hand off to Stripe-hosted checkout
      window.location.href = json.data.url;
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Buy Credits</h2>
          <p className="mt-0.5 text-xs text-gray-400">
            One-time purchase · no subscription · VAT may apply
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="p-6">
        {/* Error */}
        {error && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600"
          >
            <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {/* Pack cards — side by side on sm+ */}
        <div className="grid gap-4 sm:grid-cols-2">
          {CREDIT_PACKS.map((pack) => (
            <PackCard
              key={pack.id}
              pack={pack}
              isLoading={loading === pack.id}
              anyLoading={loading !== null}
              onBuy={handleBuy}
            />
          ))}
        </div>

        {/* Trust footer */}
        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-gray-400">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Secured by Stripe · Your card details are never stored on our servers
        </p>
      </div>
    </div>
  );
}
