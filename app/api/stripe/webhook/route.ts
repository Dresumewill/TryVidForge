import { getStripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPackByPriceId } from "@/lib/stripe/products";
import { logger } from "@/lib/api/logger";
import { Errors } from "@/lib/api/response";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

/**
 * POST /api/stripe/webhook
 *
 * Receives Stripe events and fulfils credit grants after successful payment.
 *
 * Setup:
 *   stripe listen --forward-to localhost:3000/api/stripe/webhook
 *   Set STRIPE_WEBHOOK_SECRET to the signing secret shown by the CLI.
 *
 * In production, set the webhook endpoint in:
 *   Stripe Dashboard → Developers → Webhooks → Add endpoint
 *   Events to listen for: checkout.session.completed
 */
export async function POST(req: Request) {
  const body = await req.text(); // Must use raw body for signature verification
  const sig  = req.headers.get("stripe-signature");

  if (!sig) {
    logger.warn("Webhook received without stripe-signature header");
    return Errors.badRequest("Missing stripe-signature.");
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    logger.error("STRIPE_WEBHOOK_SECRET is not set");
    return Errors.internal("Webhook secret not configured.");
  }

  // ── Verify signature ────────────────────────────────────────────────────
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.warn("Stripe webhook signature verification failed", { message });
    return new NextResponse(`Webhook signature invalid: ${message}`, { status: 400 });
  }

  logger.info("Stripe webhook received", { type: event.type, id: event.id });

  // ── Handle events ────────────────────────────────────────────────────────
  if (event.type === "checkout.session.completed") {
    await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
  }
  // Add other event types here as needed (e.g. payment_intent.payment_failed)

  // Always return 200 — Stripe retries on non-2xx responses.
  return new NextResponse(null, { status: 200 });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId  = session.metadata?.user_id;
  const credits = Number(session.metadata?.credits ?? 0);
  const packId  = session.metadata?.pack_id;

  if (!userId || !credits) {
    logger.error("checkout.session.completed missing metadata", {
      sessionId: session.id,
      metadata: session.metadata,
    });
    return;
  }

  // Verify the paid amount matches a known pack (prevents metadata tampering)
  const lineItems = await getStripe().checkout.sessions.listLineItems(session.id, {
    limit: 1,
  });
  const priceId = lineItems.data[0]?.price?.id;
  const pack = priceId ? getPackByPriceId(priceId) : undefined;

  if (!pack) {
    logger.error("Could not resolve pack from Stripe line item", {
      sessionId: session.id,
      priceId,
    });
    return;
  }

  if (pack.credits !== credits) {
    logger.error("Credit amount in metadata doesn't match pack", {
      metadataCredits: credits,
      packCredits: pack.credits,
    });
    return;
  }

  // ── Grant credits using service-role client (bypasses RLS) ──────────────
  // p_stripe_session_id is the idempotency key — if Stripe retries this
  // webhook, the DB function detects the duplicate and returns early without
  // re-granting credits.
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).rpc("grant_credits", {
    p_user_id:           userId,
    p_amount:            pack.credits,
    p_reason:            `stripe_purchase_${packId}`,
    p_stripe_session_id: session.id,
  });

  if (error) {
    logger.error("grant_credits RPC failed", {
      sessionId: session.id,
      userId,
      error: error.message,
    });
    return;
  }

  const result = data as { ok: boolean; duplicate?: boolean } | null;

  if (result?.duplicate) {
    logger.warn("Duplicate webhook — session already processed, skipping", {
      sessionId: session.id,
      userId,
    });
    return;
  }

  logger.info("Credits granted successfully", {
    sessionId: session.id,
    userId,
    credits: pack.credits,
  });
}
