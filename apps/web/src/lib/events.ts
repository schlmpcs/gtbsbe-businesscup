// Funnel events from the browser (task T8). View-models call `track()` when someone reaches a step
// of the funnel (docs/PRODUCT.md → Metrics to show); presentational UI never does.
//
// Fire and forget: `track` returns at once, never throws, and nothing on screen waits for it or
// changes when it fails. Events are queued and sent in small batches (POST /api/events) about a
// second after the first one, and right away when the page is hidden or closed (keepalive), so
// the last step before someone leaves still arrives. A batch that fails for a reason that may pass
// (offline, 429, 5xx) is kept and retried with backoff; each event carries its own UUID, so a
// batch that reached the server but lost its reply is not stored twice.
//
// Off unless NEXT_PUBLIC_EVENTS_SOURCE=api, and off when the browser sends Global Privacy Control
// or Do Not Track. It turns itself off for the page if the route does not exist (404/405/501).
// Events carry no personal data: names and props are typed (ClientFunnelEvent) and the server
// refuses anything else (EventsRequestSchema).
import { EVENTS_BATCH_MAX, type ClientEventEnvelope, type ClientFunnelEvent } from '@lifeguessr/types';
import { useEffect, useRef } from 'react';
import { eventsSource } from '@/lib/config';
import { getAnonId, newUuid } from '@/state/anonId';
import { createHttpEventTransport, type EventTransport, type SendOutcome } from './api/events';

/** How long the first event of a batch waits for others to join it. */
export const EVENTS_FLUSH_DELAY_MS = 1_000;
/** Most events kept while the server cannot be reached; the oldest go first. */
export const EVENTS_QUEUE_MAX = 100;
export const EVENTS_RETRY_MIN_MS = 2_000;
export const EVENTS_RETRY_MAX_MS = 60_000;

/** undefined until first used: then the HTTP transport, or null when events are off. */
let transport: EventTransport | null | undefined;
let queue: ClientEventEnvelope[] = [];
const onceKeys = new Set<string>();
let timer: ReturnType<typeof setTimeout> | undefined;
let timerDue = Number.POSITIVE_INFINITY;
let sending = false;
let retryMs = 0;
let listening = false;

function privacySignal(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.globalPrivacyControl === true || nav.doNotTrack === '1';
}

function currentTransport(): EventTransport | null {
  if (transport === undefined) {
    transport = typeof window !== 'undefined' && eventsSource() === 'api' && !privacySignal() ? createHttpEventTransport() : null;
  }
  return transport;
}

function keep(events: readonly ClientEventEnvelope[]): void {
  queue = [...events, ...queue];
  if (queue.length > EVENTS_QUEUE_MAX) queue = queue.slice(queue.length - EVENTS_QUEUE_MAX);
}

function schedule(delayMs: number): void {
  const due = Date.now() + delayMs;
  if (timer !== undefined && timerDue <= due) return; // already due sooner
  clearTimeout(timer);
  timerDue = due;
  timer = setTimeout(() => {
    timer = undefined;
    timerDue = Number.POSITIVE_INFINITY;
    void flushEvents();
  }, delayMs);
}

function settle(outcome: SendOutcome, batch: ClientEventEnvelope[]): void {
  switch (outcome) {
    case 'sent':
    case 'drop': // a batch the server refused will never be accepted; the rest may be
      if (outcome === 'drop' && process.env.NODE_ENV !== 'production') console.warn('[events] the server refused a batch', batch);
      retryMs = 0;
      if (queue.length > 0) schedule(0);
      return;
    case 'retry':
      keep(batch);
      retryMs = Math.min(EVENTS_RETRY_MAX_MS, retryMs === 0 ? EVENTS_RETRY_MIN_MS : retryMs * 2);
      schedule(retryMs);
      return;
    case 'disable':
      transport = null;
      queue = [];
      clearTimeout(timer);
      timer = undefined;
      timerDue = Number.POSITIVE_INFINITY;
  }
}

async function send(t: EventTransport, batch: ClientEventEnvelope[], keepalive: boolean): Promise<void> {
  let outcome: SendOutcome;
  try {
    outcome = await t({ anonId: getAnonId(), events: batch }, { keepalive });
  } catch {
    outcome = 'retry';
  }
  settle(outcome, batch);
}

/** Sends the next batch now (one request at a time). Tests and the timer call it; it never throws. */
export async function flushEvents(): Promise<void> {
  const t = currentTransport();
  if (!t || sending || queue.length === 0) return;
  clearTimeout(timer);
  timer = undefined;
  timerDue = Number.POSITIVE_INFINITY;
  const batch = queue.slice(0, EVENTS_BATCH_MAX);
  queue = queue.slice(batch.length);
  sending = true;
  try {
    await send(t, batch, false);
  } finally {
    sending = false;
  }
}

/** The page is going away (or to the background): send everything queued now, with keepalive. */
function flushAll(): void {
  const t = currentTransport();
  if (!t || queue.length === 0) return;
  clearTimeout(timer);
  timer = undefined;
  timerDue = Number.POSITIVE_INFINITY;
  const all = queue;
  queue = [];
  for (let i = 0; i < all.length; i += EVENTS_BATCH_MAX) void send(t, all.slice(i, i + EVENTS_BATCH_MAX), true);
}

function listen(): void {
  if (listening) return;
  listening = true;
  window.addEventListener('pagehide', flushAll);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAll();
  });
}

/**
 * Records that this browser reached a step. With `once`, only the first call with that key in
 * this page load counts (e.g. one `forecast_viewed` however often the chart re-renders).
 */
export function track(event: ClientFunnelEvent, opts: { once?: string } = {}): void {
  try {
    if (typeof window === 'undefined') return;
    if (opts.once !== undefined) {
      if (onceKeys.has(opts.once)) return;
      onceKeys.add(opts.once);
    }
    if (!currentTransport()) return;
    queue.push({ ...event, id: newUuid() });
    if (queue.length > EVENTS_QUEUE_MAX) queue = queue.slice(queue.length - EVENTS_QUEUE_MAX);
    listen();
    // While a request is out, its reply schedules the next one; while backing off, new events wait too.
    const backingOff = retryMs > 0 && timer !== undefined;
    if (!sending && !backingOff) schedule(queue.length >= EVENTS_BATCH_MAX ? 0 : EVENTS_FLUSH_DELAY_MS);
  } catch {
    // Analytics never break a screen.
  }
}

/** Tracks `event` once per page load (under `key`) as soon as `when` is true. For view-models. */
export function useTrackOnce(when: boolean, key: string, event: ClientFunnelEvent): void {
  const latest = useRef(event);
  useEffect(() => {
    latest.current = event;
  });
  useEffect(() => {
    if (when) track(latest.current, { once: key });
  }, [when, key]);
}

/** Tests: start over with `next` as the transport (null = events off; undefined = from the environment). */
export function resetEventsForTests(next?: EventTransport | null): void {
  clearTimeout(timer);
  timer = undefined;
  timerDue = Number.POSITIVE_INFINITY;
  transport = next;
  queue = [];
  onceKeys.clear();
  sending = false;
  retryMs = 0;
}

/** Tests: what is waiting to be sent. */
export const queuedEventsForTests = (): readonly ClientEventEnvelope[] => queue;
