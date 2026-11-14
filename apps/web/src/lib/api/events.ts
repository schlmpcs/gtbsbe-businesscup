// Transport for POST /api/events (task T8): sends one batch and says what to do with it next. Never
// throws. `keepalive` lets the last batch of a page outlive it (sent on pagehide), which is also why
// this is a plain fetch rather than postJson: the reply body is not needed, only its status.
import type { EventsRequest } from '@lifeguessr/types';
import { ANON_ID_HEADER } from './http';

/**
 * - `sent`: stored (or already stored).
 * - `retry`: not stored, may be later (network, 429, 5xx): keep the batch.
 * - `drop`: the server will never take this batch (400, 413): forget it.
 * - `disable`: the route does not exist in this deployment (404, 405, 501): stop sending.
 */
export type SendOutcome = 'sent' | 'retry' | 'drop' | 'disable';

export type EventTransport = (batch: EventsRequest, opts: { keepalive: boolean }) => Promise<SendOutcome>;

const ROUTE_MISSING = new Set([404, 405, 501]);

export function outcomeOf(status: number): SendOutcome {
  if (status >= 200 && status < 300) return 'sent';
  if (ROUTE_MISSING.has(status)) return 'disable';
  if (status === 408 || status === 429 || status >= 500) return 'retry';
  return 'drop';
}

export function createHttpEventTransport(url = '/api/events'): EventTransport {
  return async (batch, { keepalive }) => {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json', [ANON_ID_HEADER]: batch.anonId },
        body: JSON.stringify(batch),
        credentials: 'same-origin',
        keepalive,
      });
      return outcomeOf(res.status);
    } catch {
      return 'retry';
    }
  };
}
