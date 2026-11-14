import { describe, expect, it, vi } from 'vitest';
import { ProErrorResponseSchema, ProMutationResponseSchema } from '@lifeguessr/types';
import { PRO_RATE_LIMITS } from '@/server/pro/http';
import { getEntitlementStore } from '@/server/pro/store';
import { ANON, OTHER_ANON, proRequest, SESSION_ID, setupProTestEnv } from '@/server/pro/testUtils';
import { POST } from './route';

const { recordServerEvent } = vi.hoisted(() => ({ recordServerEvent: vi.fn(async () => {}) }));
vi.mock('@/server/events/http', () => ({ recordServerEvent }));

setupProTestEnv();
const pay = (body: unknown, anonId?: string | null) => POST(proRequest('/api/pro/demo-checkout', { body, anonId }));
const statusOf = async (res: Response) => ProMutationResponseSchema.parse(await res.json()).status;
const errorOf = async (res: Response) => ProErrorResponseSchema.parse(await res.json()).error;

describe('POST /api/pro/demo-checkout', () => {
  it.each(['yearly', 'monthly'] as const)('unlocks Pro with source demo_checkout and the %s plan', async (plan) => {
    recordServerEvent.mockClear();
    const res = await pay({ plan });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await statusOf(res)).toEqual({ pro: true, source: 'demo_checkout', plan, since: expect.any(String) });
    expect(await getEntitlementStore().get(ANON)).toEqual({ source: 'demo_checkout', plan, since: expect.any(String) });
    expect(recordServerEvent).toHaveBeenCalledWith(ANON, { name: 'pro_demo_purchased', props: { plan } });
  });

  it('works without any Stripe key', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', '');
    expect((await pay({ plan: 'yearly' })).status).toBe(200);
  });

  it('upgrades a promo-code user to the plan they paid for', async () => {
    await getEntitlementStore().grant(ANON, { source: 'demo', since: '2026-11-14T09:00:00.000Z' });
    expect(await statusOf(await pay({ plan: 'monthly' }))).toMatchObject({ source: 'demo_checkout', plan: 'monthly' });
  });

  it('never downgrades a Stripe purchase, and still answers with what is in effect', async () => {
    const paid = { source: 'stripe_test', plan: 'yearly', since: '2026-11-14T09:00:00.000Z' } as const;
    await getEntitlementStore().claimSession(SESSION_ID, ANON, paid);
    expect(await statusOf(await pay({ plan: 'monthly' }))).toEqual({ pro: true, ...paid });
  });

  it('gives Pro only to the anonId that paid', async () => {
    await pay({ plan: 'yearly' });
    expect(await getEntitlementStore().get(OTHER_ANON)).toBeNull();
  });

  it.each([
    ['no plan', {}],
    ['an unknown plan', { plan: 'weekly' }],
    ['card-like extra fields', { plan: 'yearly', card: '4242 4242 4242 4242', cvc: '123' }],
    ['a plan that is not a string', { plan: 7 }],
  ])('answers 400 bad_request for %s and grants nothing', async (_name, body) => {
    const res = await pay(body);
    expect(res.status).toBe(400);
    expect((await errorOf(res)).code).toBe('bad_request');
    expect(await getEntitlementStore().get(ANON)).toBeNull();
  });

  it('answers 400 bad_request without a well-formed x-anon-id', async () => {
    const res = await pay({ plan: 'yearly' }, null);
    expect(res.status).toBe(400);
    expect((await errorOf(res)).code).toBe('bad_request');
  });

  it('answers 503 unavailable and grants nothing when demo unlock is switched off', async () => {
    vi.stubEnv('PRO_DEMO_UNLOCK', 'off');
    recordServerEvent.mockClear();
    const res = await pay({ plan: 'yearly' });
    expect(res.status).toBe(503);
    expect((await errorOf(res)).code).toBe('unavailable');
    expect(await getEntitlementStore().get(ANON)).toBeNull();
    expect(recordServerEvent).not.toHaveBeenCalled();
  });

  it('rate-limits per anonId', async () => {
    const { limit } = PRO_RATE_LIMITS.demoCheckout.perAnonId;
    for (let i = 0; i < limit; i++) expect((await pay({ plan: 'yearly' })).status).toBe(200);
    const res = await pay({ plan: 'yearly' });
    expect(res.status).toBe(429);
    expect((await errorOf(res)).retryAfterSeconds).toBeGreaterThan(0);
  });
});
