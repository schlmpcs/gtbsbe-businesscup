// POST /api/pro/confirm  { sessionId: 'cs_test_…' }   (header x-anon-id)
//   200 ProMutationResponse { ok: true, status }
//   400 bad_request (also: unknown session, live mode, not a Pro session) · 413 too_large
//   429 rate_limited · 402 not_paid · 409 session_mismatch · 503 unavailable · 502 upstream_error
// Never trusts the client: the session is fetched from Stripe and unlocks Pro only when it is a
// test-mode session, started by this anonId (client_reference_id), complete and paid, and not
// already claimed by another anonId. Confirming the same session again returns the current
// status, so reloading the success URL is harmless.
// Spec: docs/ARCHITECTURE.md → Server routes; contract: ProConfirmRequestSchema.
import { ProConfirmRequestSchema, ProPlanSchema } from '@lifeguessr/types';
import { json, readJsonBody } from '@/server/ai/http';
import { recordServerEvent } from '@/server/events/http';
import { guardProRequest, MAX_PRO_BODY_BYTES, proError, storeFailure } from '@/server/pro/http';
import { getEntitlementStore, proStatusOf } from '@/server/pro/store';
import { getProStripe, stripeErrorFields, type CheckoutSession } from '@/server/pro/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  const gate = guardProRequest(req, 'confirm');
  if ('response' in gate) return gate.response;

  const body = await readJsonBody(req, ProConfirmRequestSchema, MAX_PRO_BODY_BYTES);
  if ('response' in body) return body.response;

  const stripe = getProStripe();
  if (!stripe) return proError(503, 'unavailable');

  let session: CheckoutSession | null;
  try {
    session = await stripe.retrieveCheckout(body.data.sessionId);
  } catch (err) {
    console.error('[pro] Stripe checkout.sessions.retrieve failed', stripeErrorFields(err));
    return proError(502, 'upstream_error');
  }

  // Ownership before payment state, so a leaked session id tells a stranger nothing about it.
  if (!session) return proError(400, 'bad_request', { issues: ['unknown Checkout Session'] });
  if (session.livemode !== false) return proError(400, 'bad_request', { issues: ['not a test-mode session'] });
  if (session.client_reference_id !== gate.anonId) return proError(409, 'session_mismatch');
  const plan = ProPlanSchema.safeParse(session.metadata?.plan);
  if (!plan.success) return proError(400, 'bad_request', { issues: ['not a LifeGuessr Pro session'] });
  if (session.status !== 'complete' || session.payment_status !== 'paid') return proError(402, 'not_paid');

  try {
    const claim = await getEntitlementStore().claimSession(session.id, gate.anonId, {
      source: 'stripe_test',
      plan: plan.data,
      since: new Date().toISOString(),
    });
    if (!claim.ok) return proError(409, 'session_mismatch');
    await recordServerEvent(gate.anonId, { name: 'pro_purchased', props: { plan: plan.data } });
    return json({ ok: true, status: proStatusOf(claim.entitlement) });
  } catch (err) {
    return storeFailure(err);
  }
}
