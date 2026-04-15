"use client";

import { useEffect, useReducer, useRef } from "react";
import { useRouter } from "next/navigation";
import { CreditShop } from "./CreditShop";
import type {
  GenerateVideoResponse,
  GenerateVideoResponseData,
} from "@/lib/api/response";

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_CHARS = 500;
const MIN_CHARS = 10;
/** Balance at or below this triggers the low-credits warning. */
const LOW_CREDIT_THRESHOLD = 3;

const PROMPT_SUGGESTIONS = [
  "Product demo — 30 sec",
  "Social media ad",
  "SaaS explainer",
  "Customer testimonial",
] as const;

// ── State machine ─────────────────────────────────────────────────────────────

type FormStatus = "idle" | "loading" | "success" | "error";

interface FormState {
  prompt: string;
  status: FormStatus;
  result: GenerateVideoResponseData | null;
  errorMessage: string | null;
  errorCode: string | null;
  showShop: boolean;
}

type FormAction =
  | { type: "SET_PROMPT"; payload: string }
  | { type: "SUBMIT" }
  | { type: "SUCCESS"; payload: GenerateVideoResponseData }
  | { type: "ERROR"; payload: { message: string; code: string | null } }
  | { type: "RESET_STATUS" }
  | { type: "SHOW_SHOP" }
  | { type: "HIDE_SHOP" };

const initialState: FormState = {
  prompt: "",
  status: "idle",
  result: null,
  errorMessage: null,
  errorCode: null,
  showShop: false,
};

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "SET_PROMPT":
      return { ...state, prompt: action.payload, status: "idle", errorMessage: null, errorCode: null };
    case "SUBMIT":
      return { ...state, status: "loading", result: null, errorMessage: null, errorCode: null };
    case "SUCCESS":
      return { ...state, status: "success", result: action.payload, prompt: "" };
    case "ERROR":
      return { ...state, status: "error", errorMessage: action.payload.message, errorCode: action.payload.code };
    case "RESET_STATUS":
      return { ...state, status: "idle", result: null, errorMessage: null, errorCode: null };
    case "SHOW_SHOP":
      return { ...state, showShop: true };
    case "HIDE_SHOP":
      return { ...state, showShop: false };
    default:
      return state;
  }
}

// ── Generate button ───────────────────────────────────────────────────────────

