// Strings for the daily spending log (/spend) and its quick-add on Home (S1).
// Functions take values already formatted by the UI (formatMoney / formatMonth); no math here.

export const spend = {
  eyebrow: 'Daily log',
  title: 'What did you spend today?',
  intro: 'Log it in one line and see what you can still spend today without breaking your usual month.',
  homeLink: 'Open your daily log',
  /** Disclosure over the quick-add on Home (collapsed, so the dashboard stays short). */
  homeQuickAdd: 'Log a purchase',

  input: {
    label: 'Log spending',
    placeholder: 'coffee 5, taxi 18, groceries 64',
    hint: 'Commas between purchases. “$18 uber” works too.',
    add: 'Add',
    reading: 'Reading…',
    mic: 'Say it',
    micStop: 'Stop listening',
    listening: 'Listening… say “coffee five dollars”.',
    micError: 'Couldn’t hear that. Try again, or type it.',
  },

  presets: {
    title: 'One tap',
    /** The chip prices are typical amounts we picked, not yours: one short note, no tag. */
    note: 'Typical prices. Type a line for the exact amount.',
    names: {
      coffee: 'Coffee',
      lunch: 'Lunch',
      groceries: 'Groceries',
      taxi: 'Taxi',
      gas: 'Gas',
    },
    /** "Add Coffee, $5 (typical price)" for screen readers. */
    aria: (name: string, amount: string) => `Add ${name}, ${amount} (typical price)`,
  },

  added: (count: number) => (count === 1 ? 'Added 1 purchase.' : `Added ${count} purchases.`),
  undo: 'Undo',

  confirm: {
    title: 'Is this right?',
    aiNote: 'Our AI sorted these from your words. Amounts are exactly what you typed. Check the categories, then save.',
    localNote: 'We couldn’t place some of these. Pick a category, then save.',
    categoryLabel: (what: string) => `Category for ${what}`,
    save: 'Save',
    cancel: 'Cancel',
    guessed: 'pick one',
  },

  errors: {
    nothing: 'We couldn’t find a purchase in that. Try “coffee 5”.',
    /** `part` is the piece of the line without a number. */
    noAmount: (part: string) => `How much was “${part}”? Add the amount, e.g. “${part} 12”.`,
  },

  summary: {
    title: 'This month so far',
    error: 'We couldn’t work out this month. Reload the page to try again.',
    /** `date` = "November 1". */
    spentSince: (date: string) => `Spent since ${date}`,
    /** `usual` = "$3,655". */
    ofUsual: (usual: string) => `of usual ${usual}`,
    projected: 'Projected month end',
    projectedHint: 'Bills at their usual amount, the rest at your pace so far.',
    safeToday: 'Safe to spend today',
    /** `days` left in the month, today included. */
    safeHint: (days: number) => (days === 1 ? 'Last day of the month.' : `Spread over the ${days} days left, today included.`),
    billsKept: (bills: string) => `Keeps ${bills} for bills not paid yet this month.`,
    over: (amount: string) => `You’re ${amount} over your usual month.`,
    usualFromProfile: 'Usual month = your profile’s monthly spending.',
    usualFromHistory: 'Usual month = your last 3 months of statements.',
  },

  month: {
    byCategory: 'By category',
    byCategorySub: 'Share of what you logged this month.',
    byDay: 'Logged this month',
    byDaySub: 'Newest first. Remove a line you logged by mistake.',
    empty: 'Nothing logged this month yet.',
    remove: (what: string) => `Remove ${what}`,
    count: (n: number) => (n === 1 ? '1 purchase' : `${n} purchases`),
  },

  /** The big "safe to spend today" ring. */
  safe: {
    label: 'Safe to spend today',
    perDay: 'today',
    /** `left` = "$1,223", `budget` = "$1,310". */
    left: (left: string, budget: string) => `${left} of ${budget} everyday money left this month`,
    noBudget: 'Your usual month is all bills, so there is no everyday money to spread.',
    rulesTag: 'Rules-based',
  },

  kpis: {
    label: 'Your month in numbers',
    spent: 'Spent so far',
    /** `usual` = "$3,655". */
    spentHint: (usual: string) => `of a usual ${usual} month`,
    projected: 'Projected month end',
    projectedOver: (diff: string) => `${diff} over your usual month`,
    projectedUnder: (diff: string) => `${diff} under your usual month`,
    bills: 'Bills still to pay',
    billsHint: 'Kept aside, not spendable',
  },

  chart: {
    title: 'Day by day',
    subtitle: 'Bars are what you logged each day. The dashed line is your usual pace.',
    /** `pace` = "$44". */
    pace: (pace: string) => `Usual pace ${pace}/day`,
    today: 'Today',
    over: 'Over the usual pace',
    under: 'At or under it',
    /** Accessible summary of the chart. */
    aria: (month: string, spent: string, pace: string) =>
      `Spending per day in ${month}: ${spent} logged so far; your usual pace is ${pace} a day.`,
    /** `date` = "November 15", `amount` = "$87". */
    bar: (date: string, amount: string) => `${date}: ${amount}`,
  },

  empty: {
    title: 'Nothing logged yet this month',
    body: 'Tap a chip or type “coffee 5”. Your safe-to-spend number moves at once.',
  },

  how: {
    title: 'How we calculate',
    lines: [
      'Usual month = your last 3 months of statements, or your profile’s monthly spending.',
      'Everyday money = the usual month minus bills (rent and utilities, childcare, subscriptions, car), which are kept aside until paid.',
      'Safe to spend today = everyday money not spent yet, spread over the days left, today included.',
      'Projected month end = bills at their usual amount, the rest at your pace so far.',
      'Logged purchases stay in this log. They are not added to Transactions, so a statement you import later never counts them twice.',
    ],
  },

  privacy:
    'Your log is saved in this browser only. A line we can’t read ourselves is sent to our AI to sort, and is not stored.',
} as const;

export type SpendPresetId = keyof typeof spend.presets.names;
