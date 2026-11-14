// Server-only: request plumbing for /api/session (T4): rate limits, body cap, the anonymous id
// and typed `{ ok: false, error: { code: SessionErrorCode } }` replies.
import { AnonIdSchema, type SessionErrorCode } from '@lifeguessr/types';
import { json } from '@/server/ai/http';
import { createRateLimiter, type RateLimitRule } from '../rateLimit';

const perMinute = (limit: number): RateLimitRule => ({ limit, windowMs: 60_000 });

/**
 * The browser saves at most once a second while someone edits (sessionSync debounces 1 s), so 60
 * a minute per anonId is a ceiling a real user does not reach. Per IP it is looser, for people
 * behind one NAT, but still stops one client from cycling ids to write rows without end.
 */
export const SESSION_RATE_LIMITS = {
  perAnonId: perMinute(60),
  perIp: perMinute(300),
} as const satisfies Record<string, RateLimitRule>;

/** Its own budget: saving a profile must not eat into the LLM or Pro limits, or the reverse. */
export const sessionRateLimiter = createRateLimiter();

/**
 * A profile is a few KB even with many debts; 50 wishlist purchases add about 10 KB. 64 KiB leaves
 * room and still bounds what one request can make the server parse and store.
 */
export const MAX_SESSION_BODY_BYTES = 64 * 1024;

export function sessionError(
  status: number,
  code: SessionErrorCode,
  extra: Record<string, unknown> = {},
  headers: Record<string, string> = {},
): Response {
  return json({ ok: false, error: { code, ...extra } }, status, headers);
}

// Same rules as server/ai/http.ts and server/pro/http.ts.
function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || req.headers.get('x-real-ip')?.trim() || 'unknown';
}

/** Counts one request for `key`; a 429 response when over the limit, otherwise null. */
function charge(key: string, rule: RateLimitRule): Response | null {
  const result = sessionRateLimiter.check([{ key, rule }]);
  if (result.ok) return null;
  const { retryAfterSeconds } = result;
  return sessionError(429, 'rate_limited', { retryAfterSeconds }, { 'Retry-After': String(retryAfterSeconds) });
}

/** The per-IP limit, checked before the body is read. */
export const checkIpLimit = (req: Request): Response | null => charge(`ip:${clientIp(req)}`, SESSION_RATE_LIMITS.perIp);

/** The per-anonId limit, checked once the id is known and valid. */
export const checkAnonLimit = (anonId: string): Response | null => charge(`anon:${anonId}`, SESSION_RATE_LIMITS.perAnonId);

/**
 * The x-anon-id header, lower-cased: `{ anonId: null }` when absent, a 400 when present but not a
 * UUID. The browser sends it with every request (lib/api/http.ts).
 */
export function readAnonIdHeader(req: Request): { anonId: string | null } | { response: Response } {
  const raw = req.headers.get('x-anon-id')?.trim();
  if (!raw) return { anonId: null };
  const parsed = AnonIdSchema.safeParse(raw);
  if (!parsed.success) return { response: sessionError(400, 'bad_request', { issues: ['x-anon-id must be a UUID'] }) };
  return { anonId: parsed.data };
}
