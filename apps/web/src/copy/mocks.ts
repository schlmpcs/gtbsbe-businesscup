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
    note: 'A preview of a Pro feature: the numbers are real, from your plan, but nothing here is saved yet. Educational simulation, not financial advice.',
    proNote: 'Included in your Pro. An early version: nothing here is saved yet. Educational simulation, not financial advice.',
    cta: 'See Pro',
  },

  loading: 'Loading your plan…',
  errors: {
    notImplemented: 'This calculation is still being built. Try again soon.',
    other: 'Something went wrong with this calculation.',
  },

  decide: {
    eyebrow: 'Decisions · Pro',
    /** The demo profile's cars (the Figma frame); a user's own profile gets the generic title. */
    title: 'Keep the Camry or lease a RAV4?',
    titleOwn: 'Keep your car or lease a new one?',
    vs: 'VS',
    /** Labels of the engine purchases (never shown as results). */
    purchaseLabels: { lease: 'Lease payment', signing: 'Due at signing' },
    keep: {
      title: 'Keep the 2021 Camry',
      titleOwn: 'Keep your car',
      loanLeft: 'Loan left',
      loanLeftValue: (balance: string, monthsLeft: string) => `${balance} · ${monthsLeft}`,
      noLoan: 'None',
      payment: 'Loan payment',
      running: 'Running costs',
      afterPayoff: 'After payoff',
      afterPayoffValue: (amount: string) => `+${amount} a month free`,
    },
    lease: {
      title: 'Lease a new RAV4',
      titleOwn: 'Lease a new car',
      lease: 'Lease',
      leaseValue: (amount: string, term: string) => `${amount} a month · ${term}`,
      dueAtSigning: 'Due at signing',
      running: 'Running costs',
      assumption: (signings: number) =>
        `Assumes the trade-in pays off your car loan and you keep leasing: a new lease at the end of each term, with the amount due at signing paid ${signings === 1 ? 'once' : `${signings} times`} in 10 years.`,
    },
    perMonth: (amount: string) => `${amount} a month`,
    months: (n: number) => months(n),
    never: 'not within 10 years',
    byYear: (year: number) => `by ${year}`,
    vsOther: 'net worth vs the other path',
    scoreLabel: 'The result',
    score: {
      advantage: (better: string) => `by choosing to ${better}`,
      keepVerb: 'keep the Camry',
      keepVerbOwn: 'keep your car',
      leaseVerb: 'lease the RAV4',
      leaseVerbOwn: 'lease a new car',
      monthsLeft: 'until your car loan is paid off',
      monthsLeftValue: (n: number) => `${n} mo`,
      noLoan: 'no car loan',
      saving: 'less every month after that, by keeping',
      extra: 'more every month after that, by keeping',
    },
    footnote: (year: number) => `Net worth in ${year}, in today’s dollars, from the 10-year forecast of your plan.`,
    edit: {
      title: 'The lease',
      intro: 'Illustrative terms, not a quote. Put in a real offer to make it yours.',
      monthly: 'Lease payment',
      monthlySuffix: '/mo',
      termMonths: 'Term',
      termSuffix: 'months',
      dueAtSigning: 'Due at signing',
      running: 'Running costs',
      runningHint: 'Insurance, fuel and upkeep of the new car, per month.',
      errors: {
        monthly: 'Enter a payment of $0 or more.',
        termMonths: 'Enter a whole number of months (1 to 120).',
        dueAtSigning: 'Enter an amount of $0 or more.',
        running: 'Enter an amount of $0 or more.',
      } as Record<string, string>,
      fix: 'Fix the highlighted fields to see the result.',
      reset: 'Back to the example lease',
    },
    nextTitle: 'Next decisions:',
    next: { moving: 'Move cities', kid: 'Have a kid', jobOffer: 'Job offer', wedding: 'Wedding' },
    nextSoon: 'coming soon',
  },

  checkin: {
    eyebrow: (month: string) => `${month} check-in`,
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
    over: 'over',
    under: 'under',
    progress: 'of the card paid this month',
    needHistory: (have: number) =>
      `Your usual month needs 3 full months of statements before this one. There ${have === 1 ? 'is 1' : `are ${have === 0 ? 'none' : have}`} so far, so this shows the projection only.`,
    noDataHint: 'From the monthly spending in your profile. Add a statement to see your real month.',
    sourceLabel: 'Statement months',
    sources: { uploads: 'My statements', sample: 'Sample statement' },
    sampleNote: 'Sample data: the four full months of our sample bank statement, not yours. Add your own to check in on your real month.',
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
      progressLabel: 'Card paid off this month',
      pace: (withMove: string, without: string) => `At this pace the card is gone in ${withMove}, instead of ${without}.`,
      notWithin10y: 'more than 10 years',
      effect: (amount: string) => `${amount} in 10 years`,
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
      keepBody: 'Your move stays committed. Next month’s check-in asks again.',
      noneTitle: 'Pick a move to work on',
      noneBody: 'Commit to one move and the check-in tracks it.',
      noMoves: 'No move helps right now. Moves show up when you have money left over each month or a card balance to pay down.',
      commit: 'I’m doing this',
      level2: 'Level 2 moves are unlocked.',
      seeAll: 'See all moves',
    },
    months: (n: number) => months(n),
    addStatement: (month: string) => `Add ${month} statement`,
  },
} as const;
