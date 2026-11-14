// Strings for the mock screens: S13 Decision (the car) and S14 Monthly check-in. Owner: Aibek (T11).
// S15 (Pro) keeps its title here; its strings are in ./pro. Functions take numbers already
// formatted by the UI (formatMoney / formatRate), never raw values.

const months = (n: number) => (n === 1 ? '1 month' : `${n} months`);

const monthName = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
/** 'YYYY-MM' → "October 2026". */
const formatMonth = (yyyyMm: string) => {
  const [y, m] = yyyyMm.split('-').map(Number);
  return monthName.format(new Date(Date.UTC(y!, m! - 1, 1)));
};

export const mocks = {
  screens: {
    S13: 'Decision: the car',
    S14: 'Monthly check-in',
    S15: 'Pro',
  },

  /** Shown on both screens: they are previews of Pro features. */
  preview: {
    badge: 'Preview',
    body: 'A preview of a Pro feature: the numbers are real, but nothing here is saved yet.',
    proBody: 'Included in your Pro. This is an early version: nothing here is saved yet.',
    cta: 'See Pro',
  },

  loading: 'Loading your plan…',
  errors: {
    notImplemented: 'This calculation is still being built. Try again soon.',
    other: 'Something went wrong with this calculation.',
  },

  decision: {
    intro:
      'Two ways to get your next car, side by side against keeping the one you have: what each costs, whether it fits this year, and where it leaves you in 10 years.',
    /** Label of the purchase in the engine call (never shown as a result). */
    purchaseLabel: 'Car',
    kindsLabel: 'Decisions',
    kinds: {
      car: 'Car',
      moving: 'Moving city',
      kid: 'Having a kid',
      jobOffer: 'Job offer',
      wedding: 'Wedding',
    },
    comingWithPro: 'coming with Pro',
    pathName: (id: 'A' | 'B') => `Path ${id}`,
    pathHint: { A: 'Sample: a newer car on a long loan', B: 'Sample: a cheaper used car on a short loan' },
    keepName: 'Keep your car',
    editTitle: 'Your two paths',
    edit: {
      price: 'Car price',
      payWith: 'Pay with',
      payWithOptions: { loan: 'A loan', cash: 'Cash' },
      downPayment: 'Down payment',
      apr: 'APR',
      aprHint: 'The yearly rate on the offer, e.g. 6.9%.',
      termMonths: 'Term',
      termSuffix: 'months',
      fees: 'Fees',
      feesHint: 'Rolled into the loan.',
      errors: {
        price: 'Enter a price of $0 or more.',
        apr: 'Enter the APR (0% to 100%).',
        termMonths: 'Enter a whole number of months (1 to 600).',
        downPayment: 'The down payment can’t be more than the price.',
        fees: 'Fees can’t be negative.',
      } as Record<string, string>,
      fix: 'Fix the highlighted fields to see this path.',
      reset: 'Back to the sample paths',
    },
    compare: {
      title: 'Side by side',
      caption: 'Your car paths compared with keeping your car',
      metric: 'Per path',
      rows: {
        verdict: 'Fits this year?',
        monthly: 'Monthly payment',
        totalCost: 'Total cost of the car',
        totalInterest: 'Interest',
        payoff: 'Paid off in',
        debtLoad: 'Debt load',
        in10y: 'Net worth in 10 years',
        vsKeep: 'vs keeping your car',
      },
      none: '—',
      noPayment: 'No payment',
      payoffMonths: (n: number) => months(n),
      never: 'Never',
      totalCostHint: 'Everything you pay for the car: down payment, fees and interest included.',
      fix: 'Fix this path',
      failed: 'Can’t compute',
    },
    verdicts: {
      fits: 'Yes, it fits',
      wait: (n: number) => `Wait ${months(n)}`,
      no: 'Not right now',
    },
    /** Why buying now fails, per rule. `cushion` gets "1 month", `red` gets "36%". */
    failsOn: {
      cushion: (cushion: string) => `It would drop your cash below your safety cushion (${cushion} of spending and bills).`,
      debtLoad: (red: string) => `Its payments would push your debt payments above ${red} of your take-home pay.`,
      cardRevolves: 'What lands on your card could not be paid off within 12 months.',
    },
    baselineFails: 'Your plan is already under strain in the next 12 months, with or without a car.',
    cushionMonths: (n: number) => months(n),
    verdictTitle: (name: string) => `${name}: fits this year?`,
    leader: (name: string, gap: string) => `${name} leaves you ${gap} more in 10 years.`,
    tie: 'Both paths leave you about the same in 10 years.',
    leaderHint: 'Net worth in today’s dollars. The better path on paper; whether it fits this year is the verdict above.',
    chartTitle: 'Net worth with each path',
    chartFootnote:
      'In today’s dollars. The band is the likely range from the numbers we estimated. A card balance a path creates is paid off from what you have left each month.',
    assumptionsTitle: 'What this assumes',
    assumptions: [
      'You buy the car this month, as you chose to pay for it.',
      'The car itself is not counted as savings: we treat it as spending, so a pricier car always costs more here.',
      'Insurance, fuel and the loan on your current car stay as they are in your profile.',
    ],
    nextTitle: 'Next steps',
    next: {
      loan: { title: 'Loan Lab', body: 'Compare real loan offers for this car and try paying extra.' },
      afford: { title: 'Can I Afford It?', body: 'Check the purchase month by month for the next year.' },
    },
  },

  checkin: {
    intro: 'Three minutes, once a month: how the month went, how your move is going, and where it leaves you in 10 years.',
    stepsLabel: 'Check-in steps',
    steps: { month: 'Your month', move: 'Your move', future: 'Your 10 years' },
    stepOf: (n: number, total: number) => `Step ${n} of ${total}`,
    back: 'Back',
    next: 'Next',
    finish: 'Finish check-in',
    restart: 'Start over',

    month: {
      title: (month: string) => `How ${formatMonth(month)} went`,
      titleNoData: 'How this month is going',
      sourceLabel: 'Statement months',
      sources: { uploads: 'My uploads', sample: 'Sample statement' },
      sampleNote: 'Sample data: the four full months of our sample bank statement, not your own. Upload yours to check in on your real month.',
      noUploads: 'You haven’t uploaded a statement yet, so this shows the sample one.',
      upload: 'Upload a statement',
      projected: 'Spending this month',
      projectedInProgress: 'Projected spending this month',
      inProgressHint: 'Projected to the end of the month from the days so far.',
      completeHint: 'The month is over: this is what you spent.',
      noDataHint: 'From the monthly spending in your profile. Upload a statement to see your real month.',
      vsAverage: 'Compared with your 3-month average',
      /** `amount` is signed: +$240 = spending more than the average. */
      vsAverageValue: (amount: string) => `${amount} vs your 3-month average`,
      needHistory: (have: number) =>
        `The average and drift flags need 3 full months before this one. There ${have === 1 ? 'is 1' : `are ${have === 0 ? 'none' : have}`} so far.`,
      driftsTitle: 'Drifting from your usual',
      noDrifts: 'No category is drifting from your usual.',
      /** `amount` is signed: +$80 = more than usual. */
      drift: (category: string, amount: string) => `${category}: ${amount} vs usual`,
      over: 'over',
      under: 'under',
      takeHome: 'Take-home pay',
      takeHomeSample: 'Take-home pay (sample paychecks)',
    },

    move: {
      title: 'Your move',
      committedLabel: 'You committed to',
      effect: (amount: string) => `${amount} in 10 years`,
      cardPayoff: (withMove: string, without: string) => `With this move your card is paid off in ${withMove}, instead of ${without}.`,
      payoffMonths: (n: number) => months(n),
      notWithin10y: 'more than 10 years',
      spendingTarget: (category: string, target: string, planned: string) =>
        `Target: ${category.toLowerCase()} at ${target} a month (your plan says ${planned} now).`,
      actual: (amount: string) => `Your statement shows ${amount} this month.`,
      onTrack: 'On track',
      offTrack: 'Above the target',
      question: 'Did you do it this month?',
      done: 'Yes, I did it',
      keepGoing: 'Not yet, keep it',
      doneTitle: 'Nice work',
      doneBody: (title: string) => `“${title}” is now part of your plan. Your forecast and next moves use it from here.`,
      keepTitle: 'Keep going',
      keepBody: 'Your move stays committed. Next month’s check-in will ask again.',
      noneTitle: 'Pick a move to work on',
      noneBody: 'Commit to one move and the next check-in tracks it.',
      noMoves: 'No move helps right now. Moves show up when you have money left over each month or a card balance to pay down.',
      commit: 'I’m doing this',
      level2: 'Level 2 moves are unlocked.',
      seeAll: 'See all moves',
    },

    future: {
      title: 'Your 10 years',
      headline: 'Net worth in 10 years',
      hint: 'In today’s dollars',
      chartTitle: 'Your net worth over the next 10 years',
      seriesLabel: 'Your plan',
      withMoveLabel: (title: string) => `With: ${title}`,
      withMove: 'With your committed move',
      footnote: 'In today’s dollars. The band is the likely range from the numbers we estimated.',
    },

    summary: {
      title: 'Check-in done',
      month: 'Your month',
      move: 'Your move',
      future: 'In 10 years',
      moveDone: (title: string) => `Done: ${title}`,
      moveKept: (title: string) => `Still on: ${title}`,
      moveNone: 'No move yet',
      note: 'This preview doesn’t save check-ins or remind you next month yet.',
      future10y: 'See your forecast and next moves',
    },
  },
} as const;
