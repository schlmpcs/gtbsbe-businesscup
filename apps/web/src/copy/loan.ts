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
  /** JF14: what is left over each month (take-home minus spending and debt payments); amounts formatted by the UI. */
  leftOver: {
    title: 'Left over each month',
    after: (name: string) => `after ${name}`,
    today: 'today, before any new loan',
    /** `before` = today's amount, formatted. */
    vsToday: (before: string) => `vs ${before} today`,
    short: (amount: string) => `${amount} short`,
    shortNote: 'More would go out each month than comes in.',
  },
  /** JF16: secondary sections sit behind these disclosures. */
  disclosures: { parse: 'Type an offer in words', extra: 'Pay extra each month', payoff: 'Which debt to pay first' },

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

  /**
   * The debt payoff planner (M13): a section below the offers. It describes what each method does and never which
   * one to use; no lender, consolidation or refinancing words (wording guardrails: plannerCopy.test.ts).
   * Dates and amounts come in already formatted.
   */
  planner: {
    title: 'Debt payoff planner',
    intro:
      'Your debts, plus the selected offer as a new debt, paid off three ways. Projected from your inputs: an educational simulation, not financial advice.',
    loading: 'Working out your plan…',
    hidden: 'Hidden in streamer mode.',
    noDebts: 'No debts to plan yet.',
    editDebts: 'Edit your debts',
    errors: {
      invalidResponse: 'We couldn’t read this plan. Check your debts and try again.',
      other: 'Something went wrong with this plan. Check your debts and try again.',
    },
    /** Date as the screen prints it: "March 2030" (month name and year already formatted). */
    monthYear: (month: string, year: number) => `${month} ${year}`,
    months: (n: number) => months(n),
    estimate: 'At least one minimum payment is an estimate, so these dates and amounts are estimates too.',
    assumptions:
      'Under our assumptions: balances and rates stay as entered and every payment is made on time. A projection, not a promise.',

    extra: {
      label: 'Extra per month, on all your debts',
      inputLabel: 'Or type an amount',
      perMonth: '/mo',
      hint: 'On top of your minimum payments. This is separate from the extra payment on the selected offer above.',
      /**
       * Under the box while the extra is still the starting suggestion (engine suggestedPayoffExtra): where the amount
       * came from. `share` is a percent and `left` this month's surplus with these debts, both already formatted.
       */
      suggested: {
        share: (share: string, left: string) =>
          `We started you at ${share} of the ${left} a month left after your spending and the minimums on these debts. Change it to any amount.`,
        nothingLeft: 'We started you at $0: after your spending and the minimums on these debts, nothing is left over each month.',
        littleLeft: (left: string) =>
          `We started you at $0: after your spending and the minimums on these debts, only ${left} a month is left over.`,
      },
    },

    method: {
      legend: 'Method',
      names: { avalanche: 'Avalanche', snowball: 'Snowball', minimum: 'Minimums only' },
      describes: {
        avalanche: 'Highest rate first. Pays the least interest.',
        snowball: 'Smallest balance first. Closes accounts sooner.',
        minimum: 'Only the minimum payments. The baseline.',
      },
    },

    compare: {
      title: 'Side by side',
      caption: 'Payoff methods compared',
      metric: 'Per method',
      picked: 'Your pick',
      rows: { debtFree: 'Debt-free', interest: 'Total interest', months: 'Months' },
      never: 'Not at these payments',
    },

    savings: {
      /** Leads the sentence, so it ends with its own colon. */
      title: (method: string) => `${method} against minimums only:`,
      interestSaves: (amount: string) => `${amount} less interest`,
      interestCosts: (amount: string) => `${amount} more interest`,
      interestSame: 'About the same interest',
      monthsSaves: (n: number) => `${months(n)} sooner`,
      monthsCosts: (n: number) => `${months(n)} later`,
      monthsSame: 'the same debt-free month',
      minimumNever: 'Minimums only never pay these off, so there is nothing to compare this plan with.',
    },

    /** One line under the comparison when methods come out the same, saying why (model/payoffTie.ts). */
    tie: {
      noExtra: 'With no extra, all three pay the same total each month, so they end the same way. Add an extra amount to compare them.',
      tooSmall: 'At this extra, all three come out about the same. A larger amount shows the difference.',
      oneDebt: 'With one debt there is nothing to put in order, so avalanche and snowball are the same plan.',
      sameOrder: 'Avalanche and snowball match here: sorting your debts by rate and by balance gives the same order.',
      sameResult: 'Avalanche and snowball pay your debts in a different order, but at this extra they come out the same.',
    },

    never: {
      title: 'Not at these payments',
      body: 'At these payments your debts are not paid off within the 100 years this simulation runs.',
      /** A total extra on top of the minimums, not on top of any extra already set; "within 10 years" (a whole number of years). */
      fix: (extra: string, years: number) => `A total extra of ${extra} a month would clear it within ${years} years.`,
      fixNone: 'No extra payment within the limits of this simulation would clear it.',
    },

    chart: {
      title: 'Total balance over time',
      minimum: 'Minimums only',
      footnote: 'Projected from your inputs. In dollars owed, before inflation.',
    },

    order: {
      title: 'Payoff order',
      note: (method: string) => `${method}: each payment freed up rolls into the next debt.`,
      newLoan: (name: string) => `${name} (new)`,
      /** "Credit card · 24.4%" (rate already formatted). */
      step: (label: string, apr: string) => `${label} · ${apr}`,
      paidBy: (date: string) => `paid off ${date}`,
      notWithin: 'not within 100 years',
    },

    target: {
      title: 'Debt-free by a date',
      label: 'Debt-free by',
      hint: 'Pick a month to see the extra payment it would take.',
      /** Shown in a box that wants a year and month, where the browser has no month picker. */
      placeholder: 'YYYY-MM',
      clear: 'Clear',
      invalid: 'Enter a month, like 2030-12.',
      past: 'Pick a month after this one.',
      tooFar: (years: number) => `Pick a month within the next ${years} years: the simulation stops there.`,
      /** The total extra per month on top of the minimums (not on top of the extra already set). */
      needs: (date: string, extra: string) => `To be debt-free by ${date}: a total extra of ${extra} a month.`,
      /** After `needs`, when an extra is already set: how much more than that is (already formatted). */
      needsMore: (more: string) => `That is ${more} more than you have set.`,
      onTrack: (date: string, extra: string) => `You’re on track: an extra ${extra} a month finishes by ${date}.`,
      /** The Minimums-only plan finishes by then, and so does the picked method with no extra: nothing on top is needed. */
      onTrackMinimums: (date: string) => `You’re on track: your minimum payments finish by ${date}.`,
      /** No extra is set and the picked method finishes by then, but the Minimums-only plan does not (`method` is its name). */
      onTrackNoExtra: (date: string, method: string) => `You’re on track: with no extra, the ${method.toLowerCase()} plan finishes by ${date}.`,
      unreachable: (date: string) =>
        `Not reachable by ${date} with extra payments alone, within the limits of this simulation.`,
      error: 'We couldn’t work this out. Check your debts and try again.',
    },
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
      badInput: 'We could not read that. Try different words or a clearer photo, or use the form.',
      invalidResponse: ai.parse.errors.invalid_output,
      network: 'We could not reach the server. Check your connection, or use the form.',
      incomplete: 'Some details are missing (APR, term or amount). Fill them in on the form.',
      other: ai.parse.errors.upstream_error,
    },
    useForm: 'Use the form',
    /** JF9: read a photo, screenshot or PDF of a lender or dealer offer. */
    scan: 'Or scan an offer (photo, screenshot or PDF)',
    scanning: 'Reading your file…',
    privacy: 'We read it and don\'t keep it.',
    fromImage: 'Read from your file. Check every number before you add it.',
  },

  errors: {
    notImplemented: 'This calculation is still being built. Try again soon.',
    other: 'Something went wrong with this calculation.',
  },
} as const;
