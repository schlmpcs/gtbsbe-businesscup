// @vitest-environment jsdom
import { EVENTS_BATCH_MAX, EventsRequestSchema, type EventsRequest } from '@lifeguessr/types';
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ANON_ID_KEY } from '@/state/anonId';
import { createHttpEventTransport, outcomeOf, type EventTransport, type SendOutcome } from './api/events';
import {
  EVENTS_FLUSH_DELAY_MS, EVENTS_QUEUE_MAX, EVENTS_RETRY_MIN_MS, flushEvents, queuedEventsForTests, resetEventsForTests, track,
  useTrackOnce,
} from './events';

const ANON = '0f8e2b4c-1d2e-4f5a-9b8c-7d6e5f4a3b2c';

/** A transport that records every batch and answers with the queued outcomes (then 'sent'). */
function fakeTransport(...outcomes: SendOutcome[]) {
  const calls: { batch: EventsRequest; keepalive: boolean }[] = [];
  const transport: EventTransport = vi.fn(async (batch, { keepalive }) => {
    calls.push({ batch: structuredClone(batch), keepalive });
    return outcomes.shift() ?? 'sent';
  });
  return { transport, calls, names: () => calls.flatMap((c) => c.batch.events.map((e) => e.name)) };
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.setItem(ANON_ID_KEY, ANON);
});
afterEach(() => {
  resetEventsForTests(undefined);
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('track', () => {
  it('is off unless NEXT_PUBLIC_EVENTS_SOURCE=api', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    resetEventsForTests(undefined);
    track({ name: 'forecast_viewed' });
    await vi.advanceTimersByTimeAsync(EVENTS_FLUSH_DELAY_MS * 5);
    expect(queuedEventsForTests()).toHaveLength(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('is off when the browser asks not to be tracked (Global Privacy Control)', async () => {
    vi.stubEnv('NEXT_PUBLIC_EVENTS_SOURCE', 'api');
    Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: true });
    try {
      resetEventsForTests(undefined);
      track({ name: 'forecast_viewed' });
      expect(queuedEventsForTests()).toHaveLength(0);
    } finally {
      Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: undefined });
    }
  });

  it('batches what happens within a second into one request, with the anonymous id and a UUID per event', async () => {
    const t = fakeTransport();
    resetEventsForTests(t.transport);
    track({ name: 'play_started' });
    track({ name: 'clue_opened', props: { home: 1, clue: 'garage' } });
    await vi.advanceTimersByTimeAsync(EVENTS_FLUSH_DELAY_MS - 1);
    expect(t.calls).toHaveLength(0);
    track({ name: 'home_guessed', props: { home: 1, cluesOpened: 1 } });
    await vi.advanceTimersByTimeAsync(1); // not pushed back by the later event
    expect(t.calls).toHaveLength(1);
    const { batch, keepalive } = t.calls[0]!;
    expect(keepalive).toBe(false);
    expect(EventsRequestSchema.parse(batch)).toEqual(batch); // exactly what the route accepts
    expect(batch.anonId).toBe(ANON);
    expect(t.names()).toEqual(['play_started', 'clue_opened', 'home_guessed']);
    expect(new Set(batch.events.map((e) => e.id)).size).toBe(3);
  });

  it('counts a `once` key once per page load', async () => {
    const t = fakeTransport();
    resetEventsForTests(t.transport);
    for (let i = 0; i < 3; i++) track({ name: 'forecast_viewed' }, { once: 'forecast_viewed' });
    track({ name: 'move_committed', props: { kind: 'payCardFirst' } });
    track({ name: 'move_committed', props: { kind: 'payCardFirst' } });
    await vi.advanceTimersByTimeAsync(EVENTS_FLUSH_DELAY_MS);
    expect(t.names()).toEqual(['forecast_viewed', 'move_committed', 'move_committed']);
  });

  it(`sends at most ${EVENTS_BATCH_MAX} per request, the rest right after`, async () => {
    const t = fakeTransport();
    resetEventsForTests(t.transport);
    for (let i = 0; i < EVENTS_BATCH_MAX + 3; i++) track({ name: 'sliders_adjusted' });
    await vi.advanceTimersByTimeAsync(0);
    expect(t.calls).toHaveLength(1); // a full batch goes without waiting
    await vi.advanceTimersByTimeAsync(10);
    expect(t.calls.map((c) => c.batch.events.length)).toEqual([EVENTS_BATCH_MAX, 3]);
  });

  it('keeps a batch that failed for a passing reason and resends it (same ids) after a backoff', async () => {
    const t = fakeTransport('retry', 'retry');
    resetEventsForTests(t.transport);
    track({ name: 'paywall_viewed' });
    await vi.advanceTimersByTimeAsync(EVENTS_FLUSH_DELAY_MS);
    expect(t.calls).toHaveLength(1);
    // New events wait for the backoff instead of hammering a server that is down.
    track({ name: 'forecast_viewed' });
    await vi.advanceTimersByTimeAsync(EVENTS_RETRY_MIN_MS - 1);
    expect(t.calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(t.calls).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(EVENTS_RETRY_MIN_MS * 2);
    expect(t.calls).toHaveLength(3);
    const first = t.calls[0]!.batch.events[0]!.id;
    expect(t.calls.map((c) => c.batch.events[0]!.id)).toEqual([first, first, first]);
    expect(t.names().slice(-2)).toEqual(['paywall_viewed', 'forecast_viewed']);
    expect(queuedEventsForTests()).toHaveLength(0);
  });

  it(`keeps at most ${EVENTS_QUEUE_MAX} events while the server is unreachable, dropping the oldest`, async () => {
    const t = fakeTransport(...Array<SendOutcome>(50).fill('retry'));
    resetEventsForTests(t.transport);
    for (let i = 0; i < EVENTS_QUEUE_MAX + 10; i++) track({ name: 'home_guessed', props: { home: 1, cluesOpened: i % 6 } });
    expect(queuedEventsForTests().length).toBeLessThanOrEqual(EVENTS_QUEUE_MAX);
    await vi.advanceTimersByTimeAsync(EVENTS_FLUSH_DELAY_MS);
    expect(queuedEventsForTests().length).toBeLessThanOrEqual(EVENTS_QUEUE_MAX);
  });

  it('forgets a batch the server refused, and keeps sending later ones', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const t = fakeTransport('drop');
    resetEventsForTests(t.transport);
    track({ name: 'forecast_viewed' });
    await vi.advanceTimersByTimeAsync(EVENTS_FLUSH_DELAY_MS);
    track({ name: 'paywall_viewed' });
    await vi.advanceTimersByTimeAsync(EVENTS_FLUSH_DELAY_MS);
    expect(t.names()).toEqual(['forecast_viewed', 'paywall_viewed']);
  });

  it('stops for the page when the route does not exist', async () => {
    const t = fakeTransport('disable');
    resetEventsForTests(t.transport);
    track({ name: 'forecast_viewed' });
    await vi.advanceTimersByTimeAsync(EVENTS_FLUSH_DELAY_MS);
    track({ name: 'paywall_viewed' });
    await vi.advanceTimersByTimeAsync(EVENTS_FLUSH_DELAY_MS * 10);
    expect(t.calls).toHaveLength(1);
  });

  it('sends everything at once, with keepalive, when the page is hidden or closed', async () => {
    const t = fakeTransport();
    resetEventsForTests(t.transport);
    for (let i = 0; i < EVENTS_BATCH_MAX + 1; i++) track({ name: 'sliders_adjusted' }); // 25 go now
    await vi.advanceTimersByTimeAsync(0);
    track({ name: 'loan_compared', props: { offers: 3 } });
    window.dispatchEvent(new Event('pagehide'));
    await vi.advanceTimersByTimeAsync(0);
    expect(t.calls.at(-1)).toMatchObject({ keepalive: true });
    expect(t.names().at(-1)).toBe('loan_compared');
    expect(queuedEventsForTests()).toHaveLength(0);
  });

  it('never throws, even when the transport does', async () => {
    const transport: EventTransport = vi.fn(() => {
      throw new Error('boom');
    });
    resetEventsForTests(transport);
    expect(() => track({ name: 'forecast_viewed' })).not.toThrow();
    await expect(flushEvents()).resolves.toBeUndefined();
    expect(queuedEventsForTests()).toHaveLength(1); // kept for a retry
  });
});

