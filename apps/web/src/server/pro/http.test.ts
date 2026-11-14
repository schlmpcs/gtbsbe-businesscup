import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProErrorResponseSchema } from '@lifeguessr/types';
import { guardProRequest, PRO_RATE_LIMITS, proRateLimiter, requirePro } from './http';
import { ENTITLEMENTS_FILE, getEntitlementStore } from './store';
import { ANON, proRequest, tempDir } from './testUtils';

let dir: string;
let cleanup: () => Promise<void>;
beforeEach(async () => {
  ({ dir, cleanup } = await tempDir());
  vi.stubEnv('PRO_DATA_DIR', dir);
  proRateLimiter.reset();
});
afterEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await cleanup();
});

async function errorOf(res: Response) {
  return ProErrorResponseSchema.parse(await res.json()).error;
}

describe('guardProRequest', () => {
  it.each([
    ['missing', null],
    ['too short', 'abc'],
    ['with odd characters', '0f8e2b4c/1d2e?4f5a'],
  ])('answers 400 when x-anon-id is %s', async (_name, anonId) => {
    const gate = guardProRequest(proRequest('/api/pro/status', { anonId }), 'status');
    if (!('response' in gate)) throw new Error('expected a response');
    expect(gate.response.status).toBe(400);
    expect((await errorOf(gate.response)).code).toBe('bad_request');
  });

  it('passes a valid anonId through', () => {
    expect(guardProRequest(proRequest('/api/pro/status'), 'status')).toEqual({ anonId: ANON });
  });

  it('limits per anonId with 429, Retry-After and retryAfterSeconds, per route', async () => {
    const { limit } = PRO_RATE_LIMITS.demoUnlock.perAnonId;
    for (let i = 0; i < limit; i++) {
      expect(guardProRequest(proRequest('/api/pro/demo-unlock'), 'demoUnlock')).toEqual({ anonId: ANON });
    }
    const gate = guardProRequest(proRequest('/api/pro/demo-unlock'), 'demoUnlock');
    if (!('response' in gate)) throw new Error('expected a response');
    expect(gate.response.status).toBe(429);
    const retryAfter = Number(gate.response.headers.get('retry-after'));
    expect(retryAfter).toBeGreaterThan(0);
    expect(await errorOf(gate.response)).toEqual({ code: 'rate_limited', retryAfterSeconds: retryAfter });

    // Another route keeps its own budget.
    expect(guardProRequest(proRequest('/api/pro/status'), 'status')).toEqual({ anonId: ANON });
  });

  it('limits per IP even when the anonId changes', () => {
    const ip = { 'x-forwarded-for': '203.0.113.9' };
    const { limit } = PRO_RATE_LIMITS.demoUnlock.perIp;
    for (let i = 0; i < limit; i++) {
      const anonId = `anon-${String(i).padStart(8, '0')}`;
      expect(guardProRequest(proRequest('/api/pro/demo-unlock', { anonId, headers: ip }), 'demoUnlock')).toEqual({ anonId });
    }
    const gate = guardProRequest(proRequest('/api/pro/demo-unlock', { anonId: 'anon-fresh-0001', headers: ip }), 'demoUnlock');
    expect('response' in gate && gate.response.status).toBe(429);
  });
});

describe('requirePro', () => {
  it('answers 400 without a valid anonId', async () => {
    const result = await requirePro(proRequest('/api/session', { anonId: null }));
    expect('response' in result && result.response.status).toBe(400);
  });

  it('answers 402 not_paid for a free user', async () => {
    const result = await requirePro(proRequest('/api/session'));
    if (!('response' in result)) throw new Error('expected a response');
    expect(result.response.status).toBe(402);
    expect((await errorOf(result.response)).code).toBe('not_paid');
  });

  it('lets a Pro user through', async () => {
    await getEntitlementStore().grant(ANON, { source: 'demo', since: '2026-11-14T10:00:00.000Z' });
    expect(await requirePro(proRequest('/api/session'))).toEqual({ anonId: ANON });
  });

  it('fails closed with 503 when the store is unreadable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await writeFile(path.join(dir, ENTITLEMENTS_FILE), 'not json');
    const result = await requirePro(proRequest('/api/session'));
    if (!('response' in result)) throw new Error('expected a response');
    expect(result.response.status).toBe(503);
    expect((await errorOf(result.response)).code).toBe('unavailable');
  });
});
