// Server-only: the "Together" shared-plan routes (/api/together).
//
//   POST /api/together                { partner, goal? }  → 201 { ok: true, plan }
//   GET  /api/together/<id>                               → 200 { ok: true, plan }
//   PUT  /api/together/<id>/partner   { partner, goal? }  → 200 { ok: true, plan }
//   400 bad_request · 404 not_found (unknown, malformed or expired id) · 413 too_large
//   429 rate_limited · 503 unavailable (no store, database down)
//
// No login: the plan id in the link is the only key (128 random bits, server/store/together.ts).
// Bodies are zod-validated against TogetherPartnerSchema (only the numbers the math needs, strict,
// bounded) and capped at TOGETHER_MAX_BODY_BYTES. Rate limits are per IP (and per anonymous id when
// the browser sends one), on their own limiter, so sharing a plan never eats the session, game or
// LLM budgets. Creating is the tightest: each create writes a row.
import {
  TOGETHER_MAX_BODY_BYTES, TogetherCreateRequestSchema, TogetherPartnerRequestSchema, type TogetherErrorCode, type TogetherPlan,
} from '@lifeguessr/types';
import { json, readJsonBody } from '@/server/ai/http';
import { createRateLimiter, type RateLimitRule } from '@/server/rateLimit';
import { getStore } from '@/server/store';
import { storeErrorResponse } from '@/server/store/http';
import { isPlanId } from '@/server/store/together';

const HOUR_MS = 3_600_000;
const perHour = (limit: number): RateLimitRule => ({ limit, windowMs: HOUR_MS });
const perMinute = (limit: number): RateLimitRule => ({ limit, windowMs: 60_000 });

export const TOGETHER_RATE_LIMITS = {
  create: { anon: perHour(10), ip: perHour(30) },
  partner: { anon: perHour(30), ip: perHour(90) },
  read: { anon: perMinute(60), ip: perMinute(300) },
} as const satisfies Record<string, { anon: RateLimitRule; ip: RateLimitRule }>;

export type TogetherAction = keyof typeof TOGETHER_RATE_LIMITS;

export const togetherRateLimiter = createRateLimiter();

export function togetherError(status: number, code: TogetherErrorCode, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}): Response {
  return json({ ok: false, error: { code, ...extra } }, status, headers);
}

// Same rules as server/ai/http.ts and server/session/http.ts.
function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || req.headers.get('x-real-ip')?.trim() || 'unknown';
}

/** The anonymous id header, when it looks like one; only used as a rate-limit key, never stored. */
function anonId(req: Request): string | null {
  const id = req.headers.get('x-anon-id')?.trim().toLowerCase();
  return id && /^[0-9a-f-]{36}$/.test(id) ? id : null;
}

function checkLimit(req: Request, action: TogetherAction): Response | null {
  const rules = TOGETHER_RATE_LIMITS[action];
  const keys = [{ key: `${action}:ip:${clientIp(req)}`, rule: rules.ip }];
  const id = anonId(req);
  if (id) keys.push({ key: `${action}:anon:${id}`, rule: rules.anon });
  const result = togetherRateLimiter.check(keys);
  if (result.ok) return null;
  const { retryAfterSeconds } = result;
  return togetherError(429, 'rate_limited', { retryAfterSeconds }, { 'Retry-After': String(retryAfterSeconds) });
}

const reply = (plan: TogetherPlan, status = 200) => json({ ok: true, plan }, status);
const notFound = () => togetherError(404, 'not_found');

export async function createPlan(req: Request): Promise<Response> {
  const limited = checkLimit(req, 'create');
  if (limited) return limited;
  const body = await readJsonBody(req, TogetherCreateRequestSchema, TOGETHER_MAX_BODY_BYTES);
  if ('response' in body) return body.response;
  try {
    const plan = await getStore().together.create(body.data.partner, body.data.goal ?? null, new Date());
    return reply(plan, 201);
  } catch (err) {
    return storeErrorResponse(err, 'together');
  }
}

export async function readPlan(req: Request, id: string): Promise<Response> {
  const limited = checkLimit(req, 'read');
  if (limited) return limited;
  if (!isPlanId(id)) return notFound();
  try {
    const plan = await getStore().together.get(id, new Date());
    return plan ? reply(plan) : notFound();
  } catch (err) {
    return storeErrorResponse(err, 'together');
  }
}

export async function setPartner(req: Request, id: string): Promise<Response> {
  const limited = checkLimit(req, 'partner');
  if (limited) return limited;
  if (!isPlanId(id)) return notFound();
  const body = await readJsonBody(req, TogetherPartnerRequestSchema, TOGETHER_MAX_BODY_BYTES);
  if ('response' in body) return body.response;
  try {
    const plan = await getStore().together.setPartner2(id, body.data.partner, body.data.goal, new Date());
    return plan ? reply(plan) : notFound();
  } catch (err) {
    return storeErrorResponse(err, 'together');
  }
}