function GenerateButton({ disabled, loading }: { disabled: boolean; loading: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled || loading}
      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {loading ? (
        <>
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Generating…
        </>
      ) : (
        <>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Generate Video
        </>
      )}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface GenerateFormProps {
  creditBalance: number;
}

export function GenerateForm({ creditBalance }: GenerateFormProps) {
  const router = useRouter();
  const [state, dispatch] = useReducer(formReducer, initialState);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isLoading   = state.status === "loading";
  const isValid     = state.prompt.trim().length >= MIN_CHARS && state.prompt.length <= MAX_CHARS;
  const outOfCredits = creditBalance < 1;
  const isLow       = !outOfCredits && creditBalance <= LOW_CREDIT_THRESHOLD;

  // Handle Stripe redirect back — cancelled only (success is handled by PaymentSuccessToast)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "cancelled") {
      dispatch({ type: "SHOW_SHOP" });
      window.history.replaceState({}, "", "/dashboard");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-dismiss generation success banner after 8 seconds
  useEffect(() => {
    if (state.status !== "success") return;
    const id = setTimeout(() => dispatch({ type: "RESET_STATUS" }), 8000);
    return () => clearTimeout(id);
  }, [state.status]);

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isValid || isLoading) return;

    dispatch({ type: "SUBMIT" });

    try {
      const res = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: state.prompt }),
      });

      const json: GenerateVideoResponse = await res.json();

      if (!res.ok || !json.success) {
        const code    = !json.success ? json.error.code    : null;
        const message = !json.success ? json.error.message : "Something went wrong. Please try again.";
        dispatch({ type: "ERROR", payload: { message, code } });
        return;
      }

      dispatch({ type: "SUCCESS", payload: json.data });
      router.refresh();
    } catch {
      dispatch({
        type: "ERROR",
        payload: { message: "Network error — check your connection and try again.", code: "network_error" },
      });
    }
  }

  return (
    <>
      {/* ── Low-credits warning — shown above the card when 1–3 credits ── */}
      {isLow && !state.showShop && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3.5 shadow-sm"
        >
          {/* Icon */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100">
            <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>

          {/* Text */}
          <p className="flex-1 text-sm text-amber-800">
            <span className="font-semibold">
              Only {creditBalance} {creditBalance === 1 ? "credit" : "credits"} remaining.
            </span>{" "}
            Top up now so you don&apos;t run out mid-project.
          </p>

          {/* CTA */}
          <button
            type="button"
            onClick={() => dispatch({ type: "SHOW_SHOP" })}
            className="shrink-0 rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2"
          >
            Buy more
          </button>
        </div>
      )}

      {/* ── Form card ─────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        {/* Card header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Generate a Video</h2>
            <p className="mt-0.5 text-xs text-gray-400">
              Describe your video and our AI will create it
            </p>
          </div>

          {/* Credits badge */}
          <div
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
              outOfCredits
                ? "bg-red-50 text-red-600"
                : isLow
                ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                : "bg-emerald-50 text-emerald-700"
            }`}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {creditBalance} {creditBalance === 1 ? "credit" : "credits"} left
          </div>
        </div>

        <div className="p-6">
          {/* ── Generation success banner ── */}
          {state.status === "success" && state.result && (
            <div role="status" aria-live="polite" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-start gap-3">
                {/* Animated checkmark */}
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                  <svg className="h-3.5 w-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-emerald-800">
                    Video queued successfully!
                  </p>
                  <p className="mt-0.5 text-xs text-emerald-700">
                    Processing starts in seconds. Your video will appear in the
                    library below and update automatically as it progresses.
                  </p>
                  <p className="mt-2 text-xs text-emerald-600">
                    Credits remaining:{" "}
                    <span className="font-semibold">{state.result.creditsRemaining}</span>
                    {" · "}Job ID:{" "}
                    <span className="font-mono">{state.result.videoId.slice(0, 8)}…</span>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => dispatch({ type: "RESET_STATUS" })}
                  aria-label="Dismiss"
                  className="ml-auto shrink-0 rounded p-0.5 text-emerald-500 transition-colors hover:bg-emerald-100"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* ── Error banner ── */}
          {state.status === "error" && state.errorMessage && (
            <div role="alert" aria-live="assertive" className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
              <div className="flex items-start gap-3">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-red-700">{state.errorMessage}</p>
                  {state.errorCode === "insufficient_credits" && (
                    <button
                      type="button"
                      onClick={() => { dispatch({ type: "RESET_STATUS" }); dispatch({ type: "SHOW_SHOP" }); }}
                      className="mt-2 text-xs font-semibold text-red-700 underline underline-offset-2 hover:text-red-900"
                    >
                      Buy credits →
                    </button>
                  )}
                  {state.errorCode === "network_error" && (
                    <button
                      type="button"
                      onClick={() => dispatch({ type: "RESET_STATUS" })}
                      className="mt-2 text-xs font-semibold text-red-700 underline underline-offset-2 hover:text-red-900"
                    >
                      Dismiss and retry
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "RESET_STATUS" })}
                  aria-label="Dismiss"
                  className="ml-auto shrink-0 rounded p-0.5 text-red-400 transition-colors hover:bg-red-100"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* ── Body: shop | empty state | form ── */}
          {state.showShop ? (
            // Inline credit shop — openable from anywhere (warning banner, empty state, error)
            <CreditShop onClose={() => dispatch({ type: "HIDE_SHOP" })} />
          ) : outOfCredits ? (
            // Zero credits — prominent empty state with buy CTA
            <div className="flex flex-col items-center rounded-xl border border-dashed border-red-200 bg-red-50 px-6 py-10 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-red-700">You&apos;re out of credits</p>
              <p className="mt-1 text-xs text-red-500">
                Top up your balance to keep creating videos.
              </p>
              <button
                type="button"
                onClick={() => dispatch({ type: "SHOW_SHOP" })}
                className="mt-5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
              >
                Buy credits
              </button>
            </div>
          ) : (
            // Main form
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Loading hint */}
              {isLoading && (
                <div role="status" aria-live="polite" className="flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">
                  <svg className="h-4 w-4 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Generating your script and queuing the video…
                </div>
              )}

              {/* Textarea */}
              <div className="relative">
                <label htmlFor="prompt" className="sr-only">Video prompt</label>
                <textarea
                  ref={textareaRef}
                  id="prompt"
                  name="prompt"
                  value={state.prompt}
                  onChange={(e) => dispatch({ type: "SET_PROMPT", payload: e.target.value })}
                  rows={5}
                  maxLength={MAX_CHARS}
                  disabled={isLoading}
                  placeholder="e.g. A 30-second product demo for a mobile app — smooth animations, upbeat music, and a professional voiceover highlighting the top three features…"
                  className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60 transition-all"
                />
                <span
                  className={`pointer-events-none absolute bottom-3 right-3 text-xs tabular-nums ${
                    state.prompt.length > MAX_CHARS * 0.9 ? "text-red-400" : "text-gray-300"
                  }`}
                  aria-label={`${state.prompt.length} of ${MAX_CHARS} characters`}
                >
                  {state.prompt.length}/{MAX_CHARS}
                </span>
              </div>

              {/* Suggestion chips */}
              <div>
                <p className="mb-2 text-xs font-medium text-gray-400">Try a prompt:</p>
                <div className="flex flex-wrap gap-2">
                  {PROMPT_SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={isLoading}
                      onClick={() => { dispatch({ type: "SET_PROMPT", payload: s }); textareaRef.current?.focus(); }}
                      className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-500 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 disabled:pointer-events-none disabled:opacity-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                <p className={`flex items-center gap-1.5 text-xs ${isLow ? "text-amber-600" : "text-gray-400"}`}>
                  <svg className={`h-3.5 w-3.5 ${isLow ? "text-amber-500" : "text-blue-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {isLow
                    ? `Costs 1 credit · Only ${creditBalance} left after this`
                    : "Costs 1 credit · ~2 min to generate"}
                </p>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => dispatch({ type: "SHOW_SHOP" })}
                    disabled={isLoading}
                    className={`text-xs font-medium transition-colors hover:underline disabled:pointer-events-none ${
                      isLow ? "text-amber-600 hover:text-amber-800" : "text-blue-500 hover:text-blue-700"
                    }`}
                  >
                    {isLow ? "Top up →" : "Buy credits"}
                  </button>
                  <GenerateButton disabled={!isValid} loading={isLoading} />
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
