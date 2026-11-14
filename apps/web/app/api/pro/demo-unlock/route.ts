// POST /api/pro/demo-unlock  { code }   (header x-anon-id)
//   200 ProMutationResponse { ok: true, status }  (source 'demo', no plan)
//   400 bad_request · 413 too_large · 429 rate_limited (strict: the code is worth guessing)
//   403 invalid_code (wrong code, or PRO_DEMO_UNLOCK=off) · 503 unavailable
// The promo code is shown on the Pro screen on purpose, so the jury can pass the paywall
// without paying. It never downgrades a Stripe purchase (see server/pro/store.ts).
// Spec: docs/ARCHITECTURE.md → Server routes; contract: ProDemoUnlockRequestSchema.
import { createHash, timingSafeEqual } from 'node:crypto';
import { ProDemoUnlockRequestSchema } from '@lifeguessr/types';
import { json, readJsonBody } from '@/server/ai/http';
import { demoUnlock } from '@/server/pro/config';
import { guardProRequest, MAX_PRO_BODY_BYTES, proError, storeFailure } from '@/server/pro/http';
import { getEntitlementStore, proStatusOf } from '@/server/pro/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Constant-time and case-insensitive, like most promo codes. Hashing first gives both sides the
 * same length, which timingSafeEqual requires, so the length of the code doesn't leak either.
 */
function codesMatch(given: string, expected: string): boolean {
  const digest = (code: string) => createHash('sha256').update(code.trim().toUpperCase()).digest();
  return timingSafeEqual(digest(given), digest(expected));
}

export async function POST(req: Request): Promise<Response> {
  const gate = guardProRequest(req, 'demoUnlock');
  if ('response' in gate) return gate.response;

  const body = await readJsonBody(req, ProDemoUnlockRequestSchema, MAX_PRO_BODY_BYTES);
  if ('response' in body) return body.response;

  const demo = demoUnlock();
  if (!demo.enabled || !codesMatch(body.data.code, demo.code)) return proError(403, 'invalid_code');

  try {
    const entitlement = await getEntitlementStore().grant(gate.anonId, {
      source: 'demo',
      since: new Date().toISOString(),
    });
    return json({ ok: true, status: proStatusOf(entitlement) });
  } catch (err) {
    return storeFailure(err);
  }
}
