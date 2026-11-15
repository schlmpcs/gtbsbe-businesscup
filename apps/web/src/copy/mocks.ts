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
      choose: 'Put which path on your plan?',
      paths: { keep: 'Keep it' },
      /** What the event is called in the shared plan card ("Adds “…” to your plan’s timeline"). */
      what: {
        lease: (amount: string) => `Car lease, ${amount} a month for 10 years`,
        buy: (amount: string) => `A ${amount} car, on a loan`,
      },
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
    /** The page title: "November check-in". */
    eyebrow: (month: string) => `${month} check-in`,
    /** Small label over the title. */
    kicker: 'Monthly check-in',
    titleNoData: 'How this month is going',
    /** The lead under the title. */
    lead: {
      over: (amount: string, usual: string) => `You’re on pace to spend ${amount} more than ${usual}.`,
      under: (amount: string, usual: string) => `You’re on pace to spend ${amount} less than ${usual}.`,
      even: (usual: string) => `You’re right on ${usual}.`,
      wasOver: (amount: string, usual: string) => `You spent ${amount} more than ${usual}.`,
      wasUnder: (amount: string, usual: string) => `You spent ${amount} less than ${usual}.`,
      wasEven: (usual: string) => `You spent right what ${usual} costs.`,
      noData: 'This is your plan’s month. Import a statement to see your real one.',
    },
    usualName: { history: 'your usual month', profile: 'your plan’s month' },

    // ----- data source
    sourceLabel: 'Months from',
    sources: { mine: 'My transactions', mineUploads: 'My statements', sample: 'Sample statement' },
    samplePreview: 'Preview',
    sampleNote: 'This is a sample statement, not yours. Import your own to see your month.',
    importCta: 'Import a statement',

    // ----- KPI strip
    kpiLabel: 'Your month in numbers',
    kpi: {
      projected: 'Projected by month end',
      spent: 'Spent this month',
      usual: 'Your usual month',
      planned: 'Your plan’s month',
      difference: 'Difference',
      soFar: 'Spent so far',
    },
    kpiHint: {
      projected: 'At today’s pace; bills at their usual amount',
      usualHistory: (n: number) => `Average of the last ${n} months`,
      usualProfile: 'From your budget, until 3 months of history',
      soFar: (day: number, days: number) => `Day ${day} of ${days}`,
    },

    paceTitle: 'Month-end projection',
    paceNote: (day: number, days: number) => `Spent so far against the projection. The line marks today, day ${day} of ${days}.`,

    // ----- category bars
    barsTitle: 'Usual month vs this month',
    barsSubtitle: (inProgress: boolean) => (inProgress ? 'By category, this month projected to its end' : 'By category'),
    legendUsual: 'Usual',
    legendThis: (inProgress: boolean) => (inProgress ? 'This month (projected)' : 'This month'),
    driftOver: (amount: string) => `${amount} over`,
    driftUnder: (amount: string) => `${amount} under`,
    driftLabel: 'Drifted',
    driftCount: (n: number) => (n === 0 ? 'Nothing drifted' : n === 1 ? '1 category drifted' : `${n} categories drifted`),
    barRow: (category: string, usual: string, projected: string) => `${category}: usual ${usual}, this month ${projected}`,
    needHistory: (have: number) => `Drift flags need 3 past months (${have} so far). Until then the usual month is your budget.`,

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

    /** Sticker on the house once a move is marked done. */
    floorSticker: '+1 floor',

    // ----- move
    move: {
      sticker: 'Your move this month',
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
      noneTitle: 'One move worth the most right now',
      noMoves: 'No move helps right now.',
      commit: 'Commit to this',
      level2: 'Level 2 moves are unlocked.',
      seeAll: 'See all moves on your plan',
    },

    // ----- how
    howTitle: 'How we calculate',
    how: [
      'Your usual month is the average of your last 3 full months, per category. With fewer months it is your budget.',
      'A month in progress is projected to its end: bills (rent, car, childcare, subscriptions) at their usual amount or what you paid, everything else at today’s pace.',
      'A category is flagged when it moves further from its average than it normally swings (at least 10% or $25).',
      'One-off charges are left out, so a vet bill doesn’t look like a habit.',
    ],
    months: (n: number) => months(n),
    addStatement: (month: string) => `Import your ${month} statement`,
  },
} as const;
