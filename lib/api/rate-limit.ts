/**
 * In-process sliding-window rate limiter.
 *
 * State lives in a single Map per process — not shared across Vercel Lambda
 * instances. This means the effective limit is per-instance, not per-user
 * globally. It reliably stops runaway single-client abuse (tight loops, scripts)
 * and is zero-dependency.
 *
 * For strict multi-region enforcement, swap `HitStore` for an Upstash Redis
 * client and replace `addHit` / `getHits` with ZADD / ZRANGEBYSCORE calls.
 *
 * Usage:
 *   const { allowed, retryAfterSec } = rateLimit(`gen:${userId}`, 5, 60_000);
 *   if (!allowed) return Errors.tooManyRequests(retryAfterSec);
 */

// ── In-memory store ───────────────────────────────────────────────────────────

/** Maps rate-limit key → sorted list of hit timestamps (ms). */
const store = new Map<string, number[]>();

/**
 * Periodically evict expired entries so the Map does not grow unboundedly in
 * long-lived processes. Runs at most once per 5 minutes.
 */
let lastEvict = 0;
function maybeEvict(windowMs: number) {
  const now = Date.now();
  if (now - lastEvict < 300_000) return;
  lastEvict = now;
  for (const [key, hits] of store) {
    const fresh = hits.filter((t) => t > now - windowMs);
    if (fresh.length === 0) store.delete(key);
    else store.set(key, fresh);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface RateLimitResult {
  allowed:       boolean;
  /** Remaining hits allowed in the current window. */
  remaining:     number;
  /** Seconds until the oldest hit expires — only meaningful when !allowed. */
  retryAfterSec: number;
}

/**
 * Records a hit for `key` and returns whether it is within the allowed limit.
 *
 * @param key       Unique string per (action, subject) — e.g. `gen:${userId}`
 * @param limit     Max hits allowed in the window
 * @param windowMs  Rolling window size in milliseconds
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  maybeEvict(windowMs);

  const now  = Date.now();
  const hits = (store.get(key) ?? []).filter((t) => t > now - windowMs);

  if (hits.length >= limit) {
    const retryAfterSec = Math.ceil((hits[0] + windowMs - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSec };
  }

  hits.push(now);
  store.set(key, hits);

  return { allowed: true, remaining: limit - hits.length, retryAfterSec: 0 };
}
