// POST /api/pro/demo-checkout  { plan }   (header x-anon-id)
//   200 ProMutationResponse { ok: true, status }  (source 'demo_checkout', with the plan)
//   400 bad_request (also for any field besides `plan`) · 413 too_large · 429 rate_limited
//   503 unavailable (demo unlock is switched off, or the entitlement store is unreadable)
// The simulated checkout of the Pro screen: no card, no payment processor, nothing is charged.
// It is a demo and says so everywhere it shows; it never downgrades a Stripe purchase (see
// server/pro/store.ts), and PRO_DEMO_UNLOCK=off switches it off together with the promo code.
// Spec: docs/superpowers/specs/2026-11-14-demo-checkout-design.md; contract: ProDemoCheckoutRequestSchema.
import { ProDemoCheckoutRequestSchema } from '@lifeguessr/types';
import { json, readJsonBody } from '@/server/ai/http';
import { recordServerEvent } from '@/server/events/http';
import { demoUnlock } from '@/server/pro/config';
import { guardProRequest, MAX_PRO_BODY_BYTES, proError, storeFailure } from '@/server/pro/http';
import { getEntitlementStore, proStatusOf } from '@/server/pro/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  const gate = guardProRequest(req, 'demoCheckout');
  if ('response' in gate) return gate.response;

  const body = await readJsonBody(req, ProDemoCheckoutRequestSchema, MAX_PRO_BODY_BYTES);
  if ('response' in body) return body.response;

  if (!demoUnlock().enabled) return proError(503, 'unavailable');

  try {
    const entitlement = await getEntitlementStore().grant(gate.anonId, {
      source: 'demo_checkout',
      plan: body.data.plan,
      since: new Date().toISOString(),
    });
    await recordServerEvent(gate.anonId, { name: 'pro_demo_purchased', props: { plan: body.data.plan } });
    return json({ ok: true, status: proStatusOf(entitlement) });
  } catch (err) {
    return storeFailure(err);
  }
}
