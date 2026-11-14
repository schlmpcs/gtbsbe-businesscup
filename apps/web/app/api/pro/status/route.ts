// GET /api/pro/status   (header x-anon-id)
//   200 ProStatusResponse { ok, status, checkoutAvailable, demo: { enabled, code? } }
//       `demo.code` is the promo code, sent only while demo unlock is on: the Pro screen shows
//       it on purpose, so the jury can pass the paywall without paying.
//   400 bad_request · 429 rate_limited · 503 unavailable (entitlement store unreadable)
// Spec: docs/ARCHITECTURE.md → Server routes; contract: ProStatusResponseSchema.
import { json } from '@/server/ai/http';
import { checkoutConfigured, demoUnlock } from '@/server/pro/config';
import { guardProRequest, storeFailure } from '@/server/pro/http';
import { getEntitlementStore, proStatusOf } from '@/server/pro/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  const gate = guardProRequest(req, 'status');
  if ('response' in gate) return gate.response;

  let entitlement;
  try {
    entitlement = await getEntitlementStore().get(gate.anonId);
  } catch (err) {
    return storeFailure(err);
  }
  const demo = demoUnlock();
  return json({
    ok: true,
    status: proStatusOf(entitlement),
    checkoutAvailable: checkoutConfigured(),
    demo: demo.enabled ? { enabled: true, code: demo.code } : { enabled: false },
  });
}
