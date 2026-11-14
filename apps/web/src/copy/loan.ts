// Strings for Loan Lab (S12). Owner: Amir (Y11).
// Functions take numbers already formatted by the UI (formatMoney / formatRate), never raw values.
import { ai } from './ai';

const months = (n: number) => (n === 1 ? '1 month' : `${n} months`);

export const loan = {
  screens: {
    S12: 'Loan Lab',
  },

  intro: 'Compare up to 3 offers. See the real cost before you sign.',
  loading: 'Loading your plan…',

  /** Offers are lettered: Offer A, Offer B, Offer C (n starts at 1). */
  offerName: (n: number) => `Offer ${n >= 1 && n <= 26 ? String.fromCharCode(64 + n) : n}`,

  /** An offer's down payment and fees under its terms (values already formatted). */
  terms: {
    down: (v: string) => `${v} down`,
    fees: (v: string) => `${v} fees`,
  },

  /**
   * The ink band under the offers: which offer costs the least overall and which has the lowest monthly
   * payment, with the engine's numbers (already formatted). `names` is already joined ("Offer A").
   */
  verdict: {
    label: 'The bottom line',
    lowestBoth: (names: string, total: string, monthly: string) =>
      `${names} costs the least overall (${total}) and the least each month (${monthly}).`,
    lowestCost: (names: string, total: string) => `${names} costs the least overall: ${total} in total.`,
    lowestMonthly: (names: string, monthly: string) => `${names} has the lowest monthly payment: ${monthly}.`,
    and: ' and ',
    none: 'Fix the offers above to compare them.',
  },

  /** Under the page: where the numbers come from (the app footer carries the disclaimer). */
  footnote: 'Numbers from the loan math on your profile. We don’t recommend lenders.',

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
    totalCostHint: 'Down payment, fees and interest included.',
    payoffMonths: (n: number) => months(n),
    never: 'Never',
    lowestCost: 'Least overall',
    lowestMonthly: 'Lowest monthly',
    invalid: 'Fix this offer',
    failed: 'Can’t compute',
    select: (name: string) => `Show ${name}`,
    selected: 'Selected',
    /** "36 months at 6.9%" (rate already formatted). */
    offerTerms: (termMonths: number, apr: string) => `${months(termMonths)} at ${apr}`,
    perMonth: 'a month',
    /** Labels of the term boxes on each offer card. */
    /** The bold "$3,078 interest · $31,078 total" line. */
    inline: { totalInterest: 'interest', totalCost: 'total' },
    boxes: { amount: 'Amount', apr: 'APR', term: 'Term' },
    termShort: (n: number) => (Number.isFinite(n) ? `${n} mo` : '–'),
  },

  neverPaysOff: (name: string) => `${name} never pays off: the payment doesn’t cover the interest.`,

  edit: {
    /** The small toggle on each offer card that opens its fields inline. */
    open: 'Edit',
    close: 'Done',
    openLabel: (name: string) => `Edit ${name}`,
    closeLabel: (name: string) => `Done editing ${name}`,
    fieldsLabel: (name: string) => `${name} terms`,
    amount: 'Loan amount',
    apr: 'APR',
    termMonths: 'Term',
    termSuffix: 'months',
    downPayment: 'Down payment',
    fees: 'Fees',
    feesHint: 'Rolled into the loan.',
    add: 'Add an offer',
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
    /** Collapsed explainer under the bar. */
    howTitle: 'What’s debt load?',
    hint: 'Monthly debt payments as a share of take-home pay.',
    guidance: (yellow: string, red: string) =>
      `Lenders’ rule of thumb: under ${yellow} is comfortable, above ${red} is risky. Guidance, not a hard limit.`,
    zones: { low: 'Comfortable', medium: 'Stretched', high: 'Risky' },
    noOffer: 'Pick a valid offer to compare.',
    arrow: '→',
    caption: (name: string) => `of take-home pay to debt, with ${name}`,
    captionToday: 'of take-home pay to debt today',
    /** Zone labels on the bar; `red` is already formatted. */
    risky: (risky: string, red: string) => `${risky} · ${red}+`,
    unknown: 'We can’t compute a debt load without a take-home pay.',
  },

  extra: {
    title: 'Pay a little extra',
    slider: (name: string) => `Extra each month on ${name}`,
    perMonth: '/mo',
    payoff: 'Paid off in',
    interest: 'Total interest',
    payoffMonths: (n: number) => months(n),
    never: 'Never',
    monthsSaved: (n: number) => `${months(n)} sooner`,
    interestSaved: (amount: string) => `${amount} less interest`,
    noChange: 'Slide to pay extra.',
    neverEvenWithExtra: 'Still never pays off.',
    noOffer: 'Pick a valid offer first.',
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
    payoff: (n: number) => `All paid off in ${months(n)} at minimums.`,
    never: 'At minimums, these never pay off.',
    note: 'Highest rate first; each freed payment rolls into the next.',
  },

  parse: {
    /** The link that opens the one-sentence box (editing on the cards stays the main path). */
    open: 'Or type an offer in one sentence',
    close: 'Hide the sentence box',
    label: 'Describe the loan',
    placeholder: '28k at 6.9% for 5 years, $495 fees',
    submit: 'Read it',
    parsing: 'Reading…',
    confirmTitle: 'Is this right?',
    confirmAdd: 'Add this offer',
    confirmReplace: 'Replace selected offer',
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
