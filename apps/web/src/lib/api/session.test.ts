// The browser's session adapter against the real /api/session route handler (memory store), so
// the client and the route cannot drift apart.
import type { Profile, Purchase } from '@lifeguessr/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../../../app/api/session/route';
import { cloneProfileDemo } from '@/fixtures';
import { getEntitlementStore } from '@/server/pro/store';
import { ANON, setupProTestEnv } from '@/server/pro/testUtils';
import { sessionRateLimiter } from '@/server/session/http';
import { createMemoryStore, setStoreForTests, StoreUnavailableError, type Store } from '@/server/store';
import { createHttpSessionAdapter, createSessionAdapter } from './session';

setupProTestEnv();
let store: Store;
let requests: { body: unknown; anonHeader: string | null }[];

beforeEach(() => {
  store = createMemoryStore();
  setStoreForTests(store);
  sessionRateLimiter.reset();
  requests = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    const req = new Request(new URL(url, 'http://localhost'), init);
    requests.push({ body: JSON.parse(String(init.body)), anonHeader: req.headers.get('x-anon-id') });
    return POST(req);
  });
});
afterEach(() => {
  setStoreForTests(null);
  vi.unstubAllGlobals();
});

const withAge = (age: number): Profile => ({ ...cloneProfileDemo(), age: { value: age, isEstimate: false } });
const laptop: Purchase = { label: 'Laptop', amount: 1_400, recurring: false, payWith: 'card' };

describe('http session adapter ↔ POST /api/session', () => {
  it('saves, then loads the same state back (what a reload does)', async () => {
    const adapter = createHttpSessionAdapter();
    expect(await adapter.load(ANON)).toEqual({ profile: undefined, wishlist: [] });
    await adapter.save(ANON, { profile: withAge(39), wishlist: [] });
    expect(await adapter.load(ANON)).toEqual({ profile: withAge(39), wishlist: [] });
    // The id goes in the body and the header, never the URL; a load sends nothing else.
    expect(requests.at(-1)).toEqual({ body: { anonId: ANON }, anonHeader: ANON });
  });

  it('keeps saving the profile when the wishlist holds items a free user cannot add (402)', async () => {
    const adapter = createHttpSessionAdapter();
    await adapter.save(ANON, { profile: withAge(45), wishlist: [laptop] });
    expect(await store.sessions.load(ANON)).toMatchObject({ profile: withAge(45), wishlist: [], revision: 1 });
    expect(requests.map((r) => Object.keys(r.body as object).sort())).toEqual([
      ['anonId', 'profile', 'wishlist'],
      ['anonId', 'profile'],
    ]);
    expect(adapter.enabled).toBe(true);
  });

  it('saves the wishlist for a Pro user', async () => {
    await getEntitlementStore().grant(ANON, { source: 'demo', since: '2026-11-14T10:00:00.000Z' });
    await createHttpSessionAdapter().save(ANON, { profile: withAge(45), wishlist: [laptop] });
    expect(await store.sessions.load(ANON)).toMatchObject({ wishlist: [laptop] });
  });

  it('stays on through a store outage (503) and saves again once it is back', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const down = new StoreUnavailableError('unreachable', 'down');
    setStoreForTests({ ...store, sessions: { load: () => Promise.reject(down), save: () => Promise.reject(down) } });
    const adapter = createHttpSessionAdapter();
    expect(await adapter.load(ANON)).toBeNull();
    await adapter.save(ANON, { profile: withAge(30) });
    expect(adapter.enabled).toBe(true);

    setStoreForTests(store);
    await adapter.save(ANON, { profile: withAge(31) });
    expect(await adapter.load(ANON)).toMatchObject({ profile: withAge(31) });
  });

  it('is off in local mode (the default build flag)', async () => {
    const adapter = createSessionAdapter('local');
    expect(adapter.enabled).toBe(false);
    await adapter.save(ANON, { profile: withAge(30) });
    expect(requests).toEqual([]);
  });
});
