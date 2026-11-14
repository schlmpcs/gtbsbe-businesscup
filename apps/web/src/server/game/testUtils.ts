// Test helpers for the game routes: a fresh memory store and rate limiter per test, a fixed
// clock, and requests shaped like the browser's (lib/api/http.ts).
import { afterEach, beforeEach, vi } from 'vitest';
import { createMemoryStore, setStoreForTests, type Store } from '@/server/store';
import { gameRateLimiter } from './http';

export const ANON = '0f8e2b4c-1d2e-4f5a-9b8c-7d6e5f4a3b2c';
export const OTHER_ANON = '7a6b5c4d-3e2f-4a1b-8c9d-0e1f2a3b4c5d';

/** Noon in New York on 2026-11-14 (17:00 UTC, standard time). */
export const NOW = '2026-11-14T17:00:00.000Z';
export const TODAY = '2026-11-14';

/**
 * Per test: a new memory store (or `makeStore()`), a reset game rate limiter and a fake clock at
 * NOW (only Date is faked, so timers and promises run normally); spies are restored after each.
 * Returns a getter for the store.
 */
export function setupGameTestEnv(makeStore: () => Store = createMemoryStore): () => Store {
  let store: Store;
  beforeEach(() => {
    store = makeStore();
    setStoreForTests(store);
    gameRateLimiter.reset();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    setStoreForTests(null);
  });
  return () => store;
}

let ip = 0;
/** A different client IP per request unless one is given, so per-IP limits stay out of the way. */
const nextIp = () => `10.9.${Math.floor(++ip / 250) % 250}.${ip % 250}`;

type Opts = { anonId?: string | null; ip?: string };

export function postReq(path: string, body: unknown, { anonId = ANON, ip: address = nextIp() }: Opts = {}): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json', 'x-forwarded-for': address };
  if (anonId !== null) headers['x-anon-id'] = anonId;
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

export function getReq(path: string, { anonId = null, ip: address = nextIp() }: Opts = {}): Request {
  const headers: Record<string, string> = { 'x-forwarded-for': address };
  if (anonId !== null) headers['x-anon-id'] = anonId;
  return new Request(`http://localhost${path}`, { headers });
}

/** `error` of a `{ ok: false, error }` reply. */
export async function errorOf(res: Response): Promise<{ code: string; [k: string]: unknown }> {
  const body = (await res.json()) as { ok: boolean; error: { code: string } };
  if (body.ok !== false) throw new Error(`expected an error reply, got ${JSON.stringify(body)}`);
  return body.error;
}
