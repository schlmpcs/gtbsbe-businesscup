// Strings for S14 Monthly check-in (/checkin). Functions take numbers already formatted by the UI
// (formatMoney / formatRate), never raw values.
const months = (n: number) => (n === 1 ? '1 month' : `${n} months`);

export const checkin = {
  title: 'Monthly check-in',
  eyebrow: (month: string) => `${month} check-in`,
  intro: 'See how a month went against your forecast, and where it leaves your number.',

  fastForward: 'Fast-forward 1 month (simulated)',
  fastForwardHint:
    'No bank is connected, so we simulate the month from your plan: each category lands a little above or below it.',
  saveFirst: 'Save this month to fast-forward to the next one.',
  freeOnce: 'With Pro, saving this month lets the next one start where it ended.',
  simulatedTag: 'Simulated month',
  savedTag: 'Saved',

  emptyTitle: 'No month to check yet',
  emptyBody: (month: string) => `Fast-forward to a simulated ${month}, or come back on the 1st.`,

  compare: {
    title: 'Forecast vs actual',
    label: (month: string) => `Forecast vs actual spending, ${month}`,
    forecast: 'Forecast',
    actual: 'Actual',
    over: (amount: string) => `${amount} over`,
    under: (amount: string) => `${amount} under`,
    even: 'On forecast',
    total: 'Total spending',
  },

  number: {
    title: 'Your number',
    today: 'Today',
    inYear: (year: number) => `In ${year}`,
    up: (amount: string) => `${amount} vs last month`,
    down: (amount: string) => `${amount} vs last month`,
    even: 'No change vs last month',
    before: 'Fast-forward a month to see it move.',
    explain: 'Net worth (cash + retirement − debts), in today’s dollars.',
    range: (low: string, high: string) => `Range ${low} to ${high}`,
    source: 'Rules-based estimate',
  },

  goal: {
    title: 'Your goal',
    of: (projected: string, target: string, year: number) => `${projected} of ${target} by ${year}`,
    verdicts: { onTrack: 'On track', withinRange: 'Within range', behind: 'Behind' },
    short: (amount: string) => `${amount} short at the current pace`,
    reached: (amount: string) => `${amount} above the target at the current pace`,
    progressLabel: 'Goal progress',
    none: 'No goal yet. Set one to see if each month keeps you on track.',
    set: 'Set a goal',
  },

  move: {
    title: 'Your move',
    none: 'No move committed. Pick one and each check-in shows how far it got.',
    pick: 'Pick a move',
    paid: (paid: string, total: string) => `${paid} of ${total} paid`,
    payoff: (n: number | null) => (n === null ? 'Not paid off within 10 years at this pace.' : n === 0 ? 'Paid off.' : `Paid off in ${months(n)} at this pace.`),
    progressLabel: (name: string) => `${name} progress`,
    target: (target: string, actual: string) => `Target ${target} a month. This month: ${actual}.`,
    onTarget: 'On target',
    overTarget: 'Above the target',
    before: 'Fast-forward a month to see your progress.',
    debtKinds: {
      card: 'Credit card',
      auto: 'Car loan',
      student: 'Student loan',
      personal: 'Personal loan',
      bnpl: 'Buy now, pay later',
      mortgage: 'Mortgage',
    } as Record<string, string>,
  },

  value: {
    title: 'Value check',
    paidDown: (amount: string) => `Debt paid down ${amount}`,
    vsForecast: (amount: string) => `${amount} vs forecast`,
    numberChange: (amount: string, year: number) => `${amount} on your ${year} number`,
    hint: (n: number) => (n === 1 ? 'From your 1 saved check-in.' : `Sum of your ${n} saved check-ins.`),
  },

  save: 'Save check-in',
  saved: (month: string) => `${month} saved. See you next month.`,

  history: {
    title: 'Your check-ins',
    empty: 'Saved check-ins show up here, one row per month.',
    number: (year: number) => `Number in ${year}`,
    change: (amount: string) => `${amount} vs before`,
  },

  paywall: {
    title: 'Track your number with Pro',
    body: 'Pro saves each check-in, keeps the history and tracks your goal, so next month starts where this one ended.',
    cta: 'See Pro',
  },

  calendar: {
    button: 'Add monthly check-in to calendar',
    hint: 'A reminder on the 1st of each month (.ics file). Nothing personal is in it.',
    eventTitle: 'Monthly money check-in',
    eventBody: 'How did the month go? Open your check-in and see where it leaves your number.',
  },

  loading: 'Loading your plan…',
  error: 'We could not calculate this check-in. Check your inputs.',
} as const;
