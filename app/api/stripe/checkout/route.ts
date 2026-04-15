import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/client";
import { CREDIT_PACKS } from "@/lib/stripe/products";
import { apiSuccess, Errors } from "@/lib/api/response";
import { rateLimit } from "@/lib/api/rate-limit";
import { logger } from "@/lib/api/logger";
import { z } from "zod";

const ALLOWED_ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? "";

const bodySchema = z.object({
  packId: z.string({ error: "packId is required." }),
});

/**
 * POST /api/stripe/checkout
 *
 * Body: { packId: "starter" | "creator" | "pro" }
 * Returns: { data: { url: string } }  — redirect the browser to this URL.
 *
 * The user_id is stored in session metadata so the webhook can grant credits
 * after payment without needing to pass it through the redirect URL.
 */
export async function POST(req: Request) {
  const start = Date.now();
  logger.request(req);

  // ── Auth ────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    logger.response(req, 401, Date.now() - start);
    return Errors.unauthorized();
  }

  // ── Rate limit — 5 checkout sessions per user per minute ────────────────
  const rl = rateLimit(`checkout:${user.id}`, 5, 60_000);
  if (!rl.allowed) {
    logger.warn("checkout:rate-limited", { userId: user.id });
    return Errors.tooManyRequests(rl.retryAfterSec);
  }

  // ── Validate origin to prevent open redirects ────────────────────────────
  const origin = req.headers.get("origin") ?? "";
  if (ALLOWED_ORIGIN && origin !== ALLOWED_ORIGIN) {
    logger.warn("checkout:invalid-origin", { origin, expected: ALLOWED_ORIGIN });
    return Errors.forbidden();
  }

  // ── Parse body ──────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Errors.badRequest("Request body must be valid JSON.");
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Errors.validationError(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  // ── Find the requested pack ──────────────────────────────────────────────
  const pack = CREDIT_PACKS.find((p) => p.id === parsed.data.packId);
  if (!pack) {
    return Errors.notFound("Credit pack");
  }

  if (!pack.stripePriceId) {
    logger.error("Stripe Price ID not configured", { packId: pack.id });
    return Errors.internal(`Stripe Price ID for "${pack.id}" is not configured.`);
  }

  // ── Create Stripe Checkout session ──────────────────────────────────────
  // `origin` is already validated and declared above.

  let session;
  try {
    session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: pack.stripePriceId, quantity: 1 }],
      success_url: `${origin}/dashboard?payment=success&credits=${pack.credits}`,
      cancel_url:  `${origin}/dashboard?payment=cancelled`,
      customer_email: user.email,
      metadata: {
        user_id:    user.id,
        pack_id:    pack.id,
        credits:    String(pack.credits),
      },
      payment_intent_data: {
        metadata: {
          user_id: user.id,
          pack_id: pack.id,
        },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Stripe checkout session creation failed", { userId: user.id, error: message });
    return Errors.internal("Payment service is temporarily unavailable. Please try again.");
  }

  if (!session.url) {
    logger.error("Stripe returned no checkout URL", { sessionId: session.id });
    return Errors.internal("Failed to create Stripe checkout session.");
  }

  logger.response(req, 200, Date.now() - start, {
    userId: user.id,
    packId: pack.id,
    sessionId: session.id,
  });

  return apiSuccess({ url: session.url });
}
