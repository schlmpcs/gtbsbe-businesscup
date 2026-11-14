// Strings for the mock screens (S13–S15). Owner: Aibek (T11).
// Functions take numbers already formatted by the UI (formatMoney / formatRate), never raw values.
const months = (n: number) => (n === 1 ? '1 month' : `${n} months`);

export const mocks = {
  screens: {
    S13: 'Decision: the car',
    S14: 'Monthly check-in',
    S15: 'Pro',
  },

  preview: {
    sticker: 'Preview',
    note: 'A preview on sample data: the demo profile, with example inputs. Educational simulation, not financial advice.',
  },

  decide: {
    eyebrow: 'Decisions · Pro',
    title: 'Keep the Camry or lease a RAV4?',
    vs: 'VS',
    keep: {
      title: 'Keep the 2021 Camry',
      loanLeft: 'Loan left',
      loanLeftValue: (balance: string, monthsLeft: string) => `${balance} · ${monthsLeft}`,
      payment: 'Loan payment',
      running: 'Running costs',
      afterPayoff: 'After payoff',
      afterPayoffValue: (amount: string) => `+${amount} a month free`,
    },
    lease: {
      title: 'Lease a new RAV4',
      lease: 'Lease',
      leaseValue: (amount: string, term: string) => `${amount} a month · ${term}`,
      dueAtSigning: 'Due at signing',
      running: 'Running costs',
      assumption: 'Assumes the trade-in pays off the Camry loan and you keep leasing.',
    },
    perMonth: (amount: string) => `${amount} a month`,
    months: (n: number) => months(n),
    never: 'never at this payment',
    byYear: (year: number) => `by ${year}`,
    vsOther: 'net worth vs the other path',
    scoreLabel: 'The result',
    score: {
      advantage: (better: string) => `by choosing to ${better}`,
      keepVerb: 'keep the Camry',
      leaseVerb: 'lease the RAV4',
      monthsLeft: 'until the Camry is paid off',
      monthsLeftValue: (n: number) => `${n} mo`,
      saving: 'less every month after that, by keeping',
    },
    footnote: (year: number) => `Net worth in ${year}, in today’s dollars, from the 10-year forecast of the demo profile.`,
    nextTitle: 'Next decisions:',
    next: ['Move cities', 'Have a kid', 'Job offer', 'Wedding'],
    nextSoon: 'coming soon',
  },

  checkin: {
    eyebrow: (month: string) => `${month} check-in`,
    titleOver: (amount: string) => `You’re ${amount} over your usual month.`,
    titleUnder: (amount: string) => `You’re ${amount} under your usual month.`,
    titleEven: 'Right on your usual month.',
    scoreLabel: 'This month so far',
    projected: 'projected this month',
    average: 'your 3-month average',
    over: 'over',
    under: 'under',
    progress: 'of the card paid',
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
      title: 'Pay the card first',
      ofTotal: (paid: string, total: string) => `${paid} of ${total}`,
      pace: (n: string) => `At this pace the card is gone in ${n}.`,
      never: 'At this pace the card never pays off.',
      progressLabel: 'Card paid off so far',
    },
    months: (n: number) => months(n),
    addStatement: (month: string) => `Add ${month} statement`,
    sampleSource: 'Sample month: the 3-month average and drifts are example values until month-end tracking is live.',
  },
} as const;
