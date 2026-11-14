// Server-only: a small in-memory fixed-window rate limiter (docs/ARCHITECTURE.md → Server routes).
//
// State lives in the process, so on a serverless host each instance counts on its own. That is
// fine for a hackathon-scale demo: the goal is to stop one client from burning LLM calls, not to
// be an exact global quota. Swap the Map for the shared store if that ever matters.

export type RateLimitRule = {
  /** Requests allowed per window. */
  limit: number;
  windowMs: number;
};

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number };

type Bucket = { count: number; resetAt: number };

/** Upper bound on tracked keys so a flood of random IDs can't grow memory without limit. */
const MAX_KEYS = 10_000;

export type RateLimiter = {
  /**
   * Counts one request against every key (all must have room, or none is charged).
   * Keys are namespaced by the caller, e.g. `ip:1.2.3.4` and `anon:<uuid>`.
   */
  check(keys: readonly { key: string; rule: RateLimitRule }[], now?: number): RateLimitResult;
  /** Test helper: forget every bucket. */
  reset(): void;
};

export function createRateLimiter(): RateLimiter {
  const buckets = new Map<string, Bucket>();

  const prune = (now: number) => {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
    // Still full after dropping expired windows: drop the oldest entries (Map keeps insertion order).
    while (buckets.size >= MAX_KEYS) {
      const oldest = buckets.keys().next().value;
      if (oldest === undefined) break;
      buckets.delete(oldest);
    }
  };

  return {
    check(keys, now = Date.now()) {
      if (buckets.size >= MAX_KEYS) prune(now);

      let retryAfterMs = 0;
      const live: Bucket[] = [];
      for (const { key, rule } of keys) {
        let bucket = buckets.get(key);
        if (!bucket || bucket.resetAt <= now) {
          bucket = { count: 0, resetAt: now + rule.windowMs };
          buckets.set(key, bucket);
        }
        if (bucket.count >= rule.limit) retryAfterMs = Math.max(retryAfterMs, bucket.resetAt - now);
        live.push(bucket);
      }
      if (retryAfterMs > 0) return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
      for (const bucket of live) bucket.count += 1;
      return { ok: true };
    },
    reset() {
      buckets.clear();
    },
  };
}
