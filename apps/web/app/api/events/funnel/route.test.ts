import { FUNNEL_MAX_DAYS, FUNNEL_STEPS, FunnelResponseSchema, EventsErrorResponseSchema } from '@lifeguessr/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FUNNEL_DAYS, EVENTS_RATE_LIMITS, eventsRateLimiter, parseFunnelDays, recordServerEvent } from '@/server/events/http';
import { createMemoryStore, setStoreForTests, StoreUnavailableError, type Store } from '@/server/store';
import { GET } from './route';

const ANON = '0f8e2b4c-1d2e-4f5a-9b8c-7d6e5f4a3b2c';
const OTHER = '7a6b5c4d-3e2f-4a1b-8c9d-0e1f2a3b4c5d';

let store: Store;
beforeEach(() => {
  store = createMemoryStore();
  setStoreForTests(store);
  eventsRateLimiter.reset();
});
afterEach(() => {
  setStoreForTests(null);
  vi.useRealTimers();
});

let ip = 0;
const get = (query = '', ipAddress = `10.5.0.${++ip % 250}`) =>
  GET(new Request(`http://localhost/api/events/funnel${query}`, { headers: { 'x-forwarded-for': ipAddress } }));

let seq = 0;
const id = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;

describe('GET /api/events/funnel', () => {
  it('reports the funnel of the last 7 days, aggregates only', async () => {
    await store.events.record(ANON, [{ id: id(), name: 'play_started' }, { id: id(), name: 'game_finished', props: { homes: 5 } }]);
    await store.events.record(OTHER, [{ id: id(), name: 'play_started' }]);
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = FunnelResponseSchema.parse(await res.json());
    expect(new Date(body.to).getTime() - new Date(body.from).getTime()).toBe(DEFAULT_FUNNEL_DAYS * 86_400_000);
    expect(body.users).toBe(2);
    expect(body.steps.map((s) => s.name)).toEqual([...FUNNEL_STEPS]);
    expect(body.steps[1]).toEqual({ name: 'game_finished', users: 1, funnel: 1, conversion: 0.5 });
    expect(body.game.finishRate).toBe(0.5);
    expect(JSON.stringify(body)).not.toContain(ANON);
  });

  it('counts what the server records itself (checkout, Pro unlocks)', async () => {
    await recordServerEvent(ANON, { name: 'checkout_started', props: { plan: 'yearly' } });
    await recordServerEvent(ANON, { name: 'pro_purchased', props: { plan: 'yearly' } });
    await recordServerEvent(OTHER, { name: 'pro_promo_redeemed' });
    const body = FunnelResponseSchema.parse(await (await get()).json());
    expect(body.events).toMatchObject({ checkout_started: 1, pro_purchased: 1, pro_promo_redeemed: 1 });
    expect(body.steps.at(-1)).toMatchObject({ name: 'pro_purchased', users: 1 });
  });

  it('takes ?days from 1 to the maximum', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-14T12:00:00Z'), toFake: ['Date'] });
    const body = FunnelResponseSchema.parse(await (await get(`?days=${FUNNEL_MAX_DAYS}`)).json());
    expect(body.from).toBe(new Date(Date.UTC(2026, 10, 14, 12) - FUNNEL_MAX_DAYS * 86_400_000).toISOString());
    expect(body.to).toBe('2026-11-14T12:00:00.000Z');
    for (const bad of ['0', String(FUNNEL_MAX_DAYS + 1), '1.5', '-3', 'abc', '1e2']) {
      const res = await get(`?days=${bad}`);
      expect(res.status).toBe(400);
      expect(EventsErrorResponseSchema.parse(await res.json()).error.code).toBe('bad_request');
    }
  });

  it('parses days', () => {
    expect(parseFunnelDays(null)).toBe(DEFAULT_FUNNEL_DAYS);
    expect(parseFunnelDays('')).toBe(DEFAULT_FUNNEL_DAYS);
    expect(parseFunnelDays('30')).toBe(30);
    expect(parseFunnelDays('0030')).toBeNull();
  });

  it('is rate limited per IP', async () => {
    for (let i = 0; i < EVENTS_RATE_LIMITS.funnelPerIp.limit; i++) expect((await get('', '10.6.0.1')).status).toBe(200);
    expect((await get('', '10.6.0.1')).status).toBe(429);
    expect((await get('', '10.6.0.2')).status).toBe(200);
  });

  it('answers 503 when the store is down, and a server event never fails its request', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const down = new StoreUnavailableError('unreachable', 'down');
    setStoreForTests({ ...createMemoryStore(), events: { record: () => Promise.reject(down), funnel: () => Promise.reject(down) } });
    expect((await get()).status).toBe(503);
    await expect(recordServerEvent(ANON, { name: 'pro_promo_redeemed' })).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('could not record pro_promo_redeemed'));
  });
});
