import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProCheckoutResponseSchema, ProErrorResponseSchema } from '@lifeguessr/types';
import { PRO_RATE_LIMITS } from '@/server/pro/http';
import { ANON, FAKE_LIVE_KEY, FAKE_TEST_KEY, proRequest, TEST_APP_URL, setupProTestEnv } from '@/server/pro/testUtils';
import { POST } from './route';

const { create, retrieve, construct } = vi.hoisted(() => ({ create: vi.fn(), retrieve: vi.fn(), construct: vi.fn() }));
vi.mock('stripe', () => ({
  default: class {
    checkout = { sessions: { create, retrieve } };
    constructor(...args: unknown[]) {
      construct(...args);
    }
  },
}));

setupProTestEnv();
const CHECKOUT_URL = 'https://checkout.stripe.com/c/pay/cs_test_a1B2c3D4e5F6g7H8';
const post = (body: unknown, opts: Omit<NonNullable<Parameters<typeof proRequest>[1]>, 'body'> = {}) =>
  POST(proRequest('/api/pro/checkout', { body, ...opts }));
const errorOf = async (res: Response) => ProErrorResponseSchema.parse(await res.json()).error;

beforeEach(() => {
  create.mockReset();
  create.mockResolvedValue({ id: 'cs_test_a1B2c3D4e5F6g7H8', url: CHECKOUT_URL });
});

describe('POST /api/pro/checkout', () => {
  it.each([
    ['yearly', 3_999, 'year'],
    ['monthly', 699, 'month'],
  ] as const)('creates a %s test-mode subscription Checkout Session at the shared price', async (plan, cents, interval) => {
    const res = await post({ plan });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(ProCheckoutResponseSchema.parse(await res.json())).toEqual({ ok: true, url: CHECKOUT_URL });

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toEqual({
      mode: 'subscription',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: cents,
            recurring: { interval },
            product_data: { name: 'LifeGuessr Pro (demo, test mode)' },
          },
        },
      ],
      client_reference_id: ANON,
      metadata: { plan },
      success_url: `${TEST_APP_URL}/pro?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${TEST_APP_URL}/pro?checkout=cancelled`,
    });
  });

  it('builds the Stripe client from the configured test key, once per key', async () => {
    const rotated = `${FAKE_TEST_KEY}Rotated`;
    vi.stubEnv('STRIPE_SECRET_KEY', rotated);
    construct.mockClear();
    await post({ plan: 'yearly' });
    await post({ plan: 'monthly' });
    expect(construct).toHaveBeenCalledTimes(1);
    expect(construct).toHaveBeenCalledWith(rotated, expect.objectContaining({ maxNetworkRetries: 1 }));
  });

  it('builds the return URLs from the proxy headers when APP_URL is unset', async () => {
    vi.stubEnv('APP_URL', '');
    await post({ plan: 'yearly' }, { headers: { 'x-forwarded-proto': 'https', 'x-forwarded-host': 'demo.example.test' } });
    const params = create.mock.calls[0][0];
    expect(params.success_url).toBe('https://demo.example.test/pro?checkout=success&session_id={CHECKOUT_SESSION_ID}');
    expect(params.cancel_url).toBe('https://demo.example.test/pro?checkout=cancelled');
  });

  it.each([
    ['no Stripe key', ''],
    ['a live key', FAKE_LIVE_KEY],
    ['garbage', 'whatever'],
  ])('answers 503 unavailable with %s, never calling Stripe', async (_name, key) => {
    vi.stubEnv('STRIPE_SECRET_KEY', key);
    const res = await post({ plan: 'yearly' });
    expect(res.status).toBe(503);
    expect(await errorOf(res)).toEqual({ code: 'unavailable' });
    expect(create).not.toHaveBeenCalled();
  });

  it('answers 503 when APP_URL is not usable', async () => {
    vi.stubEnv('APP_URL', 'not a url');
    expect((await post({ plan: 'yearly' })).status).toBe(503);
    expect(create).not.toHaveBeenCalled();
  });

  it('answers 502 upstream_error when Stripe fails, logging no key', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    create.mockRejectedValueOnce(
      Object.assign(new Error(`Invalid API Key provided: ${FAKE_TEST_KEY}`), { type: 'StripeAuthenticationError', statusCode: 401 }),
    );
    const res = await post({ plan: 'monthly' });
    expect(res.status).toBe(502);
    expect(await errorOf(res)).toEqual({ code: 'upstream_error' });
    expect(error).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(error.mock.calls);
    expect(logged).toContain('StripeAuthenticationError');
    expect(logged).not.toContain(FAKE_TEST_KEY);
    expect(logged).not.toContain(ANON);
  });

  it('answers 502 when Stripe returns a session without a URL', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    create.mockResolvedValueOnce({ id: 'cs_test_a1B2c3D4e5F6g7H8', url: null });
    expect((await post({ plan: 'yearly' })).status).toBe(502);
  });

  it('ignores a price sent by the client: the amount always comes from PRO_PRICES', async () => {
    expect((await post({ plan: 'yearly', amount: 0.01, unit_amount: 1 })).status).toBe(200);
    expect(create.mock.calls[0][0].line_items[0].price_data.unit_amount).toBe(3_999);
  });

  it.each([
    ['an unknown plan', { plan: 'lifetime' }],
    ['a missing plan', {}],
    ['malformed JSON', '{"plan":'],
  ])('rejects %s with 400', async (_name, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect((await errorOf(res)).code).toBe('bad_request');
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects a request without an anonymous id', async () => {
    expect((await post({ plan: 'yearly' }, { anonId: null })).status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('rate-limits per anonId', async () => {
    for (let i = 0; i < PRO_RATE_LIMITS.checkout.perAnonId.limit; i++) expect((await post({ plan: 'yearly' })).status).toBe(200);
    const res = await post({ plan: 'yearly' });
    expect(res.status).toBe(429);
    expect((await errorOf(res)).code).toBe('rate_limited');
  });
});
