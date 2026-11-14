// Strings for the Pro paywall (S15, a demo: Stripe test mode, no real money). Owner: Amir.
// The screen title stays in mocks.screens.S15.
import type { ProPlan, ProSource } from '@lifeguessr/types';

export const pro = {
  demoBadge: 'Demo · Stripe test mode, no real charge',
  headline: 'Keep playing your future.',
  intro: 'Pro keeps your plans working for you. This build is a demo: checkout runs in Stripe test mode and no money ever moves.',
  loading: 'Checking your Pro status…',

  plans: {
    legend: 'Choose a plan',
    names: { yearly: 'Yearly', monthly: 'Monthly' } satisfies Record<ProPlan, string>,
    /** Suffix after the price: "$39.99 / year". */
    per: { year: 'a year', month: 'a month' },
    yearlyBadge: 'Best value',
    priceNote: 'Prices are a pricing assumption for this demo.',
  },

  includes: {
    title: 'What Pro includes',
    now: ['Save purchases to your wishlist on Can I Afford It?'],
    comingTitle: 'Coming to Pro',
    coming: [
      'Your life saved across devices',
      'Monthly check-ins',
      'Decision journal',
      'Loan Lab history',
      'Move levels',
    ],
  },

  checkout: {
    button: 'Continue to test checkout',
    busy: 'Opening Stripe test checkout…',
    unavailable: 'Test checkout is not set up on this server right now. The promo code below still unlocks Pro.',
    testCardTitle: 'Stripe test card',
    testCardNumber: '4242 4242 4242 4242',
    testCardDetails: 'Any future expiry date, any 3-digit CVC, any ZIP code.',
    testCardNote: 'Stripe test mode accepts only test cards. A real card is declined and never charged.',
  },

  promo: {
    title: 'Judges: skip checkout',
    body: 'Use the demo promo code to unlock Pro without a card.',
    label: 'Promo code',
    button: 'Unlock with code',
    busy: 'Checking the code…',
  },

  confirming: 'Confirming your test payment with Stripe…',
  cancelled: 'Checkout cancelled. No charge was made.',

  active: {
    successTitle: 'You are Pro',
    successBody: 'Saving purchases to your wishlist is now unlocked.',
    title: 'You already have Pro',
    sourceLabel: 'Unlocked with',
    sources: { stripe_test: 'Stripe test checkout', demo: 'Demo promo code' } satisfies Record<ProSource, string>,
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
