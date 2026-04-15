import Stripe from "stripe";

let _stripe: Stripe | null = null;

/**
 * Returns the Stripe server-side client.
 * Initialised lazily so `next build` doesn't throw when the env var is absent.
 * The env var is required at runtime — any request to a Stripe route will fail
 * fast with a clear error if it is not set.
 */
export function getStripe(): Stripe {
  if (_stripe) return _stripe;

  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error(
      "Missing STRIPE_SECRET_KEY environment variable. " +
        "Add it to .env.local (dev) or your deployment environment (prod)."
    );
  }

  _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2026-03-25.dahlia",
    typescript: true,
  });

  return _stripe;
}
