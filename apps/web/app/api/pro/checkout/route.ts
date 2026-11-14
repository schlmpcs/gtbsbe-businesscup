// POST /api/pro/checkout  { plan: 'yearly' | 'monthly' }   (header x-anon-id)
//   200 { ok: true, url }  the Stripe-hosted Checkout page (test mode: no real money moves)
//   400 bad_request · 413 too_large · 429 rate_limited
//   503 unavailable (no Stripe test key, or a bad APP_URL) · 502 upstream_error (Stripe failed)
// The price comes from PRO_PRICES, never from the client. Stripe sends the payer back to
// /pro?checkout=success&session_id=…, and the page then calls /api/pro/confirm.
// Spec: docs/ARCHITECTURE.md → Server routes; contract: ProCheckoutRequestSchema.
import { ProCheckoutRequestSchema } from '@lifeguessr/types';
import { json, readJsonBody } from '@/server/ai/http';
import { recordServerEvent } from '@/server/events/http';
import { publicBaseUrl } from '@/server/pro/config';
import { guardProRequest, MAX_PRO_BODY_BYTES, proError } from '@/server/pro/http';
import { getProStripe, stripeErrorFields } from '@/server/pro/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  const gate = guardProRequest(req, 'checkout');
  if ('response' in gate) return gate.response;

  const body = await readJsonBody(req, ProCheckoutRequestSchema, MAX_PRO_BODY_BYTES);
  if ('response' in body) return body.response;

  const stripe = getProStripe();
  const baseUrl = publicBaseUrl(req);
  if (!stripe || !baseUrl) return proError(503, 'unavailable');

  try {
    const url = await stripe.createCheckout({ plan: body.data.plan, anonId: gate.anonId, baseUrl });
    await recordServerEvent(gate.anonId, { name: 'checkout_started', props: { plan: body.data.plan } });
    return json({ ok: true, url });
  } catch (err) {
    console.error('[pro] Stripe checkout.sessions.create failed', stripeErrorFields(err));
    return proError(502, 'upstream_error');
  }
}
