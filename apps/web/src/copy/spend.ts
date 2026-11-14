// Strings for the daily spending log (/spend) and its quick-add on Home (S1).
// Functions take values already formatted by the UI (formatMoney / formatMonth); no math here.

export const spend = {
  eyebrow: 'Daily log',
  title: 'What did you spend today?',
  intro: 'Type it or say it, one line for everything. Your log stays in this browser.',
  homeLink: 'Open your daily log',
  backHome: 'Back to Home',

  input: {
    label: 'Log spending',
    placeholder: 'coffee 5, taxi 18, groceries 64',
    hint: 'Commas between purchases. “$18 uber” and “кофе 5” work too.',
    add: 'Add',
    reading: 'Reading…',
    mic: 'Say it',
    micStop: 'Stop listening',
    listening: 'Listening… say “coffee five dollars”.',
    micError: 'Couldn’t hear that. Try again, or type it.',
  },

  presets: {
    title: 'One tap',
    /** The chip prices are typical amounts we picked, not yours. */
    note: 'Typical prices (estimates). Type the line for the exact amount.',
    names: {
      coffee: 'Coffee',
      lunch: 'Lunch',
      groceries: 'Groceries',
      taxi: 'Taxi',
      gas: 'Gas',
    },
    /** "Add Coffee, $5 (estimate)" for screen readers. */
    aria: (name: string, amount: string) => `Add ${name}, ${amount} (estimate)`,
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
    byDay: 'By day',
    empty: 'Nothing logged this month yet.',
    remove: (what: string) => `Remove ${what}`,
  },

  privacy:
    'Your log is saved in this browser only. A line we can’t read ourselves is sent to our AI to sort, and is not stored.',
} as const;

export type SpendPresetId = keyof typeof spend.presets.names;
