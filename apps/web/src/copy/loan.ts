// Strings for Loan Lab (S12). Owner: Amir (Y11).
// Functions take numbers already formatted by the UI (formatMoney / formatRate), never raw values.
import { ai } from './ai';

const months = (n: number) => (n === 1 ? '1 month' : `${n} months`);

export const loan = {
  screens: {
    S12: 'Loan Lab',
  },

  intro: 'Compare up to 3 loan offers side by side, see what each does to your debt load, and try paying a little extra.',
  loading: 'Loading your plan…',

  offerName: (n: number) => `Offer ${n}`,

  /** The big headline: the selected offer's amount (formatted) and how many offers are compared. */
  headline: (amount: string) => `${amount} loan.`,
  ways: (n: number) => (n === 1 ? 'One way.' : n === 2 ? 'Two ways.' : n === 3 ? 'Three ways.' : `${n} ways.`),
  /** Chips with the selected offer's terms (values already formatted). */
  terms: {
    label: 'The selected offer',
    price: (v: string) => `Price ${v}`,
    down: (v: string) => `Down ${v}`,
    fees: (v: string) => `Fees ${v}`,
  },

  compare: {
    title: 'Side by side',
    caption: 'Loan offers compared',
    metric: 'Per offer',
    rows: {
      monthly: 'Monthly payment',
      totalInterest: 'Total interest',
      totalCost: 'Total cost',
      payoff: 'Paid off in',
      debtLoad: 'Debt load after',
    },
    totalCostHint: 'Everything you pay: down payment, fees and interest included.',
    payoffMonths: (n: number) => months(n),
    never: 'Never',
    lowestCost: 'Lowest cost',
    lowestMonthly: 'Lowest monthly',
    invalid: 'Fix this offer',
    failed: 'Can’t compute',
    select: (name: string) => `Show ${name}`,
    selected: 'Selected',
    /** "36 months at 6.9%" (rate already formatted). */
    offerTerms: (termMonths: number, apr: string) => `${months(termMonths)} at ${apr}`,
    perMonth: 'a month',
  },

  neverPaysOff: (name: string) =>
    `${name} never pays off: the monthly payment doesn’t even cover the interest, so the balance never goes down.`,

  edit: {
    title: 'Edit offers',
    tabsLabel: 'Loan offers',
    amount: 'Loan amount',
    amountHint: 'The price before any down payment.',
    apr: 'APR',
    aprHint: 'The yearly rate on the offer, e.g. 6.9%.',
    termMonths: 'Term',
    termSuffix: 'months',
    downPayment: 'Down payment',
    fees: 'Fees',
    feesHint: 'Rolled into the loan.',
    add: 'Add an offer',
    full: 'You are comparing the most offers (3). Remove one to add another.',
    remove: (name: string) => `Remove ${name}`,
    errors: {
      amount: 'Enter an amount of $0 or more.',
      apr: 'Enter the APR (0% to 100%).',
      termMonths: 'Enter a whole number of months (1 to 600).',
      downPayment: 'The down payment can’t be more than the amount.',
      fees: 'Fees can’t be negative.',
    } as Record<string, string>,
    empty: 'No offers yet. Add one to start comparing.',
  },

  gauge: {
    title: 'Debt load',
    before: 'Today',
    after: (name: string) => `With ${name}`,
    hint: 'Monthly debt payments as a share of take-home pay.',
    guidance: (yellow: string, red: string) =>
      `Rule of thumb lenders use: under ${yellow} is comfortable, above ${red} is risky. Guidance, not a hard limit.`,
    zones: { low: 'Comfortable', medium: 'Stretched', high: 'Risky' },
    noOffer: 'Pick a valid offer to see your debt load with it.',
    arrow: '→',
    caption: (name: string) => `of your take-home pay goes to debt with ${name}`,
    captionToday: 'of your take-home pay goes to debt today',
    /** Zone labels on the bar; `red` is already formatted. */
    risky: (risky: string, red: string) => `${risky} · ${red}+`,
    unknown: 'We can’t compute a debt load without a take-home pay.',
  },

  extra: {
    title: 'Pay a little extra',
    onTopOf: (amount: string) => `on top of ${amount} a month`,
    slider: (name: string) => `Extra each month on ${name}`,
    perMonth: '/mo',
    payoff: 'Paid off in',
    interest: 'Total interest',
    payoffMonths: (n: number) => months(n),
    never: 'Never',
    monthsSaved: (n: number) => `${months(n)} sooner`,
    interestSaved: (amount: string) => `${amount} less interest`,
    noChange: 'No change yet. Slide to add an extra payment.',
    neverEvenWithExtra: 'Even with this extra payment, the loan never pays off.',
    noOffer: 'Pick a valid offer to try extra payments.',
  },

  payoffOrder: {
    title: 'Pay off in this order',
    kinds: {
      card: 'Credit card',
      auto: 'Car loan',
      student: 'Student loan',
      personal: 'Personal loan',
      bnpl: 'Buy now, pay later',
      mortgage: 'Mortgage',
    } as Record<string, string>,
    /** The selected offer, added as a new debt. */
    newLoan: (name: string) => `${name} (new)`,
    /** "Credit card · 24.4%" (rate already formatted). */
    step: (label: string, apr: string) => `${label} · ${apr}`,
    payoff: (n: number) => `Everything paid off in ${months(n)} with minimum payments.`,
    never: 'At minimum payments, these debts never pay off.',
    note: 'Highest rate first (the avalanche method): each paid-off debt’s payment rolls into the next.',
  },

  parse: {
    title: 'Or just type an offer',
    label: 'Describe the loan',
    placeholder: '28k at 6.9% for 5 years, $495 fees',
    submit: 'Read it',
    parsing: 'Reading…',
    confirmTitle: 'Is this right?',
    confirmNote: ai.parse.confirmNote,
    inferredNote: 'We guessed the highlighted values. Check them.',
    confirmAdd: 'Add this offer',
    confirmReplace: 'Replace the selected offer',
    cancel: 'Not right',
    fields: { amount: 'Amount', apr: 'APR', termMonths: 'Term', downPayment: 'Down payment', fees: 'Fees' },
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

  errors: {
    notImplemented: 'This calculation is still being built. Try again soon.',
    other: 'Something went wrong with this calculation.',
  },
} as const;
