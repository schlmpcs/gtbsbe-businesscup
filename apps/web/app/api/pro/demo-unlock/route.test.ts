import { describe, expect, it, vi } from 'vitest';
import { ProErrorResponseSchema, ProMutationResponseSchema } from '@lifeguessr/types';
import { PRO_RATE_LIMITS } from '@/server/pro/http';
import { getEntitlementStore } from '@/server/pro/store';
import { ANON, proRequest, SESSION_ID, setupProTestEnv } from '@/server/pro/testUtils';
import { POST } from './route';

setupProTestEnv();
const unlock = (body: unknown, anonId?: string | null) => POST(proRequest('/api/pro/demo-unlock', { body, anonId }));
const errorOf = async (res: Response) => ProErrorResponseSchema.parse(await res.json()).error;

describe('POST /api/pro/demo-unlock', () => {
  it('unlocks Pro (source demo, no plan) with the code shown on screen', async () => {
    const res = await unlock({ code: 'JURY-DEMO' });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const { status } = ProMutationResponseSchema.parse(await res.json());
    expect(status).toEqual({ pro: true, source: 'demo', since: expect.any(String) });
    expect(await getEntitlementStore().get(ANON)).toEqual({ source: 'demo', since: expect.any(String) });
  });

  it('accepts the code in any case and with stray spaces', async () => {
    expect((await unlock({ code: '  jury-demo ' })).status).toBe(200);
  });

  it('uses PRO_DEMO_CODE when set', async () => {
    vi.stubEnv('PRO_DEMO_CODE', 'STREAM-2026');
    expect((await unlock({ code: 'JURY-DEMO' })).status).toBe(403);
    expect((await unlock({ code: 'STREAM-2026' })).status).toBe(200);
  });

  it.each(['JURY-DEM', 'JURY-DEMO-2', 'nope'])('answers 403 invalid_code for %j and grants nothing', async (code) => {
    const res = await unlock({ code });
    expect(res.status).toBe(403);
    expect(await errorOf(res)).toEqual({ code: 'invalid_code' });
    expect(await getEntitlementStore().get(ANON)).toBeNull();
  });

  it('answers 403 invalid_code even for the right code when demo unlock is off', async () => {
    vi.stubEnv('PRO_DEMO_UNLOCK', 'off');
    const res = await unlock({ code: 'JURY-DEMO' });
    expect(res.status).toBe(403);
    expect((await errorOf(res)).code).toBe('invalid_code');
  });

  it('never downgrades a Stripe purchase', async () => {
    const paid = { source: 'stripe_test', plan: 'yearly', since: '2026-11-14T09:00:00.000Z' } as const;
    await getEntitlementStore().claimSession(SESSION_ID, ANON, paid);
    const { status } = ProMutationResponseSchema.parse(await (await unlock({ code: 'JURY-DEMO' })).json());
    expect(status).toEqual({ pro: true, ...paid });
  });

  it('rate-limits guessing per anonId, so even the right code waits', async () => {
    const { limit } = PRO_RATE_LIMITS.demoUnlock.perAnonId;
    for (let i = 0; i < limit; i++) expect((await unlock({ code: `GUESS-${i}` })).status).toBe(403);
    const res = await unlock({ code: 'JURY-DEMO' });
    expect(res.status).toBe(429);
    expect((await errorOf(res)).retryAfterSeconds).toBeGreaterThan(0);
  });

  it.each([
    ['an empty code', { code: '   ' }],
    ['a code over 64 characters', { code: 'X'.repeat(65) }],
    ['no code', {}],
  ])('rejects %s with 400', async (_name, body) => {
    const res = await unlock(body);
    expect(res.status).toBe(400);
    expect((await errorOf(res)).code).toBe('bad_request');
  });

  it('rejects a request without an anonymous id', async () => {
    expect((await unlock({ code: 'JURY-DEMO' }, null)).status).toBe(400);
  });
});
