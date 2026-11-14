import {
  EVENTS_BATCH_MAX, EventsErrorResponseSchema, EventsResponseSchema, type ClientEventEnvelope,
} from '@lifeguessr/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EVENTS_RATE_LIMITS, eventsRateLimiter, MAX_EVENTS_BODY_BYTES } from '@/server/events/http';
import { createMemoryStore, setStoreForTests, StoreUnavailableError, type Store } from '@/server/store';
import { lastDays } from '@/server/store/events';
import { POST } from './route';

const ANON = '0f8e2b4c-1d2e-4f5a-9b8c-7d6e5f4a3b2c';
const OTHER = '7a6b5c4d-3e2f-4a1b-8c9d-0e1f2a3b4c5d';

let store: Store;
beforeEach(() => {
  store = createMemoryStore();
  setStoreForTests(store);
  eventsRateLimiter.reset();
});
afterEach(() => setStoreForTests(null));

let seq = 0;
const id = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
const forecast = (): ClientEventEnvelope => ({ id: id(), name: 'forecast_viewed' });

let ip = 0;
function post(body: unknown, { anonId = ANON as string | null, ipAddress = `10.4.0.${++ip % 250}` } = {}): Promise<Response> {
  const headers: Record<string, string> = { 'content-type': 'application/json', 'x-forwarded-for': ipAddress };
  if (anonId !== null) headers['x-anon-id'] = anonId;
  return POST(new Request('http://localhost/api/events', {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }));
}
const accepted = async (res: Response) => {
  expect(res.status).toBe(200);
  expect(res.headers.get('cache-control')).toBe('no-store');
  return EventsResponseSchema.parse(await res.json()).accepted;
};
const errorOf = async (res: Response) => EventsErrorResponseSchema.parse(await res.json()).error;
const report = () => store.events.funnel(lastDays(1, new Date(Date.now() + 1_000)));

describe('POST /api/events', () => {
  it('stores a batch for the anonymous id; the funnel counts it', async () => {
    const batch: ClientEventEnvelope[] = [
      { id: id(), name: 'play_started' },
      { id: id(), name: 'clue_opened', props: { home: 1, clue: 'kitchen' } },
      { id: id(), name: 'home_guessed', props: { home: 1, cluesOpened: 1 } },
    ];
    expect(await accepted(await post({ anonId: ANON, events: batch }))).toBe(3);
    const r = await report();
    expect(r.users).toBe(1);
    expect(r.events.play_started).toBe(1);
    expect(r.game).toMatchObject({ guesses: 1, cluesPerHome: 1, blindGuessRate: 0 });
  });

  it('stores a resent batch once (the browser retries after a lost reply)', async () => {
    const batch = [forecast(), forecast()];
    expect(await accepted(await post({ anonId: ANON, events: batch }))).toBe(2);
    expect(await accepted(await post({ anonId: ANON, events: batch }))).toBe(0);
  });

  it('accepts the body id without the header, in any case', async () => {
    expect(await accepted(await post({ anonId: ANON.toUpperCase(), events: [forecast()] }, { anonId: null }))).toBe(1);
  });

  describe('refuses, with 400 and nothing stored,', () => {
    it.each([
      ['an unknown event name', { anonId: ANON, events: [{ id: '6b1d4c55-0b7e-4a4e-9a51-0c4b1f2f9d10', name: 'page_view' }] }],
      ['a server-only event', { anonId: ANON, events: [{ id: '6b1d4c55-0b7e-4a4e-9a51-0c4b1f2f9d10', name: 'pro_purchased', props: { plan: 'yearly' } }] }],
      ['text in props', { anonId: ANON, events: [{ id: '6b1d4c55-0b7e-4a4e-9a51-0c4b1f2f9d10', name: 'forecast_viewed', props: { email: 'jane@example.com' } }] }],
      ['an empty batch', { anonId: ANON, events: [] }],
      ['an id that is not a UUID', { anonId: 'jane.doe', events: [{ id: '6b1d4c55-0b7e-4a4e-9a51-0c4b1f2f9d10', name: 'forecast_viewed' }] }],
      ['extra fields', { anonId: ANON, events: [{ id: '6b1d4c55-0b7e-4a4e-9a51-0c4b1f2f9d10', name: 'forecast_viewed' }], userAgent: 'x' }],
    ])('%s', async (_why, body) => {
      const res = await post(body, { anonId: null });
      expect(res.status).toBe(400);
      expect((await errorOf(res)).code).toBe('bad_request');
      expect((await report()).users).toBe(0);
    });

    it(`more than ${EVENTS_BATCH_MAX} events`, async () => {
      const events = Array.from({ length: EVENTS_BATCH_MAX + 1 }, forecast);
      expect((await post({ anonId: ANON, events })).status).toBe(400);
    });

    it('a body that is not JSON', async () => {
      expect((await post('{')).status).toBe(400);
    });

    it('a header id that does not match the body', async () => {
      const res = await post({ anonId: OTHER, events: [forecast()] });
      expect(res.status).toBe(400);
      expect(await errorOf(res)).toMatchObject({ code: 'bad_request', issues: ['x-anon-id does not match anonId'] });
    });
  });

  it(`answers 413 above ${MAX_EVENTS_BODY_BYTES} bytes`, async () => {
    const res = await post(JSON.stringify({ anonId: ANON, events: [forecast()], pad: 'x'.repeat(MAX_EVENTS_BODY_BYTES) }));
    expect(res.status).toBe(413);
    expect((await errorOf(res)).code).toBe('too_large');
  });

  it('limits batches per anonId, then per IP across ids', async () => {
    for (let i = 0; i < EVENTS_RATE_LIMITS.perAnonId.limit; i++) {
      expect((await post({ anonId: ANON, events: [forecast()] })).status).toBe(200);
    }
    const limited = await post({ anonId: ANON, events: [forecast()] });
    expect(limited.status).toBe(429);
    expect(await errorOf(limited)).toMatchObject({ code: 'rate_limited', retryAfterSeconds: expect.any(Number) });
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0);
    // Another id still gets through.
    expect((await post({ anonId: OTHER, events: [forecast()] }, { anonId: OTHER })).status).toBe(200);

    eventsRateLimiter.reset();
    const ipAddress = '10.9.9.9';
    for (let i = 0; i < EVENTS_RATE_LIMITS.perIp.limit; i++) {
      const anonId = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
      await post({ anonId, events: [forecast()] }, { anonId, ipAddress });
    }
    expect((await post({ anonId: ANON, events: [forecast()] }, { ipAddress })).status).toBe(429);
  });

  describe('when the store cannot be used', () => {
    const failing = (err: Error): Store => ({
      ...createMemoryStore(),
      events: { record: () => Promise.reject(err), funnel: () => Promise.reject(err) },
    });

    it('answers 503 unavailable in production without STORE_URL', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      setStoreForTests(null);
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('STORE_URL', '');
      const res = await post({ anonId: ANON, events: [forecast()] });
      expect(res.status).toBe(503);
      expect(await errorOf(res)).toEqual({ code: 'unavailable', reason: 'not_configured' });
      vi.unstubAllEnvs();
    });

    it('answers 503 when the database is down', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      setStoreForTests(failing(new StoreUnavailableError('unreachable', 'down')));
      expect((await post({ anonId: ANON, events: [forecast()] })).status).toBe(503);
    });

    it('lets a bug surface as a 500 instead of hiding it behind 503', async () => {
      setStoreForTests(failing(new TypeError('bug')));
      await expect(post({ anonId: ANON, events: [forecast()] })).rejects.toThrow('bug');
    });
  });
});