describe('useTrackOnce', () => {
  it('tracks once when the condition turns true, with the event of that render', async () => {
    const t = fakeTransport();
    resetEventsForTests(t.transport);
    const { rerender } = renderHook(({ when, offers }) => useTrackOnce(when, 'loan_compared', { name: 'loan_compared', props: { offers } }), {
      initialProps: { when: false, offers: 1 },
    });
    rerender({ when: true, offers: 3 });
    rerender({ when: false, offers: 2 });
    rerender({ when: true, offers: 2 });
    await vi.advanceTimersByTimeAsync(EVENTS_FLUSH_DELAY_MS);
    expect(t.calls.flatMap((c) => c.batch.events)).toEqual([expect.objectContaining({ name: 'loan_compared', props: { offers: 3 } })]);
  });
});

describe('HTTP transport', () => {
  it('maps statuses to what the queue does next', () => {
    expect([200, 204].map(outcomeOf)).toEqual(['sent', 'sent']);
    expect([404, 405, 501].map(outcomeOf)).toEqual(['disable', 'disable', 'disable']);
    expect([408, 429, 500, 502, 503].map(outcomeOf)).toEqual(['retry', 'retry', 'retry', 'retry', 'retry']);
    expect([400, 413].map(outcomeOf)).toEqual(['drop', 'drop']);
  });

  it('posts JSON to /api/events with the id in a header (never the URL), and keepalive when asked', async () => {
    const fetch = vi.fn(async () => new Response('{"ok":true,"accepted":1}', { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    const batch: EventsRequest = { anonId: ANON, events: [{ id: '6b1d4c55-0b7e-4a4e-9a51-0c4b1f2f9d10', name: 'forecast_viewed' }] };
    expect(await createHttpEventTransport()(batch, { keepalive: true })).toBe('sent');
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/events');
    expect(url).not.toContain(ANON);
    expect(init).toMatchObject({ method: 'POST', keepalive: true, credentials: 'same-origin' });
    expect(new Headers(init.headers).get('x-anon-id')).toBe(ANON);
    expect(JSON.parse(init.body as string)).toEqual(batch);
  });

  it('treats a network error as worth a retry', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }));
    expect(await createHttpEventTransport()({ anonId: ANON, events: [] }, { keepalive: false })).toBe('retry');
  });
});
