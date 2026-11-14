import { describe, expect, it } from 'vitest';
import { createRateLimiter } from './rateLimit';

const rule = { limit: 2, windowMs: 1_000 };

describe('createRateLimiter', () => {
  it('allows `limit` requests per window, then reports when to retry', () => {
    const rl = createRateLimiter();
    const keys = [{ key: 'ip:a', rule }];
    expect(rl.check(keys, 0)).toEqual({ ok: true });
    expect(rl.check(keys, 100)).toEqual({ ok: true });
    expect(rl.check(keys, 200)).toEqual({ ok: false, retryAfterSeconds: 1 });
    expect(rl.check(keys, 1_000)).toEqual({ ok: true }); // new window
  });

  it('charges every key or none', () => {
    const rl = createRateLimiter();
    const ip = { key: 'ip:a', rule: { limit: 3, windowMs: 1_000 } };
    const anon = { key: 'anon:x', rule: { limit: 1, windowMs: 1_000 } };
    expect(rl.check([ip, anon], 0).ok).toBe(true);
    expect(rl.check([ip, anon], 1).ok).toBe(false); // anon is out
    // The rejected request didn't use up the IP budget: two more fit under ip's limit of 3.
    expect(rl.check([ip], 2).ok).toBe(true);
    expect(rl.check([ip], 3).ok).toBe(true);
    expect(rl.check([ip], 4).ok).toBe(false);
  });

  it('keeps keys independent', () => {
    const rl = createRateLimiter();
    expect(rl.check([{ key: 'anon:x', rule: { limit: 1, windowMs: 1_000 } }], 0).ok).toBe(true);
    expect(rl.check([{ key: 'anon:y', rule: { limit: 1, windowMs: 1_000 } }], 0).ok).toBe(true);
  });
});
