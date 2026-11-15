// Bills calendar (/tools/bills): every charge of the month on one screen. Neutral wording: it says
// when a bill is due, never that one should be paid late, skipped or moved to a lender.

export const bills = {
  title: 'What is due this month?',
  eyebrow: 'Bills calendar',
  intro: 'Rent, card and loan payments and subscriptions on the day they are due. The same bills as Recurring; set the days you know.',
  loading: 'Loading your bills…',
  /** Bill names that are not a merchant label. */
  labels: {
    rent: 'Rent & utilities',
    /** An account's payment: "Credit card payment". */
    payment: (account: string) => `${account} payment`,
    debt: {
      card: 'Credit card payment',
      auto: 'Car loan payment',
      student: 'Student loan payment',
      personal: 'Personal loan payment',
      bnpl: 'Buy now, pay later',
      mortgage: 'Mortgage payment',
    },
  },
  weekdaysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  weekdaysNarrow: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
  kpi: {
    label: 'This month at a glance',
    due: 'Due this month',
    dueHint: (n: number) => (n === 1 ? '1 bill' : `${n} bills`),
    paid: 'Gone out',
    paidHint: 'Due before today',
    toPay: 'Still to pay',
    toPayHint: (n: number) => (n === 1 ? '1 bill left' : `${n} bills left`),
    left: 'Left after bills',
    leftHint: (takeHome: string) => `Of ${takeHome} take-home`,
    leftNone: 'Add your pay',
  },
  split: {
    title: 'Where it goes',
    label: (parts: string) => `This month's bills by kind: ${parts}`,
    part: (kind: string, amount: string, pct: number) => `${kind} ${amount} (${pct}%)`,
  },
  verdict: {
    clear: 'Every bill this month has gone out.',
    nothing: 'No bills fall in this month.',
    toPay: (amount: string, n: number) => `${amount} still to pay this month, across ${n === 1 ? '1 bill' : `${n} bills`}.`,
    future: (amount: string) => `${amount} will be due this month.`,
    past: (amount: string) => `${amount} went out this month.`,
  },
  recurringLink: 'Edit what recurs in Recurring',
  month: {
    title: (month: string, year: number) => `${month} ${year}`,
    prevGlyph: '‹',
    nextGlyph: '›',
    prev: 'Previous month',
    next: 'Next month',
    today: 'Today',
    total: 'Due this month',
    count: (n: number) => (n === 1 ? '1 bill' : `${n} bills`),
    paidMark: 'gone out',
    gridLabel: (month: string) => `Bills in ${month}`,
    dayLabel: (date: string, n: number, amount: string) =>
      n === 0 ? date : `${date}: ${n === 1 ? '1 bill' : `${n} bills`}, ${amount}`,
    more: (n: number) => `+${n}`,
  },
  soon: {
    title: 'Next 7 days',
    empty: 'Nothing due in the next 7 days.',
    /** "Thu 20 · Netflix" (the amount follows in its own column). */
    line: (weekday: string, day: number, label: string) => `${weekday} ${day} · ${label}`,
    today: 'today',
    total: 'Total',
  },
  payday: {
    title: 'Due before payday',
    line: (date: string) => `Before your next payday, ${date}`,
    none: 'Nothing due before your next payday.',
    settingsTitle: 'Your paydays',
    first: 'Payday',
    second: 'Second payday',
    noSecond: 'None',
    assumed: 'We assumed the 1st and the 15th. Set yours.',
  },
  legend: { label: 'What the dots mean', rent: 'Rent', debt: 'Loans and cards', subscription: 'Subscriptions' },
  list: {
    title: 'Your bills',
    lead: 'Pick the day each bill is due. A day the month does not have moves to its last day.',
    dueDay: (label: string) => `Due day for ${label}`,
    dayOption: (day: number) => (day === 31 ? '31 (or last day)' : String(day)),
    reset: 'Use our guess',
    assumedDay: 'assumed day',
    assumedDayHint: 'We do not know this due day yet. Pick the real one.',
    fromStatement: 'from your statement',
    perCadence: { monthly: 'a month', quarterly: 'every 3 months', yearly: 'a year' },
  },
  export: {
    button: 'Add to my calendar',
    hint: 'Downloads an .ics file your phone or computer calendar opens. Nothing is sent to us.',
    downloaded: 'Calendar file saved. Open it to add the bills.',
    opened: 'Calendar opened in a new tab.',
    failed: 'Your browser blocked the file. Try another browser.',
    calendarName: 'Bills',
    summaryPrefix: 'Due: ',
  },
  empty: {
    title: 'No bills yet',
    body: 'Upload a bank statement and we will find your rent, loan payments and subscriptions. It is read in your browser.',
    upload: 'Upload a statement',
  },
  howTitle: 'How we place your bills',
  how: [
    'The bills are the same ones Recurring shows: rent and your card and loan payments from your accounts, and the charges that repeat in your transactions.',
    'A day we do not know is assumed (rent on the 1st, card and loan payments on the 20th) and tagged. A day the month does not have moves to its last day.',
    '"Gone out" means due before today: we see the due date, not the payment itself.',
  ],
  /** S1 Home: one line about the next bill. */
  today: {
    nextBill: (label: string, amount: string, inDays: number) =>
      `Next bill: ${label} ${amount} ${inDays === 0 ? 'today' : inDays === 1 ? 'tomorrow' : `in ${inDays} days`}`,
    open: 'Bills calendar',
  },
} as const;
