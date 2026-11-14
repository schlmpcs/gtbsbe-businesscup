import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, ANON_ID_HEADER } from './http';
import { createHttpProAdapter, toProFailure } from './pro';

const ANON = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const SESSION = 'cs_test_a1B2c3D4e5F6';

type Reply = { status?: number; body?: unknown } | 'offline';

/** Stub fetch with one reply per call; returns the mock to inspect requests. */
function stubFetch(...replies: Reply[]) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => {
    const reply = replies.shift() ?? { status: 500 };
    if (reply === 'offline') throw new TypeError('Failed to fetch');
    const status = reply.status ?? 200;
    const text = reply.body === undefined ? 'not json' : JSON.stringify(reply.body);
    return new Response(text, { status, headers: { 'content-type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const adapter = () => createHttpProAdapter({ anonId: () => ANON });
const requestOf = (fetchMock: ReturnType<typeof stubFetch>, call = 0) => {
  const [url, init] = fetchMock.mock.calls[call]!;
  return { url, method: init?.method, anonId: new Headers(init?.headers).get(ANON_ID_HEADER), body: init?.body ? JSON.parse(String(init.body)) : undefined };
};

afterEach(() => vi.unstubAllGlobals());

describe('createHttpProAdapter', () => {
  it('status: GET with the anonymous id header, validated by the shared schema', async () => {
    const fetchMock = stubFetch({ body: { ok: true, status: { pro: false }, checkoutAvailable: false, demo: { enabled: true, code: 'JURY' } } });
    const res = await adapter().status();
    expect(res).toEqual({ ok: true, value: { status: { pro: false }, checkoutAvailable: false, demo: { enabled: true, code: 'JURY' } } });
    expect(requestOf(fetchMock)).toMatchObject({ url: '/api/pro/status', method: 'GET', anonId: ANON });
  });

  it('startCheckout posts the plan and returns the Stripe URL', async () => {
    const fetchMock = stubFetch({ body: { ok: true, url: 'https://checkout.stripe.com/c/pay/cs_test_x' } });
    expect(await adapter().startCheckout('monthly')).toEqual({ ok: true, value: 'https://checkout.stripe.com/c/pay/cs_test_x' });
    expect(requestOf(fetchMock)).toMatchObject({ url: '/api/pro/checkout', method: 'POST', anonId: ANON, body: { plan: 'monthly' } });
  });

  it('confirm and demoUnlock return the new status; the code is trimmed', async () => {
    const pro = { pro: true, source: 'demo', since: '2026-11-14T12:00:00.000Z' };
    const fetchMock = stubFetch({ body: { ok: true, status: pro } }, { body: { ok: true, status: pro } });
    expect(await adapter().confirm(SESSION)).toEqual({ ok: true, value: pro });
    expect(await adapter().demoUnlock('  JURY  ')).toEqual({ ok: true, value: pro });
    expect(requestOf(fetchMock, 0)).toMatchObject({ url: '/api/pro/confirm', body: { sessionId: SESSION } });
    expect(requestOf(fetchMock, 1)).toMatchObject({ url: '/api/pro/demo-unlock', body: { code: 'JURY' } });
  });

  it('demoCheckout posts only the plan and returns the new status', async () => {
    const pro = { pro: true, source: 'demo_checkout', plan: 'monthly', since: '2026-11-14T12:00:00.000Z' };
    const fetchMock = stubFetch({ body: { ok: true, status: pro } });
    expect(await adapter().demoCheckout('monthly')).toEqual({ ok: true, value: pro });
    expect(requestOf(fetchMock)).toMatchObject({ url: '/api/pro/demo-checkout', method: 'POST', anonId: ANON, body: { plan: 'monthly' } });
    expect(Object.keys(requestOf(fetchMock).body)).toEqual(['plan']);
  });

  it('demoCheckout maps a switched-off checkout (503) to unavailable', async () => {
    stubFetch({ status: 503, body: { ok: false, error: { code: 'unavailable' } } });
    expect(await adapter().demoCheckout('yearly')).toEqual({ ok: false, error: { kind: 'unavailable' } });
  });

  it('rejects requests that break the contract without sending them', async () => {
    const fetchMock = stubFetch();
    const a = adapter();
    expect(await a.demoCheckout('weekly' as never)).toEqual({ ok: false, error: { kind: 'badRequest' } });
    expect(await a.confirm('cs_live_a1B2c3D4e5F6')).toEqual({ ok: false, error: { kind: 'badRequest' } });
    expect(await a.demoUnlock('   ')).toEqual({ ok: false, error: { kind: 'badRequest' } });
    expect(await a.startCheckout('weekly' as never)).toEqual({ ok: false, error: { kind: 'badRequest' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps failures to typed results and never throws', async () => {
    stubFetch(
      { status: 429, body: { ok: false, error: { code: 'rate_limited', retryAfterSeconds: 7.2 } } },
      { status: 403, body: { ok: false, error: { code: 'invalid_code' } } },
      'offline',
      { body: { ok: true, status: { pro: 'yes' } } },
      { status: 404 },
    );
    const a = adapter();
    expect(await a.status()).toEqual({ ok: false, error: { kind: 'rateLimited', retryAfterSeconds: 8 } });
    expect(await a.demoUnlock('NOPE')).toEqual({ ok: false, error: { kind: 'invalidCode' } });
    expect(await a.status()).toEqual({ ok: false, error: { kind: 'network' } });
    expect(await a.confirm(SESSION)).toEqual({ ok: false, error: { kind: 'invalidResponse' } });
    expect(await a.startCheckout('yearly')).toEqual({ ok: false, error: { kind: 'unavailable' } });
  });
});

describe('toProFailure', () => {
  const api = (status: number, body?: unknown) => new ApiError('x', status, false, body);

  it('uses the error code first', () => {
    expect(toProFailure(api(400, { ok: false, error: { code: 'not_paid' } }))).toEqual({ kind: 'notPaid' });
    expect(toProFailure(api(409, { ok: false, error: { code: 'session_mismatch' } }))).toEqual({ kind: 'sessionMismatch' });
    expect(toProFailure(api(413, { ok: false, error: { code: 'too_large' } }))).toEqual({ kind: 'badRequest' });
    expect(toProFailure(api(502, { ok: false, error: { code: 'upstream_error' } }))).toEqual({ kind: 'upstream' });
    expect(toProFailure(api(503, { ok: false, error: { code: 'unavailable' } }))).toEqual({ kind: 'unavailable' });
  });

  it('falls back to the HTTP status when the body is not a Pro error', () => {
    expect(toProFailure(api(402))).toEqual({ kind: 'notPaid' });
    expect(toProFailure(api(409, '<html>'))).toEqual({ kind: 'sessionMismatch' });
    expect(toProFailure(api(429))).toEqual({ kind: 'rateLimited', retryAfterSeconds: null });
    expect(toProFailure(api(500))).toEqual({ kind: 'network' });
    expect(toProFailure(api(0))).toEqual({ kind: 'network' });
  });

  it('ignores a missing or non-positive retry-after', () => {
    expect(toProFailure(api(429, { ok: false, error: { code: 'rate_limited', retryAfterSeconds: 0 } }))).toEqual({ kind: 'rateLimited', retryAfterSeconds: null });
  });

  it('treats a broken 2xx body and non-API errors apart', () => {
    expect(toProFailure(new ApiError('x', 200, true))).toEqual({ kind: 'invalidResponse' });
    expect(toProFailure(new Error('boom'))).toEqual({ kind: 'network' });
  });
});
