// Strings for the mock screens: S13 Decision (keep the car or lease) and S14 Monthly check-in.
// Owner: Aibek (T11). S15 (Pro) keeps its title here; its strings are in ./pro. Functions take
// numbers already formatted by the UI (formatMoney / formatRate), never raw values.
const months = (n: number) => (n === 1 ? '1 month' : `${n} months`);

const monthNameFormat = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' });
/** 'YYYY-MM' → "October". */
const monthName = (yyyyMm: string) => {
  const [y, m] = yyyyMm.split('-').map(Number);
  return monthNameFormat.format(new Date(Date.UTC(y!, m! - 1, 1)));
};

export const mocks = {
  screens: {
    S13: 'Decision: the car',
    S14: 'Monthly check-in',
    S15: 'Pro',
  },

  monthName,

  preview: {
    sticker: 'Preview',
    // The "not financial advice" disclaimer is in the app footer on every page.
    note: 'Real numbers from your plan. Nothing is saved yet.',
    proNote: 'In your Pro. Early version: nothing is saved yet.',
    cta: 'See Pro',
  },

  loading: 'Loading your plan…',
  errors: {
    notImplemented: 'This calculation is still being built. Try again soon.',
    other: 'Something went wrong with this calculation.',
  },

  decide: {
    kicker: 'Decision · your car',
    title: 'Keep your car or switch?',
    lead: 'Your car against a lease, a new car or no car at all: what each leaves you with over 10 years.',
    /** Over the alternative picker. */
    compareWith: 'Compare keeping it with',
    kinds: { lease: 'Lease a new one', buy: 'Buy a new one', noCar: 'Go car-free' },
    kindsShort: { lease: 'Lease', buy: 'New car', noCar: 'No car' },
    /** When the person has no car in their money yet. */
    exampleNote: 'No car in your accounts or budget yet, so this is an example car. Change any number to make it yours.',
    exampleLink: 'Add your car loan',
    loading: 'Loading your numbers…',

    // ----- verdict
    verdictTitle: 'The answer',
    pill: { keep: 'Keeping wins', alternative: { lease: 'Leasing wins', buy: 'A new car wins', noCar: 'Car-free wins' }, close: 'Too close to call' },
    sentence: (subject: string, amount: string, year: number) => `${subject} leaves you ${amount} richer by ${year}.`,
    subject: { keep: 'Keeping your car', lease: 'Leasing a new car', buy: 'Buying a new car', noCar: 'Going car-free' },
    sentenceClose: (year: number) => `Both paths end up about the same by ${year}.`,
    sentenceCloseSub: 'The difference is under $500. Pick the one you like driving.',
    footnote: (year: number) => `Net worth in ${year}, in today’s dollars. Both count the car you own.`,
    kpi: {
      keep: (year: number) => `Keep it · ${year}`,
      alternative: (kind: string, year: number) => `${kind} · ${year}`,
      difference: 'Difference',
      differenceHint: 'Keeping minus the other path',
    },

    // ----- chart
    chartTitle: 'Net worth over 10 years',
    chartSubtitle: 'Today’s dollars, year by year',
    chartLabel: (keepEnd: string, altEnd: string, alt: string, year: number) =>
      `Line chart. Keeping your car reaches ${keepEnd} by ${year}; ${alt.toLowerCase()} reaches ${altEnd}.`,
    lineKeep: 'Keep it',
    tableYear: 'Year',

    // ----- cost per month
    costTitle: 'Car cost per month',
    costSubtitle: 'This month, before prices rise',
    costParts: { payment: 'Loan or lease payment', running: 'Insurance, fuel, upkeep', signing: 'Due at signing, spread out' },
    costPartsNoCar: 'Transit, rides, rentals',
    costRow: { keep: 'Keep it', lease: 'Lease', buy: 'New car', noCar: 'No car' },
    afterPayoff: (months: string, amount: string) => `Once the loan is paid off (in ${months}), keeping costs ${amount} a month.`,
    noLoanNote: 'No loan left on your car: keeping costs only what it takes to run it.',
    neverPaidOff: 'At this payment the loan is not paid off within 10 years.',
    upfront: (amount: string) => `Plus ${amount} down when you buy.`,
    signings: (n: number) => `The lease is signed ${n === 1 ? 'once' : `${n} times`} in 10 years (a new one each term).`,
    tradeIn: (amount: string) => `Selling your car puts ${amount} in your cash after the loan is cleared.`,
    tradeInShort: (amount: string) => `Your car is worth ${amount} less than the loan: that gap is paid from your cash.`,

    // ----- plan
    plan: {
      title: 'What it does to your plan',
      choose: 'Add which path?',
      paths: { keep: 'Keep it' },
      impact: (age: number) => `Net worth at ${age} on your plan`,
      scenario: (name: string) => `Measured on “${name}”, your active plan.`,
      event: {
        leaseExpense: (amount: string, year: number) => `Adds an Expense: ${amount} a month from ${year}, for 10 years.`,
        financedExpense: (amount: string, year: number) => `Adds an Expense: a ${amount} car in ${year}, on a loan.`,
      },
      add: 'Add to my plan',
      added: 'Added to your plan',
      open: 'Open plan',
      keepNote: 'Keeping is already in your plan: your car loan and Car budget line are part of it.',
      noCarNote: 'Going car-free shows up in your plan as a lower Car budget line.',
      noCarLink: 'Change it on Budget',
      eventName: { lease: 'Car lease', buy: 'New car' },
    },

    // ----- inputs
    carTitle: 'Your car',
    altTitle: { lease: 'The lease', buy: 'The new car', noCar: 'Without a car' },
    reset: 'Reset',
    origin: { accounts: 'From your accounts', budget: 'From your budget', example: 'Example', typed: 'Yours' },
    fields: {
      car: {
        value: 'What it’s worth',
        loanBalance: 'Loan left',
        loanPayment: 'Loan payment',
        loanApr: 'Loan APR',
        running: 'Running costs',
      },
      alternative: {
        monthly: 'Lease payment',
        termMonths: 'Term',
        dueAtSigning: 'Due at signing',
        running: 'Running costs',
        price: 'Price',
        downPayment: 'Down payment',
        apr: 'Loan APR',
      },
      noCarMonthly: 'Getting around',
    } as { car: Record<string, string>; alternative: Record<string, string>; noCarMonthly: string },
    hints: {
      value: 'About what a dealer would give you.',
      running: 'Insurance, fuel, upkeep.',
      noCar: 'Transit pass, rides, the odd rental.',
      termLease: 'Usually 24 to 48 months.',
    } as Record<string, string>,
    suffix: { monthly: '/mo', months: 'months' },
    errors: {
      required: 'Enter a number.',
      negative: 'Enter 0 or more.',
      tooLarge: 'That is more than this tool handles.',
      term: 'Enter whole months.',
      apr: 'Enter an APR under 40%.',
      downAbovePrice: 'The down payment can’t be more than the price.',
      paymentTooLow: 'This payment doesn’t cover the interest, so the loan never shrinks.',
    } as Record<string, string>,
    fix: 'Fix the highlighted number to see the answer.',

    // ----- how we calculate
    howTitle: 'How we calculate',
    how: [
      'Both paths run month by month on your plan’s numbers (pay, spending, savings, debts) for 10 years, then are shown in today’s dollars.',
      'Your car counts as something you own, losing about 15% of its value a year. Switching sells it first: what it’s worth minus the loan left goes to your cash.',
      'A lease is paid every month and signed again each term; a new car is bought on the loan you enter; car-free swaps the car costs for what getting around costs you.',
      'Numbers marked Example are illustrations, not quotes. Change them to your own.',
    ],
    sourceExample: (name: string) => `Example values: ${name}.`,
  },

  checkin: {
    /** The page title: "October check-in". */
    eyebrow: (month: string) => `${month} check-in`,
    /** Small label over the title. */
    kicker: 'Monthly check-in',
    titleOver: (amount: string) => `You’re ${amount} over your usual month.`,
    titleUnder: (amount: string) => `You’re ${amount} under your usual month.`,
    titleEven: 'Right on your usual month.',
    titleWasOver: (amount: string) => `You were ${amount} over your usual month.`,
    titleWasUnder: (amount: string) => `You were ${amount} under your usual month.`,
    titleNoAverage: (month: string) => `How ${month} is going`,
    titleNoAverageDone: (month: string) => `How ${month} went`,
    titleNoData: 'How this month is going',
    scoreLabel: 'This month so far',
    scoreLabelDone: 'The month',
    projected: 'projected this month',
    spent: 'spent this month',
    average: 'your 3-month average',
    progress: 'of the card paid this month',
    needHistory: (have: number) => `Your usual month needs 3 past months of statements (${have} so far).`,
    noDataHint: 'From your profile. Add a statement to see your real month.',
    sourceLabel: 'Statement months',
    sources: { uploads: 'My statements', sample: 'Sample statement' },
    sampleNote: 'Sample statement, not yours. Add your own to see your month.',
    /** Ends the one muted line under the headline (after the sample note). */
    notSaved: 'Nothing is saved yet.',
    /** The ink card with the month's totals (engine monthEnd). */
    valueCheck: 'Value check',
    valueCheckSoFar: 'Value check · so far',
    valueNote: {
      uploads: 'Computed by the engine from your statements.',
      sample: 'Computed by the engine from the sample statement.',
    },
    /** The card with two bars: the 3-month average and this month. */
    compareTitle: 'Usual vs this month',
    compareUsual: 'Your usual month',
    compareThis: 'This month',
    compareThisSoFar: 'This month (projected)',
    comparePill: {
      over: (amount: string) => `${amount} over your usual`,
      under: (amount: string) => `${amount} under your usual`,
      even: 'Right on your usual',
    },
    /** Sticker on the house once a move is marked done. */
    floorSticker: '+1 floor',
    driftTitle: 'What drifted',
    vsAverage: 'vs your average',
    onTrack: 'right on track',
    categories: {
      rentUtilities: 'Rent & utilities',
      car: 'Car',
      childcare: 'Childcare',
      groceries: 'Groceries',
      eatingOut: 'Eating out',
      subscriptions: 'Subscriptions',
      debtPayments: 'Debt payments',
      other: 'Other',
    } as Record<string, string>,
    move: {
      sticker: 'Your move',
      ofTotal: (paid: string, total: string) => `${paid} of ${total}`,
      /** Next to the big paid amount: "of $4,200". */
      ofTotalRest: (total: string) => `of ${total}`,
      progressLabel: 'Card paid off this month',
      pace: (withMove: string, without: string) => `Card gone in ${withMove}, not ${without}.`,
      notWithin10y: 'more than 10 years',
      spendingTarget: (category: string, target: string, planned: string) =>
        `Target: ${category.toLowerCase()} at ${target} a month (now ${planned}).`,
      actual: (amount: string) => `This month: ${amount}.`,
      onTrack: 'On track',
      offTrack: 'Above the target',
      question: 'Did you do it this month?',
      done: 'Yes, I did it',
      keepGoing: 'Not yet, keep it',
      doneTitle: 'Nice work',
      doneBody: (title: string) => `“${title}” is now part of your plan.`,
      keepBody: 'Still committed. We’ll ask again next month.',
      noneTitle: 'Pick a move to work on',
      noMoves: 'No move helps right now.',
      commit: 'I’m doing this',
      level2: 'Level 2 moves are unlocked.',
      seeAll: 'See all moves',
    },
    months: (n: number) => months(n),
    addStatement: (month: string) => `Add ${month} statement`,
  },
} as const;
