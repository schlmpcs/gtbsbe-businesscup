// View-model types for the Pro paywall (S15). ui/ may import only this file, @/ui-kit/** and
// @/copy (lint-enforced). Hook: usePaywall() in ./usePaywall.ts.
import type { Money, ProPlan, ProSource } from '@lifeguessr/types';

export type { ProPlan, ProSource } from '@lifeguessr/types';

/**
 * What the screen shows.
 * - loading: neither the server nor the cached hint has said who this is yet.
 * - offer: free user: plans, test checkout, promo code.
 * - confirming: back from Stripe, the server is checking the Checkout Session.
 * - success: Pro was unlocked during this visit.
 * - pro: already Pro on arrival (no purchase buttons).
 */
export type PaywallView = 'loading' | 'offer' | 'confirming' | 'success' | 'pro';

export type PaywallPlanVM = {
  id: ProPlan;
  /** Price per interval, in dollars (PRO_PRICES). */
  amount: Money;
  interval: 'year' | 'month';
  /** The prices are a pricing assumption, so the UI tags them. */
  isEstimate: true;
  selected: boolean;
};

/** Each key maps to a sentence in copy.pro.errors; raw server text is never shown. */
export type PaywallErrorKey =
  | 'network'
  | 'unavailable'
  | 'upstream'
  | 'rateLimited'
  | 'invalidResponse'
  | 'badRequest'
  | 'notPaid'
  | 'sessionMismatch'
  | 'badReturn'
  | 'invalidCode'
  | 'emptyCode';

export type PaywallError = {
  /** Which block the message belongs to. */
  where: 'status' | 'checkout' | 'confirm' | 'promo';
  key: PaywallErrorKey;
  /** rateLimited only, when the server said how long to wait. */
  retryAfterSeconds: number | null;
};

/** The active Pro entitlement (views 'success' and 'pro'). */
export type PaywallProVM = {
  source: ProSource;
  /** Set for a Stripe test checkout; a promo unlock has no plan. */
  plan: ProPlan | null;
  /** When it was unlocked, formatted for display (local date). */
  sinceLabel: string;
};

export type PaywallVM = {
  view: PaywallView;
  /** Yearly first and preselected. */
  plans: PaywallPlanVM[];
  selectPlan: (plan: ProPlan) => void;
  /** False when the server has no Stripe test key: the button is disabled, the promo code still works. */
  checkoutAvailable: boolean;
  /** Ask for a test Checkout Session and send the browser to Stripe. */
  startCheckout: () => void;
  /** False when the server switched the promo code off. */
  promoEnabled: boolean;
  /** The promo field: prefilled with the code the server shows, editable. */
  promoCode: string;
  setPromoCode: (code: string) => void;
  redeem: () => void;
  /** The request in flight, if any. Every action is ignored while one runs (double clicks). */
  busy: 'checkout' | 'promo' | 'confirm' | null;
  /** True for the server's retry-after window after a 429; actions are ignored until it passes. */
  coolingDown: boolean;
  /** The user came back from Stripe without paying. */
  cancelled: boolean;
  error: PaywallError | null;
  /** Repeat the step that failed (status load or a confirm that may succeed later), else null. */
  retry: (() => void) | null;
  pro: PaywallProVM | null;
  /** Where to go after unlocking: the screen with the gated feature. */
  continueHref: string;
};
