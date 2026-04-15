import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CREDIT_PACKS, formatPrice } from "@/lib/stripe/products";
import { PricingCards } from "./_components/PricingCards";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple, one-time credit packs. No subscription. Pay once, create whenever.",
};

export default async function PricingPage() {
  // Read auth without blocking the page — null userId = visitor
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Strip server-only env vars before passing to client component
  const packs = CREDIT_PACKS.map(({ stripePriceId: _ignored, ...rest }) => rest);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="border-b border-gray-100 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link
            href="/"
            className="text-xl font-bold text-blue-600 tracking-tight"
          >
            VidForge
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="hidden text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors sm:block"
            >
              Home
            </Link>
            {user ? (
              <Link
                href="/dashboard"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="flex-1">
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <section className="px-6 pb-10 pt-20 text-center">
          <span className="inline-block rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
            Simple pricing
          </span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
            Pay once.{" "}
            <span className="text-blue-600">Create whenever.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-gray-500">
            Buy a credit pack and use it at your own pace. No subscription, no
            monthly bill — credits never expire.
          </p>
        </section>

        {/* ── Pricing cards ─────────────────────────────────────────────── */}
        <section className="mx-auto max-w-5xl px-6 pb-20">
          <PricingCards packs={packs} userId={user?.id ?? null} />
        </section>

        {/* ── "How credits work" ────────────────────────────────────────── */}
        <section className="border-t border-gray-100 bg-gray-50 px-6 py-20">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-12 text-center text-2xl font-bold text-gray-900">
              How credits work
            </h2>
            <div className="grid gap-6 sm:grid-cols-3">
              {creditSteps.map((step, i) => (
                <div key={step.title} className="flex flex-col items-start">
                  <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white">
                    {i + 1}
                  </div>
                  <h3 className="mb-1.5 text-sm font-semibold text-gray-900">
                    {step.title}
                  </h3>
                  <p className="text-sm text-gray-500">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Value comparison ──────────────────────────────────────────── */}
        <section className="px-6 py-20">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-8 text-center text-2xl font-bold text-gray-900">
              Compare packs
            </h2>
            <div className="overflow-hidden rounded-2xl border border-gray-100 shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-left">
                    <th className="px-6 py-3 font-semibold text-gray-600">
                      Pack
                    </th>
                    <th className="px-6 py-3 font-semibold text-gray-600">
                      Credits
                    </th>
                    <th className="px-6 py-3 font-semibold text-gray-600">
                      Price
                    </th>
                    <th className="px-6 py-3 font-semibold text-gray-600">
                      Per credit
                    </th>
                    <th className="px-6 py-3 font-semibold text-gray-600" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {/* Free row */}
                  <tr>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      Free
                    </td>
                    <td className="px-6 py-4 text-gray-600">10</td>
                    <td className="px-6 py-4 text-gray-600">€0</td>
                    <td className="px-6 py-4 text-gray-600">—</td>
                    <td className="px-6 py-4">
                      <Link
                        href={user ? "/dashboard" : "/signup"}
                        className="text-xs font-semibold text-blue-600 hover:underline"
                      >
                        {user ? "Dashboard →" : "Sign up →"}
                      </Link>
                    </td>
                  </tr>
                  {/* Paid packs */}
                  {CREDIT_PACKS.map((pack) => (
                    <tr
                      key={pack.id}
                      className={pack.badge ? "bg-blue-50/40" : ""}
                    >
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {pack.name}
                        {pack.badge && (
                          <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                            {pack.badge}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {pack.credits}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {formatPrice(pack)}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        €{(pack.priceCents / 100 / pack.credits).toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          href={user ? "#pricing" : "/signup"}
                          className="text-xs font-semibold text-blue-600 hover:underline"
                        >
                          Buy →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── FAQ ───────────────────────────────────────────────────────── */}
        <section className="border-t border-gray-100 bg-gray-50 px-6 py-20">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-10 text-center text-2xl font-bold text-gray-900">
              Frequently asked questions
            </h2>
            <dl className="space-y-6">
              {faqs.map((faq) => (
                <div
                  key={faq.q}
                  className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
                >
                  <dt className="text-sm font-semibold text-gray-900">
                    {faq.q}
                  </dt>
                  <dd className="mt-2 text-sm text-gray-500">{faq.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ── Bottom CTA ────────────────────────────────────────────────── */}
        <section className="px-6 py-24 text-center">
          <h2 className="text-3xl font-bold text-gray-900">
            Ready to start creating?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-base text-gray-500">
            Sign up for free and get 10 credits instantly. No credit card
            needed to try.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/signup"
              className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
            >
              Get started for free
            </Link>
            <Link
              href="/login"
              className="rounded-xl border border-gray-200 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Sign in
            </Link>
          </div>
        </section>
      </main>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 px-6 py-8 text-center text-sm text-gray-400">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <span className="font-semibold text-gray-600">VidForge</span>
          <div className="flex gap-6">
            <Link href="/" className="hover:text-gray-600 transition-colors">
              Home
            </Link>
            <Link
              href="/pricing"
              className="hover:text-gray-600 transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="/dashboard"
              className="hover:text-gray-600 transition-colors"
            >
              Dashboard
            </Link>
          </div>
          <span>
            &copy; {new Date().getFullYear()} TryVidForge UCG. All rights
            reserved.
          </span>
        </div>
      </footer>
    </div>
  );
}

// ── Static content ────────────────────────────────────────────────────────────

const creditSteps = [
  {
    title: "Buy a pack",
    body: "Choose Starter or Creator and check out securely through Stripe. Credits are added to your account immediately after payment.",
  },
  {
    title: "Generate videos",
    body: "Each video generation costs 1 credit. Enter your prompt and our AI pipeline writes a script, records a voiceover, and renders the video.",
  },
  {
    title: "Download & share",
    body: "Your finished MP4 is ready to download from your dashboard. Credits never expire so you can use them at any time.",
  },
];

const faqs = [
  {
    q: "Do credits expire?",
    a: "No. Credits are yours to use whenever you like — there is no expiry date and no monthly renewal.",
  },
  {
    q: "What does 1 credit get me?",
    a: "One credit generates a single video: AI script, ElevenLabs voiceover, Runway video clip, and an FFmpeg-merged MP4 ready to download.",
  },
  {
    q: "Can I get a refund?",
    a: "If a generation fails, your credit is automatically refunded within seconds. For other refund requests please contact support.",
  },
  {
    q: "What payment methods are accepted?",
    a: "All major cards (Visa, Mastercard, Amex) and Apple Pay / Google Pay via Stripe. Your card details are never stored on our servers.",
  },
  {
    q: "Will I be charged VAT?",
    a: "VAT may be added at checkout depending on your billing country. The amount shown in Stripe checkout is always the final amount.",
  },
  {
    q: "Can I buy more credits after I run out?",
    a: "Yes — head to the dashboard and click 'Buy Credits', or come back to this page at any time to top up.",
  },
];
