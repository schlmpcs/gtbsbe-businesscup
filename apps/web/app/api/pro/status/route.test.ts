import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ProErrorResponseSchema, ProStatusResponseSchema } from '@lifeguessr/types';
import { PRO_RATE_LIMITS } from '@/server/pro/http';
import { ENTITLEMENTS_FILE, getEntitlementStore } from '@/server/pro/store';
import { ANON, FAKE_LIVE_KEY, proRequest, setupProTestEnv } from '@/server/pro/testUtils';
import { GET } from './route';

const dataDir = setupProTestEnv();
const get = (opts?: Parameters<typeof proRequest>[1]) => GET(proRequest('/api/pro/status', opts));

describe('GET /api/pro/status', () => {
  it('reports a free user, checkout available and the promo code to show', async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = ProStatusResponseSchema.parse(await res.json());
    expect(body).toEqual({
      ok: true,
      status: { pro: false },
      checkoutAvailable: true,
      demo: { enabled: true, code: 'JURY-DEMO' },
    });
  });

  it('reports a Pro user', async () => {
    const since = '2026-11-14T10:00:00.000Z';
    await getEntitlementStore().claimSession('cs_test_status00001', ANON, { source: 'stripe_test', plan: 'monthly', since });
    const body = ProStatusResponseSchema.parse(await (await get()).json());
    expect(body.status).toEqual({ pro: true, source: 'stripe_test', plan: 'monthly', since });
  });

  it('keeps the promo code back when demo unlock is off, and says when checkout is not set up', async () => {
    vi.stubEnv('PRO_DEMO_UNLOCK', 'off');
    vi.stubEnv('STRIPE_SECRET_KEY', FAKE_LIVE_KEY);
    const body = ProStatusResponseSchema.parse(await (await get()).json());
    expect(body.demo).toEqual({ enabled: false });
    expect(body.checkoutAvailable).toBe(false);
  });

  it('answers 400 without an anonymous id', async () => {
    const res = await get({ anonId: null });
    expect(res.status).toBe(400);
    expect(ProErrorResponseSchema.parse(await res.json()).error.code).toBe('bad_request');
  });

  it('answers 503 when the store is unreadable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await writeFile(path.join(dataDir(), ENTITLEMENTS_FILE), '[]');
    const res = await get();
    expect(res.status).toBe(503);
    expect(ProErrorResponseSchema.parse(await res.json()).error.code).toBe('unavailable');
  });

  it('rate-limits polling per anonId', async () => {
    for (let i = 0; i < PRO_RATE_LIMITS.status.perAnonId.limit; i++) expect((await get()).status).toBe(200);
    expect((await get()).status).toBe(429);
  });
});
