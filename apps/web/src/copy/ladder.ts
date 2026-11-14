// Strings for the "guess yourself" ladder (S5–S9 UI). Owner: Amir (Y9).
// S9's screen title lives in ./upload.ts (T6/T7); the S9 screen's own strings are under `upload` here.
import type { Debt, KidAge } from '@lifeguessr/types';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** 'YYYY-MM' → "Oct 2026" (falls back to the raw text when it is not a month). */
function monthName(month: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  const name = m ? MONTH_NAMES[Number(m[2]) - 1] : undefined;
  return m && name ? `${name} ${m[1]}` : month;
}

const debtKinds: Record<Debt['kind'], string> = {
  card: 'Credit card',
  auto: 'Car loan',
  student: 'Student loan',
  personal: 'Personal loan',
  bnpl: 'Buy now, pay later',
  mortgage: 'Mortgage',
};

const kidAges: Record<KidAge, string> = {
  infant: 'infant',
  toddler: 'toddler',
  preschool: 'preschooler',
  schoolAge: 'school-age kid',
};

const plural = (n: number, one: string, many: string) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

/** 'YYYY-MM-DD' → "Oct 3, 2026" (falls back to the raw text when it is not a date). */
function dayName(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const name = m ? MONTH_NAMES[Number(m[2]) - 1] : undefined;
  return m && name ? `${name} ${Number(m[3])}, ${m[1]}` : date;
}

