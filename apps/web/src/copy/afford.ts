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

  intro: 'Check a purchase against your plan before you buy. We test the next 12 months with and without it.',
  loading: 'Loading your plan…',

  form: {
    title: 'What do you want to buy?',
    label: 'What is it?',
    labelPlaceholder: 'Laptop, gym, trip…',
    amount: 'Price',
    amountHint: 'For a monthly or yearly cost, the amount each time.',
    recurring: 'How often?',
    recurringOptions: { once: 'One-time', monthly: 'Every month', yearly: 'Every year' },
    payWith: 'Pay with',
    payWithOptions: { cash: 'Cash', card: 'Credit card', loan: 'A loan' },
    payWithHints: {
      cash: 'From your savings.',
      card: 'Charged to a card, then paid down from what you have left each month.',
      loan: 'Borrow the price; enter the loan terms below.',
    },
    loanTitle: 'Loan terms',
    apr: 'APR',
    aprHint: 'The yearly rate on the offer, e.g. 6.9%.',
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
    fixFields: 'Fix the highlighted fields to see the result.',
    empty: 'Enter a price to see if it fits.',
  },

  parse: {
    title: 'Or just type it',
    label: 'Describe the purchase',
    placeholder: 'A $1,200 laptop on my card',
    submit: 'Read it',
    parsing: 'Reading…',
    confirmTitle: 'Is this right?',
    confirmNote: ai.parse.confirmNote,
    inferredNote: 'We guessed the highlighted values. Check them.',
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
    verdicts: {
      fits: 'Yes, it fits',
      wait: (n: number) => `Wait ${months(n)}`,
      no: 'Not right now',
    },
    fitsBody: 'Every month for the next year passes our checks: a cash cushion, a safe debt load and, on a card, paying it off within 12 months.',
    waitBody: (n: number) => `If you buy it in ${months(n)}, every month for the year after passes our checks.`,
    /** Why buying now fails, per rule. `cushion` gets "1 month", `red` gets "36%". */
    failsOn: {
      cushion: (cushion: string) =>
        `Buying it now would drop your cash below your safety cushion (${cushion} of spending and bills) in the next 12 months.`,
      debtLoad: (red: string) =>
        `Its payments would push your debt payments above ${red} of your take-home pay, the usual limit lenders use.`,
      cardRevolves:
        'On a card, you could not pay it off within 12 months from what you have left each month, so it would build interest at card rates.',
    },
    cushionMonths: (n: number) => months(n),
    baseline: {
      fits: 'Heads up: your plan already dips below the cash cushion or above the debt-load limit in the next 12 months, with or without this purchase. This purchase doesn’t make that worse.',
      wait: 'Your plan is already under strain in the next few months, even without this purchase. Once it recovers, the purchase fits.',
      no: 'Your plan already breaks one of these rules in the next 12 months, even without this purchase. Buying it now makes it worse:',
    },
    chartTitle: (label: string) => `Net worth with and without: ${label}`,
    chartWith: (label: string) => `With ${label}`,
    chartWithout: 'Without it',
    chartFootnote: 'In future (nominal) dollars, not adjusted for inflation. The band is the likely range from estimated inputs.',
    horizonsTitle: 'Net worth over time',
    horizonsCaption: 'Net worth with and without the purchase, in future (nominal) dollars',
    horizonHeaders: { when: 'When', with: 'With it', without: 'Without it', delta: 'Difference' },
    horizons: { 1: 'After this month', 12: 'In 1 year', 60: 'In 5 years', 120: 'In 10 years' } as Record<number, string>,
    cheapestTitle: 'Cheapest way to pay',
    cheapestWays: { cash: 'Cash', card: 'Credit card, paid off fast', loan: 'Your loan' },
    cheapestHint: 'The way that leaves you with the most net worth in 10 years. A loan is compared only when you give its terms.',
    cheapestSame: 'That’s how you planned to pay.',
    cheapestDifferent: 'Cheaper than how you planned to pay.',
    errors: {
      notImplemented: 'This calculation is still being built. Try again soon.',
      other: 'Something went wrong with this calculation.',
    },
  },

  wishlist: {
    title: 'Wishlist',
    add: 'Save to wishlist',
    added: 'Saved to your wishlist.',
    empty: 'Nothing saved yet. Save a purchase to check it again later.',
    load: 'Check again',
    remove: 'Remove',
    removeLabel: (label: string) => `Remove ${label} from the wishlist`,
    loadLabel: (label: string) => `Check ${label} again`,
    recurring: { once: 'one-time', monthly: 'per month', yearly: 'per year' },
    payWith: { cash: 'cash', card: 'card', loan: 'loan' },
  },
} as const;
