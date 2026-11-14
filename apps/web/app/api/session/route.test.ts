import {
  SESSION_WISHLIST_MAX, SessionErrorResponseSchema, SessionResponseSchema, type Profile, type Purchase,
} from '@lifeguessr/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cloneProfileDemo } from '@/fixtures';
import { getEntitlementStore } from '@/server/pro/store';
import { ANON, OTHER_ANON, setupProTestEnv } from '@/server/pro/testUtils';
import { MAX_SESSION_BODY_BYTES, SESSION_RATE_LIMITS, sessionRateLimiter } from '@/server/session/http';
import { createMemoryStore, setStoreForTests, StoreUnavailableError, type Store } from '@/server/store';
import { GET, POST } from './route';

setupProTestEnv(); // a fresh, empty entitlement file per test
let store: Store;
beforeEach(() => {
  store = createMemoryStore();
  setStoreForTests(store);
  sessionRateLimiter.reset();
});
afterEach(() => setStoreForTests(null));

let ip = 0;
function post(body: unknown, { anonId = ANON as string | null, ipAddress = `10.2.0.${++ip % 250}` } = {}): Promise<Response> {
  const headers: Record<string, string> = { 'content-type': 'application/json', 'x-forwarded-for': ipAddress };
  if (anonId !== null) headers['x-anon-id'] = anonId;
  return POST(new Request('http://localhost/api/session', {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }));
}
function get(anonId: string | null = ANON): Promise<Response> {
  const headers: Record<string, string> = { 'x-forwarded-for': `10.3.0.${++ip % 250}` };
  if (anonId !== null) headers['x-anon-id'] = anonId;
  return GET(new Request('http://localhost/api/session', { headers }));
}
const ok = async (res: Response) => {
  expect(res.status).toBe(200);
  expect(res.headers.get('cache-control')).toBe('no-store');
  return SessionResponseSchema.parse(await res.json());
};
const errorOf = async (res: Response) => SessionErrorResponseSchema.parse(await res.json()).error;

const withAge = (age: number): Profile => ({ ...cloneProfileDemo(), age: { value: age, isEstimate: false } });
const laptop: Purchase = { label: 'Laptop', amount: 1_400, recurring: false, payWith: 'card' };
const gym: Purchase = { label: 'Gym', amount: 30, recurring: 'monthly', payWith: 'cash' };
const makePro = () => getEntitlementStore().grant(ANON, { source: 'demo', since: '2026-11-14T10:00:00.000Z' });

