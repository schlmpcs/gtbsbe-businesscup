// Strings for the Pro paywall (S15, a demo: simulated checkout or Stripe test mode, no real money).
// Owner: Amir. The screen title stays in mocks.screens.S15.
import type { ProPlan, ProSource } from '@lifeguessr/types';

export const pro = {
  /** Over the offer: which kind of demo checkout this is (see CheckoutMode). */
  demoBadge: {
    stripe: 'Demo · Stripe test mode, no real charge',
    demo: 'Demo · simulated checkout, nothing is charged',
  },
  headline: 'Keep playing your future.',
  loading: 'Checking your Pro status…',

  plans: {
    legend: 'Choose a plan',
    names: { yearly: 'Yearly', monthly: 'Monthly' } satisfies Record<ProPlan, string>,
    /** Suffix after the price: "$39.99 / year". */
    per: { year: 'a year', month: 'a month' },
    yearlyBadge: 'Best value',
    priceNote: 'Demo prices.',
  },

  /** Only what Pro unlocks in this build (no promises of unbuilt features). */
  includes: {
    title: 'What Pro includes',
    now: ['Save purchases to a wishlist in Can I Afford It?'],
  },

  checkout: {
    button: 'Go to test checkout',
    busy: 'Opening test checkout…',
    unavailable: 'Test checkout is off here. Use the promo code.',
    testCardTitle: 'Test card',
    testCardNumber: '4242 4242 4242 4242',
    testCardDetails: 'Any future date, any CVC, any ZIP.',
    testCardNote: 'Real cards are declined, never charged.',
  },

  /** The simulated in-app checkout (checkoutMode 'demo'): no card is typed, sent or charged. */
  demoCheckout: {
    title: 'Your order',
    orderLabel: 'Order',
    orderItem: (planName: string) => `LifeGuessr Pro · ${planName}`,
    payWithLabel: 'Pay with',
    card: 'Visa •••• 4242 (demo card)',
    /** The button reads "Pay $39.99 (demo)": `pay`, the price, then `demoTag`. */
    pay: 'Pay',
    demoTag: '(demo)',
    busy: 'Unlocking Pro…',
    note: 'Nothing is charged and no card details are sent.',
  },

  promo: {
    title: 'Judges: skip checkout',
    label: 'Promo code',
    button: 'Unlock with code',
    busy: 'Checking the code…',
  },

  confirming: 'Confirming your test payment with Stripe…',
  cancelled: 'Checkout cancelled. No charge was made.',

  active: {
    successTitle: 'You are Pro',
    successBody: 'Your wishlist is unlocked.',
    title: 'You already have Pro',
    sourceLabel: 'Unlocked with',
    sources: {
      stripe_test: 'Stripe test checkout',
      demo_checkout: 'Demo checkout (simulated)',
      demo: 'Demo promo code',
    } satisfies Record<ProSource, string>,
    planLabel: 'Plan',
    sinceLabel: 'Since',
    continue: 'Go to Can I Afford It?',
  },

  errors: {
    network: 'We could not reach the server. Check your connection and try again.',
    unavailable: 'Pro is unavailable right now. Try again in a moment.',
    upstream: 'Stripe did not answer. Try again in a moment.',
    rateLimited: 'Too many tries. Wait a moment and try again.',
    /** rateLimited when the server said how long to wait. */
    rateLimitedFor: (seconds: number) => `Too many tries. Try again in ${seconds} ${seconds === 1 ? 'second' : 'seconds'}.`,
    invalidResponse: 'The server sent an answer we could not read. Try again.',
    badRequest: 'That request was not valid. Reload the page and try again.',
    notPaid: 'Stripe has not marked this test payment as paid yet.',
    sessionMismatch: 'This checkout belongs to another browser or was already used.',
    badReturn: 'This checkout link is not valid. No charge was made.',
    invalidCode: 'That promo code did not work.',
    emptyCode: 'Enter the promo code.',
  },
  retry: 'Try again',

  /** For screens with a Pro-only action (ui-kit LockNotice). */
  lock: {
    title: 'A Pro feature',
    wishlistBody: 'Saving purchases to your wishlist is part of Pro. Your saved items stay free to open.',
    cta: 'See Pro',
  },
} as const;
