/**
 * Credit pack definitions.
 *
 * Each pack maps to a Stripe Price ID stored in env vars.
 * Prices must be created in the Stripe Dashboard with EUR currency:
 *   Dashboard → Products → Add product → Add price
 *   Currency: EUR, Type: One time, Amount: matching priceCents below
 *   Copy the Price ID (price_xxx) into your env vars.
 */

export interface CreditPack {
  id: string;
  name: string;
  credits: number;
  /** Price in minor currency units (cents / eurocents) */
  priceCents: number;
  currency: "EUR";
  /** Stripe Price ID — set in environment variables */
  stripePriceId: string;
  badge?: string;
  description: string;
}

export const CREDIT_PACKS: CreditPack[] = [
  {
    id: "starter",
    name: "Starter",
    credits: 50,
    priceCents: 1000, // €10.00
    currency: "EUR",
    stripePriceId: process.env.STRIPE_PRICE_STARTER ?? "",
    description: "Great for trying things out",
  },
  {
    id: "creator",
    name: "Creator",
    credits: 150,
    priceCents: 2500, // €25.00
    currency: "EUR",
    stripePriceId: process.env.STRIPE_PRICE_CREATOR ?? "",
    badge: "Best Value",
    description: "Most popular for regular creators",
  },
];

/** Returns the pack matching a Stripe Price ID, or undefined. */
export function getPackByPriceId(priceId: string): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.stripePriceId === priceId);
}

/** Formats a price in minor units to a display string, e.g. 1000 → "€10" */
export function formatPrice(pack: Pick<CreditPack, "priceCents" | "currency">): string {
  const symbol = pack.currency === "EUR" ? "€" : "$";
  const amount = pack.priceCents / 100;
  return `${symbol}${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
}
