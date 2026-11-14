// Server-only: request plumbing shared by the /api/pro/* routes: the anonymous id, per-route
// rate limits, typed `{ ok: false, error: { code: ProErrorCode } }` replies, and `requirePro`,
// the guard for future routes that only Pro users may call.
import type { ProErrorCode } from '@lifeguessr/types';
import { json } from '@/server/ai/http';
import { createRateLimiter, type RateLimitRule } from '../rateLimit';
import { EntitlementStoreError, getEntitlementStore } from './store';

const perMinute = (limit: number): RateLimitRule => ({ limit, windowMs: 60_000 });

/**
 * Per anonId for a normal user, plus a looser per-IP cap so rotating the anonId doesn't bypass
 * it. The status poll is cheap; checkout and confirm each cost a Stripe call; the promo code is
 * the strictest, since it is the one thing worth guessing.
 */
export const PRO_RATE_LIMITS = {
  status: { perAnonId: perMinute(60), perIp: perMinute(120) },
  checkout: { perAnonId: perMinute(10), perIp: perMinute(30) },
  confirm: { perAnonId: perMinute(10), perIp: perMinute(30) },
  demoUnlock: { perAnonId: perMinute(5), perIp: perMinute(20) },
} as const satisfies Record<string, { perAnonId: RateLimitRule; perIp: RateLimitRule }>;

export type ProRoute = keyof typeof PRO_RATE_LIMITS;

/** Separate from the AI limiter: buying Pro must not eat into the LLM budget, or the reverse. */
export const proRateLimiter = createRateLimiter();

/** Every /api/pro/* body is a single short field. */
export const MAX_PRO_BODY_BYTES = 1_024;

export function proError(
  status: number,
  code: ProErrorCode,
  extra: Record<string, unknown> = {},
  headers: Record<string, string> = {},
): Response {
  return json({ ok: false, error: { code, ...extra } }, status, headers);
}

// Same rules as server/ai/http.ts, which keeps its helpers private.
function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || req.headers.get('x-real-ip')?.trim() || 'unknown';
}

function readAnonId(req: Request): string | null {
  const id = req.headers.get('x-anon-id')?.trim();
  return id && /^[A-Za-z0-9-]{8,64}$/.test(id) ? id : null;
}

const missingAnonId = () => proError(400, 'bad_request', { issues: ['x-anon-id header is missing or malformed'] });

/** The first gate of every /api/pro/* route: a well-formed x-anon-id (400), then the route's rate limit (429). */
export function guardProRequest(req: Request, route: ProRoute): { anonId: string } | { response: Response } {
  const anonId = readAnonId(req);
  if (!anonId) return { response: missingAnonId() };

  const rules = PRO_RATE_LIMITS[route];
  const result = proRateLimiter.check([
    { key: `${route}:ip:${clientIp(req)}`, rule: rules.perIp },
    { key: `${route}:anon:${anonId}`, rule: rules.perAnonId },
  ]);
  if (!result.ok) {
    const { retryAfterSeconds } = result;
    return {
      response: proError(429, 'rate_limited', { retryAfterSeconds }, { 'Retry-After': String(retryAfterSeconds) }),
    };
  }
  return { anonId };
}

/** Maps a failed store operation to 503 (fail closed); anything else is a bug and propagates. */
export function storeFailure(err: unknown): Response {
  if (!(err instanceof EntitlementStoreError)) throw err;
  console.error(`[pro] entitlement store unavailable: ${err.message}`);
  return proError(503, 'unavailable');
}

/**
 * Whether `anonId` is Pro, for a route that gates only part of what it does (the T4 session save
 * gates adding to the wishlist, not saving the profile). 503 when the store is unavailable.
 */
export async function proStatusFor(anonId: string): Promise<{ pro: boolean } | { response: Response }> {
  try {
    return { pro: (await getEntitlementStore().get(anonId)) !== null };
  } catch (err) {
    return { response: storeFailure(err) };
  }
}

/**
 * Guard for routes only Pro users may call: 400 without a valid x-anon-id, 402 `not_paid` when
 * that id is not Pro, 503 when the store is unavailable. It does not rate-limit; the calling route
 * applies its own limit.
 */
export async function requirePro(req: Request): Promise<{ anonId: string } | { response: Response }> {
  const anonId = readAnonId(req);
  if (!anonId) return { response: missingAnonId() };
  const status = await proStatusFor(anonId);
  if ('response' in status) return status;
  return status.pro ? { anonId } : { response: proError(402, 'not_paid') };
}