describe('POST /api/session', () => {
  it('answers an empty session for a new id, and creates nothing', async () => {
    expect(await ok(await post({ anonId: ANON }))).toEqual({ ok: true, wishlist: [], revision: 0, updatedAt: null });
    expect(await store.sessions.load(ANON)).toEqual({ wishlist: [], revision: 0, updatedAt: null });
  });

  it('saves the profile, and a later load (the reload) gives it back without any sign-up', async () => {
    const saved = await ok(await post({ anonId: ANON, profile: withAge(37), wishlist: [] }));
    expect(saved).toMatchObject({ profile: withAge(37), wishlist: [], revision: 1 });
    expect(await ok(await post({ anonId: ANON }))).toEqual(saved);
    expect(await ok(await get())).toEqual(saved);
    expect(await ok(await post({ anonId: OTHER_ANON }, { anonId: OTHER_ANON }))).toMatchObject({ revision: 0 });
  });

  it('accepts the body id without the header, and an upper-case id as the same session', async () => {
    await post({ anonId: ANON, profile: withAge(41) }, { anonId: null });
    expect(await ok(await post({ anonId: ANON.toUpperCase() }, { anonId: null }))).toMatchObject({ profile: withAge(41) });
  });

  describe('the wishlist is a Pro feature', () => {
    it('answers 402 not_paid when a free user adds to it, and saves nothing of that request', async () => {
      const res = await post({ anonId: ANON, profile: withAge(30), wishlist: [laptop] });
      expect(res.status).toBe(402);
      expect((await errorOf(res)).code).toBe('not_paid');
      expect(await store.sessions.load(ANON)).toMatchObject({ revision: 0 });
    });

    it('lets a Pro user add to it', async () => {
      await makePro();
      expect(await ok(await post({ anonId: ANON, wishlist: [laptop, gym] }))).toMatchObject({ wishlist: [laptop, gym], revision: 1 });
      expect(await ok(await post({ anonId: ANON, wishlist: [laptop, gym, gym] }))).toMatchObject({ revision: 2 });
    });

    it('lets a free user keep or remove items saved earlier, but not add them back', async () => {
      // Items saved while this id could still add them (e.g. before the paywall existed).
      await store.sessions.save(ANON, { wishlist: [laptop, gym] }, { mayAddToWishlist: true });
      expect(await ok(await post({ anonId: ANON, wishlist: [gym, laptop] }))).toMatchObject({ wishlist: [gym, laptop] });
      expect(await ok(await post({ anonId: ANON, wishlist: [gym] }))).toMatchObject({ wishlist: [gym] });
      expect((await post({ anonId: ANON, wishlist: [gym, laptop] })).status).toBe(402);
    });

    it('saves a free user’s profile with an empty wishlist without looking Pro up', async () => {
      const lookup = vi.spyOn(getEntitlementStore(), 'get');
      await ok(await post({ anonId: ANON, profile: withAge(30), wishlist: [] }));
      expect(lookup).not.toHaveBeenCalled();
    });

    it('answers 503 (fail closed) when the Pro store cannot be read', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const { EntitlementStoreError } = await import('@/server/pro/store');
      vi.spyOn(getEntitlementStore(), 'get').mockRejectedValue(new EntitlementStoreError('cannot read'));
      const res = await post({ anonId: ANON, wishlist: [laptop] });
      expect(res.status).toBe(503);
      expect((await errorOf(res)).code).toBe('unavailable');
    });
  });

  describe('validation', () => {
    it.each([
      ['a non-UUID anonId', { anonId: 'anon-00000001' }],
      ['no anonId', { profile: withAge(30) }],
      ['a profile that breaks the contract', { anonId: ANON, profile: { ...withAge(30), age: { value: 12, isEstimate: false } } }],
      ['a percent APR in a wishlist loan', { anonId: ANON, wishlist: [{ ...laptop, payWith: { loan: { amount: 1_000, apr: 22.8, termMonths: 12 } } }] }],
      ['an unknown field', { anonId: ANON, statementMonths: [] }],
      [`more than ${SESSION_WISHLIST_MAX} wishlist items`, { anonId: ANON, wishlist: Array.from({ length: SESSION_WISHLIST_MAX + 1 }, () => gym) }],
    ])('rejects %s with 400', async (_name, body) => {
      const res = await post(body, { anonId: null });
      expect(res.status).toBe(400);
      expect((await errorOf(res)).code).toBe('bad_request');
    });

    it('rejects a body that is not JSON', async () => {
      expect((await post('{"anonId":')).status).toBe(400);
    });

    it('rejects a header id that does not match the body', async () => {
      const res = await post({ anonId: ANON }, { anonId: OTHER_ANON });
      expect(res.status).toBe(400);
      expect(await errorOf(res)).toMatchObject({ code: 'bad_request', issues: ['x-anon-id does not match anonId'] });
    });

    it('rejects a malformed header id', async () => {
      expect((await post({ anonId: ANON }, { anonId: 'not-a-uuid' })).status).toBe(400);
    });

    it(`answers 413 above ${MAX_SESSION_BODY_BYTES} bytes`, async () => {
      const res = await post({ anonId: ANON, profile: { ...withAge(30), doneMoveIds: ['x'.repeat(MAX_SESSION_BODY_BYTES)] } });
      expect(res.status).toBe(413);
      expect((await errorOf(res)).code).toBe('too_large');
    });
  });

  describe('rate limits', () => {
    it('limits saves per anonId', async () => {
      const { limit } = SESSION_RATE_LIMITS.perAnonId;
      for (let i = 0; i < limit; i++) expect((await post({ anonId: ANON })).status).toBe(200);
      const res = await post({ anonId: ANON });
      expect(res.status).toBe(429);
      expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0);
      expect((await errorOf(res)).retryAfterSeconds).toBeGreaterThan(0);
      expect((await post({ anonId: OTHER_ANON }, { anonId: OTHER_ANON })).status).toBe(200);
    });

    it('limits one IP cycling through ids', async () => {
      const { limit } = SESSION_RATE_LIMITS.perIp;
      const id = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
      for (let i = 0; i < limit; i++) expect((await post({ anonId: id(i) }, { anonId: id(i), ipAddress: '10.9.9.9' })).status).toBe(200);
      expect((await post({ anonId: id(limit) }, { anonId: id(limit), ipAddress: '10.9.9.9' })).status).toBe(429);
    });
  });

  describe('when the store cannot be used', () => {
    const failing = (err: Error): Store => ({
      ...createMemoryStore(),
      sessions: { load: () => Promise.reject(err), save: () => Promise.reject(err) },
    });

    it('answers 503 unavailable in production without STORE_URL, never a silent memory store', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      setStoreForTests(null);
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('STORE_URL', '');
      const res = await post({ anonId: ANON, profile: withAge(30) });
      expect(res.status).toBe(503);
      expect(await errorOf(res)).toEqual({ code: 'unavailable', reason: 'not_configured' });
      expect(res.headers.get('retry-after')).toBe('5');
    });

    it('answers 503 when the database is down', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      setStoreForTests(failing(new StoreUnavailableError('unreachable', 'down')));
      expect((await post({ anonId: ANON, profile: withAge(30) })).status).toBe(503);
      expect((await get()).status).toBe(503);
    });

    it('lets a bug surface as a 500 instead of hiding it behind 503', async () => {
      setStoreForTests(failing(new TypeError('bug')));
      await expect(post({ anonId: ANON, profile: withAge(30) })).rejects.toThrow('bug');
    });
  });
});

describe('GET /api/session', () => {
  it('needs a UUID x-anon-id header', async () => {
    expect((await get(null)).status).toBe(400);
    expect((await get('anon-00000001')).status).toBe(400);
  });
});
