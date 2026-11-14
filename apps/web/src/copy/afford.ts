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
    amount: 'Price',
    recurring: 'How often?',
    recurringOptions: { once: 'One-time', monthly: 'Every month', yearly: 'Every year' },
    payWith: 'Pay with',
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
    examplesTitle: 'Or try one',
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
    /** The sticker on the verdict tile. */
    sticker: 'Verdict',
    effectsLabel: 'Net worth vs not buying',
    effects: { 1: 'this month', 12: 'in 1 year', 60: 'in 5 years', 120: 'in 10 years' } as Record<number, string>,
    verdicts: {
      fits: 'Yes, it fits',
      wait: (n: number) => `Wait ${months(n)}`,
      no: 'Not right now',
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
    cheapestTitle: 'Cheapest way to pay',
    cheapestWays: { cash: 'Cash', card: 'Credit card, paid off fast', loan: 'Your loan' },
    cheapestHint: 'Cheapest = most net worth in 10 years. A loan counts only once you give its terms.',
    cheapestSame: 'Same as your plan.',
    cheapestDifferent: 'Cheaper than your plan.',
    errors: {
      notImplemented: 'This calculation is still being built. Try again soon.',
      other: 'Something went wrong with this calculation.',
    },
  },

  wishlist: {
    title: 'Wishlist',
    count: (n: number) => `Wishlist: ${n === 1 ? '1 thing' : `${n} things`}`,
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
