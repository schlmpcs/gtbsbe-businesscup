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
    S5: 'What do you think your month costs?',
    S6: 'About you',
    S7: 'Your month',
    S8: 'Pay, savings and debts',
  },

  /** Shared frame of every rung: the step pills, the headline, the footer (text action + CTA). */
  shell: {
    intro: {
      S5: 'Rent, car, food, everything. Just guess.',
      S6: 'Your age, pay and home. We build your starting month from your area’s costs.',
      S7: 'No statement at hand? Drag to match a normal month. Tagged amounts are our estimates.',
      S8: 'Six taps. Skip anything; we’ll use estimates and tag them.',
      S9: 'Drop a bank statement (CSV) and we sort your month into categories. Nothing to type.',
    },
    back: '← Back',
    stepsLabel: 'Steps to your forecast',
    rungs: {
      S5: 'Your guess',
      S6: 'About you',
      S7: 'Your month',
      S8: 'Pay & savings',
      S9: 'Your spending',
    },
    done: 'done',
    notYet: 'not yet',
    /** A step before this one that was passed without being done. */
    skipped: 'skipped',
    current: 'this step',
    stepsDone: (done: number, total: number) => `${done} of ${total} steps done`,
    /** The last step only: one short line above the CTA (net worth in 10 years, today's dollars). */
    in10yLabel: 'You in 10 years:',
    /** The one orange CTA of each rung: the next step, and on the last step the forecast. */
    cta: {
      S5: 'Next: about you →',
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
    /** Guess vs reality: only once the spending is the user's own (a statement or typed categories). */
    revealTitle: 'Guess vs. reality',
    reveal: (guess: string, actual: string) => `You guessed ${guess}. You actually spend ${actual}.`,
    revealMore: (amount: string) => `${amount} a month more than you thought.`,
    revealLess: (amount: string) => `${amount} a month less than you thought.`,
    revealExact: 'Spot on!',
  },

  closest: {
    about: {
      title: 'About you',
      age: 'Age',
      yearsSuffix: 'years',
      pay: 'Take-home pay',
      paySuffix: '/mo',
      payHint: 'After tax, what reaches your account each month.',
      estimateHint: 'Not typed yet: we use an estimate.',
      homeTitle: 'Your home',
      adults: 'Adults',
      kidsTitle: 'Kids by age',
      kidAges: { infant: 'Infants (0–1)', toddler: 'Toddlers (1–2)', preschool: 'Preschool (3–4)', schoolAge: 'School age (5+)' } as Record<KidAge, string>,
      bedrooms: 'Bedrooms',
      bedroomOptions: ['Studio', '1', '2', '3', '4+'] as readonly string[],
      car: 'Car',
      carOptions: { yes: 'Yes', no: 'No' },
      zip: 'ZIP code',
      zipPlaceholder: '75205',
      zipHint: 'Sets rent, groceries, gas and childcare for your area.',
      zipErrors: {
        invalid: 'Enter a 5-digit ZIP code.',
        none: 'We don’t have data for this area yet. Try a ZIP in a nearby city.',
      },
      zipNearby: (zip: string) => `No data for this exact ZIP yet: using nearby ${zip}.`,
    },
    yourLife: 'Your starting month',
    yours: 'Yours',
    yourLifeNote: 'Typical costs for your household in your area. Your statement makes them exact next.',
    statementSkip: 'Your spending comes from your statement, so we skip the starting estimate.',
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
    /** Chips that explain a card's price at a glance (JF13). */
    differentiatorsLabel: 'Why this price',
    differentiator: {
      car: (perMonth: string) => `Car ${perMonth}/mo`,
      noCar: 'No car',
      childcare: (perMonth: string) => `Childcare ${perMonth}/mo`,
      pricierArea: (rent: string) => `Pricier area · rent ${rent}`,
      cheaperArea: (rent: string) => `Cheaper area · rent ${rent}`,
    },
    preselectedNote: 'Built from your answers. Tap it, or go on, to start from it.',
    noCar: 'No car',
    carNoLoan: 'Car (no loan counted)',
    monthlyRange: (low: string, high: string) => `Range ${low} to ${high}`,
    costsToggle: 'Costs & sources',
    costsLabel: (metro: string) => `Monthly costs for the ${metro} life`,
    choose: 'Start from this life',
    chooseLabel: (metro: string, caption: string) => `Start from this life: ${metro}, ${caption}`,
    chosenNote: 'Typical costs for now. Next steps make them yours.',
    unavailable: 'No area data yet.',
  },

  /** /future and /afford: typed pay next to a sample life's spending. */
  mixedProfile: {
    text: 'Your spending is still the sample family’s.',
    guess: (guess: string) => `Your guess was ${guess}. Use that instead?`,
    useGuess: 'Use my guess',
    setSpending: 'Set my spending →',
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
    minPaymentEstimated: (amount: string) => `Estimated ${amount}/mo. Type yours if you know it.`,
    aprPrefilledHint: 'A typical rate for this kind. Type yours.',
    addKindLabel: (kind: string) => `New debt: ${kind}`,
    detected: {
      sticker: 'Found in your statement',
      text: (amount: string, months: number) =>
        `${amount}/mo goes to card or loan payments${months > 1 ? ` (average of ${months} months)` : ''}. What is it?`,
      balanceLabel: 'How much is left to pay?',
      note: 'We keep this payment as yours and prefill a typical rate. Edit it after.',
      confirm: 'Add it',
      dismiss: 'Not a debt',
      label: 'Debt payments found in your statement',
    },
    edit: 'Edit',
    editLabel: (kind: string) => `Edit ${kind.toLowerCase()}`,
    remove: 'Remove',
    removeLabel: (kind: string) => `Remove ${kind.toLowerCase()}`,
    addDebt: 'Add a debt',
    /** JF9: a photo, screenshot or PDF of a card or loan statement fills the debt form. */
    scan: {
      button: 'Scan a statement',
      scanning: 'Reading your statement…',
      privacy: 'Photo, screenshot or PDF of a card or loan statement. We read it and don\'t keep it.',
      note: 'Read from your statement. Check the numbers, then save.',
      errors: {
        unavailable: 'Reading statements is not available right now. Pick a debt type and type the balance.',
        nothingFound: 'We could not find a balance on that. Try a clearer photo of the statement summary.',
        incomplete: 'We could not find the balance on that. Try a photo that shows the summary box.',
        rateLimited: 'Too many tries. Wait a minute and try again.',
        badInput: 'We could not read that file. Try a JPG, PNG or PDF.',
        other: 'Something went wrong reading it. Try again, or type the balance.',
      },
    },
    kindLabel: 'Type',
    save: 'Save debt',
    cancel: 'Cancel',
    formTitleAdd: 'New debt',
    formTitleEdit: (kind: string) => `Edit ${kind.toLowerCase()}`,
    debtLoadLabel: 'Debt load',
    debtLoadHint: 'Share of take-home pay',
    debtLoadZones: { low: 'Comfortable', medium: 'Stretched', high: 'Risky' },
    netWorthScore: 'Net worth today',
    netWorthNote: 'Cash + retirement + home − debts',
    /** JF4: rent or own. The owner costs replace rent in the month; the mortgage is a debt below. */
    home: {
      title: 'Your home',
      tenureLegend: 'Do you rent or own?',
      tenures: { rent: 'Rent', mortgage: 'Own with a mortgage', outright: 'Own outright' },
      rentNote: 'Your rent is part of your month. Own your home? Pick it above.',
      value: 'Home value',
      valueHint: 'What it would sell for today',
      valueEstimated: 'Typical home value in your area. Type yours.',
      hoa: 'HOA or condo fee',
      hoaHint: 'per month, 0 if none',
      appreciation: (rate: string) => `Grows about ${rate} a year`,
      costsTitle: 'What owning costs each month',
      costsNote: 'This replaces rent in your month. Your mortgage payment is counted with your debts.',
      costLines: {
        propertyTax: 'Property tax',
        insurance: 'Home insurance',
        upkeep: 'Upkeep (1% of value a year)',
        hoa: 'HOA',
        utilities: 'Utilities',
      },
      costsTotal: 'Total',
      perMonth: (amount: string) => `${amount}/mo`,
      addMortgage: 'Add your mortgage',
      addMortgageNote: 'Type what’s left on the loan; we prefill a typical rate and payment.',
      mortgageWhileOutright: 'You still list a mortgage under Debts. Remove it there if it’s paid off.',
    },
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
