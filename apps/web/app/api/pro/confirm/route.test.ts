import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProErrorResponseSchema, ProMutationResponseSchema } from '@lifeguessr/types';
import { PRO_RATE_LIMITS } from '@/server/pro/http';
import { ENTITLEMENTS_FILE, getEntitlementStore } from '@/server/pro/store';
import {
  ANON,
  FAKE_LIVE_KEY,
  OTHER_ANON,
  paidSession,
  proRequest,
  SESSION_ID,
  stripeNotFound,
  setupProTestEnv,
} from '@/server/pro/testUtils';
import { POST } from './route';

const { create, retrieve } = vi.hoisted(() => ({ create: vi.fn(), retrieve: vi.fn() }));
vi.mock('stripe', () => ({
  default: class {
    checkout = { sessions: { create, retrieve } };
  },
}));

const dataDir = setupProTestEnv();
const confirm = (opts: { sessionId?: string; anonId?: string | null } = {}) =>
  POST(proRequest('/api/pro/confirm', { body: { sessionId: opts.sessionId ?? SESSION_ID }, anonId: opts.anonId }));
const statusOf = async (res: Response) => ProMutationResponseSchema.parse(await res.json()).status;
const errorOf = async (res: Response) => ProErrorResponseSchema.parse(await res.json()).error;

beforeEach(() => {
  retrieve.mockReset();
  retrieve.mockResolvedValue(paidSession());
});

describe('POST /api/pro/confirm', () => {
  it('unlocks Pro for a paid test-mode session started by this anonId', async () => {
    const res = await confirm();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const status = await statusOf(res);
    expect(status).toMatchObject({ pro: true, source: 'stripe_test', plan: 'yearly' });
    expect(retrieve).toHaveBeenCalledWith(SESSION_ID);
    expect(await getEntitlementStore().get(ANON)).toMatchObject({ source: 'stripe_test', plan: 'yearly' });
    expect(create).not.toHaveBeenCalled();
  });

  it('takes the plan from the session metadata Stripe holds', async () => {
    retrieve.mockResolvedValueOnce(paidSession({ metadata: { plan: 'monthly' } }));
    expect(await statusOf(await confirm())).toMatchObject({ plan: 'monthly' });
  });

  it('is idempotent: reloading the success URL returns the same status', async () => {
    const first = await statusOf(await confirm());
    const again = await confirm();
    expect(again.status).toBe(200);
    expect(await statusOf(again)).toEqual(first);
  });

  it('upgrades a promo-code user to the Stripe plan', async () => {
    await getEntitlementStore().grant(ANON, { source: 'demo', since: '2026-11-14T09:00:00.000Z' });
    expect(await statusOf(await confirm())).toMatchObject({ pro: true, source: 'stripe_test', plan: 'yearly' });
  });

  it.each([
    ['still open', { status: 'open', payment_status: 'unpaid' }],
    ['complete but unpaid', { status: 'complete', payment_status: 'unpaid' }],
    ['complete with no payment required', { status: 'complete', payment_status: 'no_payment_required' }],
    ['expired', { status: 'expired', payment_status: 'unpaid' }],
  ])('answers 402 not_paid for a session that is %s', async (_name, over) => {
    retrieve.mockResolvedValueOnce(paidSession(over));
    const res = await confirm();
    expect(res.status).toBe(402);
    expect((await errorOf(res)).code).toBe('not_paid');
    expect(await getEntitlementStore().get(ANON)).toBeNull();
  });

  it('refuses a live-mode session', async () => {
    retrieve.mockResolvedValueOnce(paidSession({ livemode: true }));
    const res = await confirm();
    expect(res.status).toBe(400);
    expect((await errorOf(res)).code).toBe('bad_request');
    expect(await getEntitlementStore().get(ANON)).toBeNull();
  });

  it.each([
    ['another anonId', OTHER_ANON],
    ['no anonId', null],
  ])('answers 409 session_mismatch for a session started by %s', async (_name, owner) => {
    retrieve.mockResolvedValueOnce(paidSession({ client_reference_id: owner }));
    const res = await confirm();
    expect(res.status).toBe(409);
    expect((await errorOf(res)).code).toBe('session_mismatch');
    expect(await getEntitlementStore().get(ANON)).toBeNull();
  });

  it('checks ownership before payment, so a stranger learns nothing about the session', async () => {
    retrieve.mockResolvedValueOnce(paidSession({ client_reference_id: OTHER_ANON, status: 'open', payment_status: 'unpaid' }));
    expect((await confirm()).status).toBe(409);
  });

  it('answers 409 session_mismatch for a session already claimed by another anonId', async () => {
    await getEntitlementStore().claimSession(SESSION_ID, OTHER_ANON, {
      source: 'stripe_test',
      plan: 'yearly',
      since: '2026-11-14T09:00:00.000Z',
    });
    const res = await confirm();
    expect(res.status).toBe(409);
    expect((await errorOf(res)).code).toBe('session_mismatch');
    expect(await getEntitlementStore().get(ANON)).toBeNull();
  });

  it.each([
    ['no metadata', { metadata: null }],
    ['an unknown plan', { metadata: { plan: 'lifetime' } }],
  ])('refuses a session with %s', async (_name, over) => {
    retrieve.mockResolvedValueOnce(paidSession(over));
    expect((await confirm()).status).toBe(400);
  });

  it('answers 400 for a session Stripe does not know', async () => {
    retrieve.mockRejectedValueOnce(stripeNotFound());
    const res = await confirm();
    expect(res.status).toBe(400);
    expect((await errorOf(res)).code).toBe('bad_request');
  });

  it('answers 502 upstream_error when Stripe fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    retrieve.mockRejectedValueOnce(Object.assign(new Error('boom'), { type: 'StripeConnectionError' }));
    const res = await confirm();
    expect(res.status).toBe(502);
    expect((await errorOf(res)).code).toBe('upstream_error');
  });

  it.each([
    ['no Stripe key', ''],
    ['a live key', FAKE_LIVE_KEY],
  ])('answers 503 with %s, never calling Stripe', async (_name, key) => {
    vi.stubEnv('STRIPE_SECRET_KEY', key);
    expect((await confirm()).status).toBe(503);
    expect(retrieve).not.toHaveBeenCalled();
  });

  it.each([
    ['a live-mode id', 'cs_live_a1B2c3D4e5F6g7H8'],
    ['a malformed id', 'cs_test_../../etc'],
  ])('rejects %s with 400 before calling Stripe', async (_name, sessionId) => {
    expect((await confirm({ sessionId })).status).toBe(400);
    expect(retrieve).not.toHaveBeenCalled();
  });

  it('rejects a request without an anonymous id', async () => {
    expect((await confirm({ anonId: null })).status).toBe(400);
    expect(retrieve).not.toHaveBeenCalled();
  });

  it('answers 503 and grants nothing when the store is unreadable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await writeFile(path.join(dataDir(), ENTITLEMENTS_FILE), '{');
    const res = await confirm();
    expect(res.status).toBe(503);
    expect((await errorOf(res)).code).toBe('unavailable');
  });

  it('rate-limits per anonId', async () => {
    for (let i = 0; i < PRO_RATE_LIMITS.confirm.perAnonId.limit; i++) expect((await confirm()).status).toBe(200);
    expect((await confirm()).status).toBe(429);
  });
});
