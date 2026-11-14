// Server-only: request plumbing shared by the /api/ai/* routes: body size limit, JSON + zod
// validation, the per-IP and per-anonId rate limit, and no-store JSON responses.
import { type z } from 'zod';
import { createRateLimiter, type RateLimitRule } from '../rateLimit';

/**
 * The strictest limits in the app (each request can cost up to two LLM calls). Per anonId for a
 * normal user, and a looser per-IP cap so rotating the anonId doesn't bypass it, while people
 * behind one NAT still get through.
 */
export const AI_RATE_LIMITS = {
  perAnonId: { limit: 10, windowMs: 60_000 },
  perIp: { limit: 30, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitRule>;

/** One limiter for every /api/ai/* route: the budget is shared across parse and explain. */
export const aiRateLimiter = createRateLimiter();

const NO_STORE = { 'Cache-Control': 'no-store' };

export type ApiErrorCode =
  | 'bad_request' | 'too_large' | 'rate_limited'
  | 'unavailable' | 'nothing_found' | 'incomplete' | 'invalid_output' | 'upstream_error';

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { ...NO_STORE, ...headers } });
}

export function errorResponse(
  status: number,
  code: ApiErrorCode,
  extra: Record<string, unknown> = {},
  headers: Record<string, string> = {},
): Response {
  return json({ ok: false, error: { code, ...extra } }, status, headers);
}

function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || req.headers.get('x-real-ip')?.trim() || 'unknown';
}

/** The anonymous ID header, if it looks like one (a UUID or similar short token). */
function anonId(req: Request): string | null {
  const id = req.headers.get('x-anon-id')?.trim();
  return id && /^[A-Za-z0-9-]{8,64}$/.test(id) ? id : null;
}

/** Returns a 429 response when the caller is over the AI limit, otherwise null. */
export function checkAiRateLimit(req: Request): Response | null {
  const keys: { key: string; rule: RateLimitRule }[] = [{ key: `ip:${clientIp(req)}`, rule: AI_RATE_LIMITS.perIp }];
  const id = anonId(req);
  if (id) keys.push({ key: `anon:${id}`, rule: AI_RATE_LIMITS.perAnonId });
  const result = aiRateLimiter.check(keys);
  if (result.ok) return null;
  return errorResponse(429, 'rate_limited', {}, { 'Retry-After': String(result.retryAfterSeconds) });
}

/**
 * Reads and validates a JSON body no larger than `maxBytes`. Returns the parsed data or the
 * error response to send (413 too large, 400 not JSON or failing the schema).
 */
export async function readJsonBody<S extends z.ZodType>(
  req: Request,
  schema: S,
  maxBytes: number,
): Promise<{ data: z.infer<S> } | { response: Response }> {
  const declared = Number(req.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { response: errorResponse(413, 'too_large', { maxBytes }) };
  }
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return { response: errorResponse(400, 'bad_request', { issues: ['could not read the body'] }) };
  }
  if (new TextEncoder().encode(raw).byteLength > maxBytes) {
    return { response: errorResponse(413, 'too_large', { maxBytes }) };
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return { response: errorResponse(400, 'bad_request', { issues: ['body is not valid JSON'] }) };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 10).map((i) => `${i.path.join('.') || '(body)'}: ${i.message}`);
    return { response: errorResponse(400, 'bad_request', { issues }) };
  }
  return { data: parsed.data };
}