export const ladder = {
  /** Screen titles (also each rung's h1, as in the Figma frames). */
  screens: {
    S5: 'What does your month cost?',
    S6: 'Pick the life closest to yours',
    S7: 'Your month',
    S8: 'Pay, savings and debts',
  },

  /** Shared frame of every rung: the step pills, the headline, the footer (text action + CTA). */
  shell: {
    intro: {
      S5: 'Rent, car, food, everything. Just guess.',
      S6: 'We start from its numbers. Next, your statement makes them yours.',
      S7: 'No statement at hand? Drag to match a normal month. Tagged amounts are our estimates.',
      S8: 'Six taps. Skip anything; we’ll use estimates and tag them.',
      S9: 'Drop a bank statement (CSV) and we sort your month into categories. Nothing to type.',
    },
    back: '← Back',
    stepsLabel: 'Steps to your forecast',
    rungs: {
      S5: 'Your guess',
      S6: 'Closest life',
      S7: 'Your month',
      S8: 'Pay & savings',
      S9: 'Your spending',
    },
    done: 'done',
    notYet: 'not yet',
    current: 'this step',
    stepsDone: (done: number, total: number) => `${done} of ${total} steps done`,
    /** The last step only: one short line above the CTA (net worth in 10 years, today's dollars). */
    in10yLabel: 'You in 10 years:',
    /** The one orange CTA of each rung: the next step, and on the last step the forecast. */
    cta: {
      S5: 'Next: closest life →',
      S6: 'Next: your spending →',
      S7: 'Next: pay & savings →',
      S8: 'See me in 10 years →',
      S9: 'Next: pay & savings →',
      last: 'See me in 10 years →',
    },
    /**
     * The text link on the left of the CTA. `step`: go to the next step. `statement` (S7): back to
     * importing one (S9 has no text link: its "No statement?" card leads here). `last`: straight
     * to the forecast, keeping the estimates.
     */
    skip: {
      step: 'Skip this step',
      statement: '← Import a statement instead',
      last: 'Skip, use estimates',
    },
    loading: 'Loading your numbers…',
  },

  guess: {
    sliderLabel: 'Your monthly cost',
    aMonth: 'a month',
    /** The game-based line under the slider ("You guessed 4 of 5 homes too low today"). */
    bridgeLow: (n: number, played: number) => `You guessed ${n} of ${played} ${played === 1 ? 'home' : 'homes'} too low today`,
    bridgeHigh: (n: number, played: number) => `You guessed ${n} of ${played} ${played === 1 ? 'home' : 'homes'} too high today`,
    plotSticker: 'Your house starts here',
    submit: 'Lock my guess →',
    update: 'Update my guess',
    saved: 'Saved',
    compareTitle: 'Guess vs. estimate',
    yourGuess: 'Your guess',
    ourEstimate: 'Our estimate',
    perMonth: '/mo',
    basis: {
      demo: 'Estimate for a sample profile.',
      closestLife: 'Estimate for the life you picked.',
      user: 'Estimate from your numbers so far.',
    },
    above: (amount: string, share: string) => `${amount} (${share}) over our estimate`,
    below: (amount: string, share: string) => `${amount} (${share}) under our estimate`,
    exact: 'Spot on!',
  },

  closest: {
    sortedByGuess: (guess: string) => `Closest to your ${guess} guess first.`,
    listLabel: 'Lives to start from',
    fromToday: 'Today’s game',
    sample: 'Sample',
    nearest: 'Closest',
    chosen: 'That’s me',
    perMonthSuffix: '/ month',
    /** The card's headline: "1 adult · studio", "2 adults · 2 kids · 3-bedroom". */
    headline: (adults: 1 | 2, kids: number, bedrooms: number) =>
      [
        adults === 1 ? '1 adult' : '2 adults',
        kids === 0 ? null : kids === 1 ? '1 kid' : `${kids} kids`,
        bedrooms === 0 ? 'studio' : `${bedrooms}-bedroom`,
      ]
        .filter(Boolean)
        .join(' · '),
    /** The full household, inside "Costs & sources". */
    household: (adults: 1 | 2, kids: readonly KidAge[], bedrooms: number) => {
      const people = adults === 1 ? '1 adult' : '2 adults';
      const kidText = kids.length === 0 ? 'no kids' : kids.map((k) => kidAges[k]).join(', ');
      const home = bedrooms === 0 ? 'studio' : `${bedrooms}-bedroom home`;
      return `${people}, ${kidText}, ${home}`;
    },
    car: (price: string) => `Car worth ${price}`,
    noCar: 'No car',
    monthlyRange: (low: string, high: string) => `Range ${low} to ${high}`,
    costsToggle: 'Costs & sources',
    costsLabel: (metro: string) => `Monthly costs for the ${metro} life`,
    choose: 'Start from this life',
    chooseLabel: (metro: string, caption: string) => `Start from this life: ${metro}, ${caption}`,
    chosenNote: 'All estimates for now. Next steps make them yours.',
    unavailable: 'No area data yet.',
  },

  sliders: {
    monthTitle: 'Your month',
    youGuessed: (amount: string) => `You guessed ${amount}`,
    yourMonth: 'Your month:',
    moreThanGuessed: (amount: string) => `+${amount} more than you thought`,
    lessThanGuessed: (amount: string) => `${amount} less than you thought`,
    breakdownLabel: 'This month by category',
    takeHome: 'Take-home pay',
    debtPayments: 'Debt payments',
    surplus: 'Left over',
    shortfall: 'Short',
    slidersTitle: 'Monthly spending',
    slidersLabel: 'Spending by category',
    /** Shown when the values come from an imported statement: the sliders are there to confirm them. */
    fromStatement: (months: readonly string[]) =>
      `From your statement (${months.length === 1 ? monthName(months[0]!) : `${monthName(months[0]!)} to ${monthName(months.at(-1)!)}`}). Untagged amounts are measured; drag only what looks off.`,
    savingsLabel: 'Retirement: share of what’s left',
    moreOptions: 'More options',
    describe: {
      /** The text link that opens the free-text box. */
      open: 'Or type it in one sentence',
      label: 'Describe your month in your own words',
      placeholder: 'Rent 1,800, groceries 500, eat out twice a week.',
      hint: 'You confirm before anything changes.',
      submit: 'Read my text',
      parsing: 'Reading…',
      confirmTitle: 'Is this right?',
      inferred: 'inferred',
      inferredHint: 'Not written in your text: we worked it out. Check it.',
      was: (value: string) => `now ${value}`,
      wasUnknown: 'not set',
      confirm: 'Use these numbers',
      discard: 'Discard',
      dismiss: 'OK, I’ll use the sliders',
      rowLabel: {
        retirementShare: 'Saved for retirement (share of what’s left over)',
        debtApr: (kind: string) => `${kind} APR`,
        debtExtraPayment: (kind: string) => `Extra payment on ${kind.toLowerCase()}`,
        unknownDebt: 'a debt',
      },
      /** By VMError kind. Every message ends by pointing at the sliders, the manual fallback. */
      errors: {
        unavailable: 'Text reading is off right now. Use the sliders.',
        incomplete: 'Something’s missing. Add detail, or use the sliders.',
        nothingFound: 'No amounts found. Try “rent 1,800, groceries 500”, or use the sliders.',
        badInput: 'Couldn’t read that. Try something simpler, or use the sliders.',
        rateLimited: 'Too many tries. Wait a moment, or use the sliders.',
        network: 'Can’t reach the server. Check your connection, or use the sliders.',
        invalidResponse: 'Couldn’t read that reliably. Use the sliders.',
        notImplemented: 'Text reading isn’t built yet. Use the sliders.',
        alreadyGuessed: 'Something went wrong. Use the sliders.',
        unknown: 'Something went wrong. Use the sliders.',
      },
    },
  },

  balance: {
    fieldsTitle: 'About you',
    payTitle: 'Age and take-home pay',
    savingsTitle: 'Savings',
    fields: {
      age: 'Your age',
      takeHomePay: 'Take-home pay',
      cash: 'Cash',
      retirement: 'Retirement',
    },
    hints: {
      takeHomePay: 'after tax, per month',
      cash: 'checking + savings',
      retirement: '401k, IRA',
    },
    estimatedHint: 'Typical amount. Type yours.',
    estimateSticker: 'Estimate',
    skip: 'Skip',
    skipLabel: (field: string) => `Use our estimate for ${field.toLowerCase()}`,
    yearsSuffix: 'years',
    perMonthSuffix: '/mo',
    debtsTitle: 'Debts',
    debtsLabel: 'Your debts',
    noDebts: 'No debts yet.',
    debtKinds,
    balanceLabel: 'Balance',
    aprLabel: 'APR',
    minPaymentLabel: 'Minimum payment',
    minPaymentPerMonth: (amount: string) => `${amount}/mo minimum`,
    minPaymentHint: 'Leave empty to estimate.',
    edit: 'Edit',
    editLabel: (kind: string) => `Edit ${kind.toLowerCase()}`,
    remove: 'Remove',
    removeLabel: (kind: string) => `Remove ${kind.toLowerCase()}`,
    addDebt: 'Add a debt',
    kindLabel: 'Type',
    save: 'Save debt',
    cancel: 'Cancel',
    formTitleAdd: 'New debt',
    formTitleEdit: (kind: string) => `Edit ${kind.toLowerCase()}`,
    debtLoadLabel: 'Debt load',
    debtLoadHint: 'Share of take-home pay',
    debtLoadZones: { low: 'Comfortable', medium: 'Stretched', high: 'Risky' },
    netWorthScore: 'Net worth today',
    netWorthNote: 'Cash + retirement − debts',
  },

  upload: {
    /**
     * The step opens with a fork (JF6): a statement is the main path, setting the month by hand
     * the fallback. Both options are on screen before anything else.
     */
    fork: {
      statementTitle: 'Have a bank CSV?',
      statementBadge: 'Most accurate · about a minute',
      byHandTitle: 'No statement?',
      byHandText: 'Set your month with a few sliders, or just type your expenses in your own words.',
      byHandLink: 'Set it by hand →',
    },
    /**
     * Follow-up questions on the review: what the statement can't settle by itself. The amounts
     * are computed in code; `template` words a question when the AI did not.
     */
    questions: {
      title: 'A few quick questions',
      note: 'Your statement can’t tell us these. Answer what you know and skip the rest; the months below follow your answers.',
      template: {
        merchant: (merchant: string) => `What is “${merchant}” mostly for?`,
        cash: 'What does your cash mostly pay for?',
        missing: (category: string) => `We found no ${category.toLowerCase()} in a full month. Do you pay for it from another account or card?`,
      },
      monthly: (amount: string) => `About ${amount} a month`,
      optionsLegend: 'It’s mostly',
      amountLabel: 'About how much a month?',
      amountSave: 'Add it',
      skip: 'Skip',
      change: 'Change',
      answeredCategory: (category: string) => `Counted as ${category.toLowerCase()}.`,
      answeredAmount: (amount: string) => `Added: ${amount} a month.`,
      skipped: 'Skipped: left as it is.',
    },
    pickerTitle: 'Drop a bank CSV here',
    pickerLabel: 'Bank statement (CSV)',
    pickerHint: 'We read the columns in your browser. The file itself never leaves it.',
    pickerUnavailable: 'Not switched on in this build yet.',
    /** Reads the sample statement fixture through the same steps as your own file. */
    trySample: 'Try with sample statement',
    trySampleHint: 'A made-up checking account, read the same way as yours.',
    reading: 'Reading your statement…',
    errors: {
      badInput: 'Its months or totals didn’t look right. Try another file.',
      unreadable: {
        notCsv: 'That isn’t a CSV. In your bank’s site, use “Download transactions” → CSV.',
        tooLarge: 'That file is too big. Export the last 3 to 6 months.',
        tooMany: 'Too many transactions. Export the last 6 months or less.',
        empty: 'That file is empty.',
        malformed: 'That CSV is broken (a quote is never closed). Export it again.',
        noColumns: 'No date, description and amount columns found. Try your bank’s CSV export.',
        noTransactions: 'No transactions found in that file.',
      },
      rateLimited: 'Too many uploads. Wait a minute and try again.',
      network: 'Can’t reach the server. Check your connection and try again.',
      unknown: 'Something went wrong. Try again.',
    },
    dismiss: 'Dismiss',
    reviewTitle: 'Check your months',
    reviewNote: 'Each category becomes your monthly average over the months the statement covers in full. Nothing changes until you confirm.',
    partialMonth: 'Part of a month: shown, but not in your averages.',
    readSummary: (transactions: number, from: string, to: string) =>
      `Read ${plural(transactions, 'transaction', 'transactions')} from ${dayName(from)} to ${dayName(to)}.`,
    skipped: (pending: number, other: number) =>
      [
        pending > 0 ? `${plural(pending, 'pending line', 'pending lines')} (they count once they post)` : null,
        other > 0 ? `${plural(other, 'line that isn’t a transaction', 'lines that aren’t transactions')}` : null,
      ].filter(Boolean).join(' and ') + ' left out.',
    readMore: 'Details',
    categorizedBy: {
      ai: 'Sorted into categories by AI from the masked labels. Every total is added up in code.',
      rules: 'Sorted into categories by keyword rules. Every total is added up in code.',
      mixed: 'Sorted into categories by AI and keyword rules. Every total is added up in code.',
    },
    excludedNote: 'Transfers between your own accounts and money from other people are not counted.',
    monthLabel: (month: string) => `Spending in ${monthName(month)}`,
    detectedPay: (amount: string) => `Take-home pay found: ${amount}`,
    oneOffsTitle: 'One-offs left out (not kept)',
    apply: 'Use these numbers',
    discard: 'Discard',
    applied: 'Done. Spending now uses your statement averages: the months it covers in full.',
    history: (months: readonly string[]) => `Months in your profile: ${months.map(monthName).join(', ')}.`,
    driftReady: 'Today can now flag categories drifting from your average.',
    driftNotYet: 'Drift alerts on Today start at 3 months.',
    keep: {
      title: 'What we keep',
      tools: 'Subscription findings and tick choices, overpaying inputs and payoff settings are stored in this browser only.',
      none: 'Nothing from a statement yet.',
      gist: 'Only monthly category totals and take-home pay. Never the file.',
      details: 'Exactly what we keep',
      onlyThis: 'From a statement we keep only:',
      months: (months: readonly string[]) =>
        months.length === 0 ? 'the month it covers' : `the months it covers (${months.map(monthName).join(', ')})`,
      totals: (categories: readonly string[]) =>
        categories.length === 0
          ? 'your total for each spending category, per month'
          : `your total per month for each category: ${categories.join(', ')}`,
      pay: 'your take-home pay, if the statement shows it',
      payFound: 'your take-home pay, found in your statement',
      where: 'They are stored in this browser.',
      server: 'Your profile, which holds the category averages and take-home pay, is also saved on our server under a random ID, with no name or email.',
      neverTitle: 'We never keep:',
      never: [
        'the file itself',
        'transaction descriptions or merchant names',
        'dates of single transactions',
        'one-off charges',
        'account numbers or names',
      ],
      sentTitle: 'What leaves your browser:',
      sent: 'only each line’s merchant label (account numbers masked, and personal names on payment-app and transfer lines), amount, month and day of month, to sort it into categories. We don’t store the labels or the lines. Only the labels, without amounts or dates, may go on to our AI provider, Anthropic, just to sort them; it doesn’t use API data to train its models.',
      forecastSent:
        'For the 10-year forecast, the numbers in your profile (no names or account numbers) go to our AI provider, Anthropic. It doesn’t use API data to train its models.',
    },
  },
} as const;
