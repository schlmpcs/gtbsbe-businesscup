// Server-only: request plumbing for /api/events (T8): rate limits, body cap, typed
// `{ ok: false, error: { code: EventsErrorCode } }` replies, and recording the events the server
// itself sees (the Pro routes).
import { randomUUID } from 'node:crypto';
import { FUNNEL_MAX_DAYS, type EventsErrorCode, type ServerFunnelEvent } from '@lifeguessr/types';
import { json } from '@/server/ai/http';
import { getStore } from '@/server/store';
import { createRateLimiter, type RateLimitRule } from '../rateLimit';

const perMinute = (limit: number): RateLimitRule => ({ limit, windowMs: 60_000 });

/**
 * The browser sends a batch at most about once a second while someone clicks through, and only
 * when something happened, so 120 batches a minute per anonId is far above real use. Per IP it is
 * looser, for people behind one NAT (and the e2e run, where every browser shares one address).
 * The funnel report is a few aggregate queries; 30 a minute per IP is plenty for a dashboard.
 */
export const EVENTS_RATE_LIMITS = {
  perAnonId: perMinute(120),
  perIp: perMinute(1_200),
  funnelPerIp: perMinute(30),
} as const satisfies Record<string, RateLimitRule>;

/** Its own budget: analytics must never eat into the session, LLM or Pro limits. */
export const eventsRateLimiter = createRateLimiter();

/** A full batch (EVENTS_BATCH_MAX events with props) is under 4 KB; 16 KiB leaves room. */
export const MAX_EVENTS_BODY_BYTES = 16 * 1024;

export function eventsError(
  status: number,
  code: EventsErrorCode,
  extra: Record<string, unknown> = {},
  headers: Record<string, string> = {},
): Response {
  return json({ ok: false, error: { code, ...extra } }, status, headers);
}

// Same rules as server/ai/http.ts, server/pro/http.ts and server/session/http.ts.
function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || req.headers.get('x-real-ip')?.trim() || 'unknown';
}

function charge(key: string, rule: RateLimitRule): Response | null {
  const result = eventsRateLimiter.check([{ key, rule }]);
  if (result.ok) return null;
  const { retryAfterSeconds } = result;
  return eventsError(429, 'rate_limited', { retryAfterSeconds }, { 'Retry-After': String(retryAfterSeconds) });
}

/** POST: the per-IP limit, checked before the body is read. */
export const checkEventsIpLimit = (req: Request): Response | null => charge(`ip:${clientIp(req)}`, EVENTS_RATE_LIMITS.perIp);

/** POST: the per-anonId limit, checked once the id is known and valid. */
export const checkEventsAnonLimit = (anonId: string): Response | null => charge(`anon:${anonId}`, EVENTS_RATE_LIMITS.perAnonId);

/** GET /api/events/funnel: per IP. */
export const checkFunnelLimit = (req: Request): Response | null => charge(`funnel:ip:${clientIp(req)}`, EVENTS_RATE_LIMITS.funnelPerIp);

/** The window GET /api/events/funnel reports on when `days` is not given. */
export const DEFAULT_FUNNEL_DAYS = 7;

/** `days` from the funnel query: the default when absent, null unless a whole number from 1 to FUNNEL_MAX_DAYS. */
export function parseFunnelDays(raw: string | null): number | null {
  if (raw === null || raw === '') return DEFAULT_FUNNEL_DAYS;
  if (!/^\d{1,3}$/.test(raw)) return null;
  const days = Number(raw);
  return days >= 1 && days <= FUNNEL_MAX_DAYS ? days : null;
}

/**
 * Records an event the server saw itself (a checkout started, Pro unlocked). Never throws and
 * never fails the request it belongs to: a lost analytics row must not cost a user their unlock.
 */
export async function recordServerEvent(anonId: string, event: ServerFunnelEvent): Promise<void> {
  try {
    await getStore().events.record(anonId, [{ ...event, id: randomUUID() }]);
  } catch (err) {
    console.warn(`[events] could not record ${event.name}: ${err instanceof Error ? err.message : String(err)}`);
  }
}
