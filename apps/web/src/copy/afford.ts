// Strings for Can I Afford It? (S11). Owner: Amir (Y11).
// Functions take numbers already formatted by the UI (formatMoney / formatRate), never raw values.
import { ai } from './ai';

const months = (n: number) => (n === 1 ? '1 month' : `${n} months`);

export const afford = {
  screens: {
    S11: 'Can I afford it?',
  },
  /** Label used when the user leaves the purchase name blank. */
  defaultPurchaseLabel: 'Purchase',

  intro: 'Checked against your next 10 years.',
  loading: 'Loading your plan…',

  form: {
    title: 'What do you want to buy?',
    label: 'What is it?',
    labelPlaceholder: 'Laptop, gym, trip…',
    amount: 'How much?',
    recurring: 'How often?',
    recurringOptions: { once: 'One-time', monthly: 'Monthly', yearly: 'Yearly' },
    payWith: 'How would you pay?',
    payWithOptions: { cash: 'Cash', card: 'Card', loan: 'Loan' },
    payWithHints: {
      cash: 'From savings.',
      card: 'Paid down from what’s left each month.',
      loan: 'Add the loan terms below.',
    },
    loanTitle: 'Loan terms',
    apr: 'APR',
    termMonths: 'Term',
    termSuffix: 'months',
    downPayment: 'Down payment',
    fees: 'Fees',
    feesHint: 'Added to the loan.',
    errors: {
      amount: 'Enter a price above $0.',
      label: 'Keep the name under 120 characters.',
      'loan.apr': 'Enter the APR (0% to 100%).',
      'loan.termMonths': 'Enter a whole number of months (1 to 600).',
      'loan.downPayment': 'The down payment can’t be more than the price.',
      'loan.fees': 'Fees can’t be negative.',
      'loan.amount': 'Enter a price above $0.',
      payWith: 'Check the payment details.',
    } as Record<string, string>,
    /** Example chips: tapping one fills the form (name + price). Inputs, not results. */
    examplesTitle: 'Try one',
    examples: [
      { label: 'New phone', amount: 999 },
      { label: 'Trip', amount: 1200 },
      { label: 'Couch', amount: 2400 },
      { label: 'Car', amount: 28000 },
    ],
    /** `amount` is already formatted. */
    example: (label: string, amount: string) => `${label} ${amount}`,
    fixFields: 'Fix the highlighted fields.',
    empty: 'Enter a price to check.',
  },

  parse: {
    /** The link under the form that opens the one-sentence box (the fields stay the main path). */
    open: 'Or type it in one sentence',
    close: 'Hide the sentence box',
    label: 'Describe the purchase',
    placeholder: 'A $1,800 laptop, on my card',
    submit: 'Check',
    parsing: 'Checking…',
    confirmTitle: 'Is this right?',
    confirm: 'Use these',
    cancel: 'Not right',
    fields: { label: 'Item', amount: 'Price', recurring: 'How often', payWith: 'Pay with', apr: 'APR', termMonths: 'Term' },
    termMonths: (n: number) => months(n),
    guessed: 'guessed',
    errors: {
      unavailable: ai.parse.errors.unavailable,
      nothingFound: ai.parse.errors.nothing_found,
      rateLimited: ai.parse.errors.rate_limited,
      badInput: 'We could not read that. Try different words, or use the form.',
      invalidResponse: ai.parse.errors.invalid_output,
      network: 'We could not reach the server. Check your connection, or use the form.',
      incomplete: 'Some details are missing from what you typed. Fill them in on the form.',
      other: ai.parse.errors.upstream_error,
    },
    useForm: 'Use the form',
  },

  result: {
    title: 'The verdict',
    loading: 'Checking…',
    /** The tilted sticker on the answer card: the verdict in one word. */
    stickers: { fits: 'Go', wait: 'Wait', no: 'No' },
    effectsLabel: 'Net worth vs not buying',
    /** Fact cards under the answer: the net worth change at a horizon, vs not buying. */
    effects: {
      1: 'net worth after this month, vs not buying',
      12: 'net worth in 1 year, vs not buying',
      60: 'net worth in 5 years, vs not buying',
      120: 'net worth in 10 years, vs not buying',
    } as Record<number, string>,
    /** JF14: where you will be with vs without the purchase (amounts formatted by the UI), not a signed delta. */
    withVsWithout: {
      label: 'Where you’ll be, with vs without it',
      with: 'With it',
      without: 'Without it',
      /** Under each amount: the horizon it is read at. */
      at: { 1: 'after this month', 12: 'in 1 year', 60: 'in 5 years', 120: 'in 10 years' } as Record<number, string>,
      /** The cost in words; `amount` is the positive difference, formatted. */
      costs: (amount: string, when: string) => `It costs you about ${amount} of net worth ${when}.`,
      gains: (amount: string, when: string) => `It leaves you about ${amount} ahead ${when}.`,
      same: (when: string) => `It barely changes your net worth ${when}.`,
    },
    detailsTitle: 'Details: other years and the cheapest way to pay',
    verdicts: {
      fits: 'Yes, it fits.',
      wait: (n: number) => `Yes, in ${months(n)}.`,
      no: 'Not right now.',
    },
    /** Collapsed: how the verdict is decided. */
    howTitle: 'How we decide',
    how: 'We check every month of the next year: a cash cushion, a safe debt load and, on a card, paying it off within 12 months.',
    waitBody: (n: number) => `Bought in ${months(n)}, every month of the year after passes.`,
    /** Why buying now fails, per rule. `cushion` gets "1 month", `red` gets "36%". */
    failsOn: {
      cushion: (cushion: string) => `Your cash would drop below ${cushion} of costs within a year.`,
      debtLoad: (red: string) => `Debt payments would top ${red} of take-home pay.`,
      cardRevolves: 'You couldn’t pay the card off within 12 months.',
    },
    cushionMonths: (n: number) => months(n),
    baseline: {
      fits: 'Heads up: your plan is already tight this year. This doesn’t make it worse.',
      wait: 'Your plan is tight for a few months, even without this.',
      no: 'Your plan is already tight, and this makes it worse.',
    },
    chartTitle: (label: string) => `Net worth with and without: ${label}`,
    chartWith: (label: string) => `With ${label}`,
    chartWithout: 'Without it',
    chartFootnote: 'Future (nominal) dollars. The band is the likely range from estimates.',
    horizonsTitle: 'See the numbers',
    horizonsCaption: 'Net worth with and without the purchase, in future (nominal) dollars',
    horizonHeaders: { when: 'When', with: 'With it', without: 'Without it', delta: 'Difference' },
    horizons: { 1: 'After this month', 12: 'In 1 year', 60: 'In 5 years', 120: 'In 10 years' } as Record<number, string>,
    cheapestTitle: 'cheapest way to pay',
    cheapestWays: { cash: 'Cash', card: 'Card', loan: 'Loan' },
    /** Ghost action next to the save button: switch the form to the cheapest way. */
    tryCheapest: { cash: 'Try paying cash', card: 'Try the card, paid off fast', loan: 'Try your loan' },
    cheapestHint: 'Cheapest = most net worth in 10 years. On a card, paid off fast. A loan counts only once you give its terms.',
    cheapestSame: 'Same as your plan.',
    cheapestDifferent: 'Cheaper than your plan.',
    errors: {
      notImplemented: 'This calculation is still being built. Try again soon.',
      other: 'Something went wrong with this calculation.',
    },
  },

  /** Under the page: where the numbers come from (the app footer carries the disclaimer). */
  footnote: 'Verdicts and net worth numbers come from the rules engine on your plan (canAfford).',

  wishlist: {
    title: 'Your wishlist',
    count: (n: number) => (n === 0 ? 'Nothing saved yet.' : n === 1 ? '1 thing saved' : `${n} things saved`),
    /** The small ink pill next to the save button. */
    proPill: 'Pro',
    add: 'Save to wishlist',
    added: 'Saved to your wishlist.',
    load: 'Check again',
    remove: 'Remove',
    removeLabel: (label: string) => `Remove ${label} from the wishlist`,
    loadLabel: (label: string) => `Check ${label} again`,
    recurring: { once: 'one-time', monthly: 'per month', yearly: 'per year' },
    payWith: { cash: 'cash', card: 'card', loan: 'loan' },
  },
} as const;
