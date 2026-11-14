// Server-only: the two Stripe calls of the Pro paywall demo, in test mode only (no real money
// ever moves). Typed against the installed SDK (stripe 23.1.0, API 2026-10-28.endive). Tests
// replace the `stripe` module, so nothing here may depend on the SDK's error classes.
import Stripe from 'stripe';
import { PRO_PRICES, type ProPlan } from '@lifeguessr/types';
import { STRIPE_TEST_KEY, stripeTestKey } from './config';

/** The fields of a Checkout Session that decide whether it unlocks Pro. */
export type CheckoutSession = Pick<
  Stripe.Checkout.Session,
  'id' | 'livemode' | 'status' | 'payment_status' | 'client_reference_id' | 'metadata'
>;

export type ProStripe = {
  /** Creates a hosted Checkout Session for `plan`, owned by `anonId`; returns its URL. */
  createCheckout(input: { plan: ProPlan; anonId: string; baseUrl: string }): Promise<string>;
  /** The session, or null when Stripe has no such session (a made-up or foreign id). */
  retrieveCheckout(sessionId: string): Promise<CheckoutSession | null>;
};

let cached: { key: string; client: Stripe } | null = null;

function client(key: string): Stripe {
  // Defense in depth: config already filters the key, but this is the line that talks to Stripe.
  if (!STRIPE_TEST_KEY.test(key)) throw new Error('refusing a Stripe key that is not test-mode');
  if (cached?.key !== key) cached = { key, client: new Stripe(key, { maxNetworkRetries: 1, timeout: 15_000 }) };
  return cached.client;
}

/** The Stripe wrapper, or null when no test-mode key is configured (checkout unavailable). */
export function getProStripe(): ProStripe | null {
  const key = stripeTestKey();
  if (!key) return null;
  const stripe = client(key);

  return {
    async createCheckout({ plan, anonId, baseUrl }) {
      const price = PRO_PRICES[plan];
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'usd',
              unit_amount: Math.round(price.amount * 100),
              recurring: { interval: price.interval },
              product_data: { name: 'LifeGuessr Pro (demo, test mode)' },
            },
          },
        ],
        // Ties the session to the browser that started it; /api/pro/confirm checks it.
        client_reference_id: anonId,
        metadata: { plan },
        success_url: `${baseUrl}/pro?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/pro?checkout=cancelled`,
      });
      if (!session.url) throw new Error('Stripe returned a Checkout Session without a URL');
      return session.url;
    },

    async retrieveCheckout(sessionId) {
      try {
        const { id, livemode, status, payment_status, client_reference_id, metadata } =
          await stripe.checkout.sessions.retrieve(sessionId);
        return { id, livemode, status, payment_status, client_reference_id, metadata };
      } catch (err) {
        if (stripeErrorFields(err).statusCode === 404) return null;
        throw err;
      }
    },
  };
}

/**
 * The parts of a Stripe error that are safe to log. Never the message: it can echo request
 * parameters, and some key errors quote part of the key.
 */
export function stripeErrorFields(err: unknown): { type?: string; code?: string; statusCode?: number } {
  if (!err || typeof err !== 'object') return {};
  const { type, code, statusCode } = err as Record<string, unknown>;
  return {
    type: typeof type === 'string' ? type : undefined,
    code: typeof code === 'string' ? code : undefined,
    statusCode: typeof statusCode === 'number' ? statusCode : undefined,
  };
}
