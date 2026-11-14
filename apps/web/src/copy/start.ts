// /start: onboarding without typing. Transactions are the only input: a (simulated, labeled) bank
// connection, your own CSV, or a statement generated from public data for a ZIP. Every number after it comes from the
// same reader, categorizer and engine. Strings only; the screen is features/start.
import type { CostCategory } from '@lifeguessr/types';

export const start = {
  screens: { start: 'Get your plan' },

  steps: ['Source', 'Read', 'Your month', 'Your plan'] as const,
  stepsLabel: 'Progress',

  choose: {
    eyebrow: 'No sign-up · no typing · about a minute',
    title: 'Your next 10 years, read from your bank.',
    lead: 'Three months of transactions are enough to price your month, project your future and rank your next money moves.',
    connect: {
      title: 'Connect your bank',
      body: 'Read-only. We see transactions, never your login or account number.',
      badge: 'Demo',
    },
    upload: {
      title: 'Upload a bank CSV',
      body: 'Read in this browser; only masked labels, amounts and dates leave it.',
    },
    pickFile: 'Choose a CSV file',
    noBank: 'No US bank account?',
    generateLink: 'Build a sample statement',
  },

  connect: {
    back: 'Back',
    pickTitle: 'Connect your bank',
    pickLead: 'Pick your bank to share three months of transactions, read-only.',
    demoNote: 'Demo: simulated. Nothing connects to your bank and no login is asked; you get an invented customer’s statement in that bank’s export format. A real read-only connection through an aggregator comes next.',
    accountsTitle: (bank: string) => `Share from ${bank}`,
    accountsLead: 'Only this account is shared, and only to read it.',
    holder: (metro: string) => `Invented demo customer · ${metro}`,
    readOnly: 'Read-only · last 90 days',
    weSee: 'We read: merchant, amount, date.',
    weNever: 'We never see: your login, account number or balance history.',
    share: 'Share 1 account',
    linking: (bank: string) => `Connecting to ${bank}…`,
    linkingSteps: ['Opening a secure, read-only session', 'Fetching 90 days of transactions'],
  },

  generate: {
    back: 'Back',
    title: 'Generate a life like yours',
    lead: 'Five taps. Every amount starts from public data for the place you pick.',
    city: 'City',
    neighborhood: 'Neighborhood',
    tiers: { cheap: 'Budget', mid: 'Middle', expensive: 'Upscale', suburb: 'Suburb' },
    household: 'Household',
    households: { solo: 'Just me', couple: 'Couple', family: 'Couple + kid', singleParent: 'Single parent' },
    pay: 'Take-home pay',
    pays: { lean: 'Lean', steady: 'Steady', comfortable: 'Comfortable' },
    perMonth: '/mo',
    style: 'Lifestyle',
    styles: { saver: 'Saver', typical: 'Typical', spender: 'Spender' },
    previewTitle: 'What the statement will be built from',
    previewRent: (bedrooms: number) => (bedrooms === 0 ? 'Rent + utilities, studio' : `Rent + utilities, ${bedrooms}-bed`),
    previewChildcare: 'Childcare, center-based',
    previewGroceries: 'Groceries',
    previewCar: 'Car insurance + gas',
    previewTransit: 'Transit pass',
    previewPay: 'Take-home pay',
    previewNote: 'Real public figures for this ZIP. The day-to-day lines around them are generated.',
    cta: 'Generate my statement',
    regenerate: 'Regenerate',
  },

  reading: {
    title: {
      generated: 'Printing your statement',
      bank: (bank: string) => `Reading your ${bank} checking`,
      upload: 'Reading your statement',
    },
    steps: {
      fetch: 'Building three months of transactions',
      fetchBank: 'Receiving 90 days of transactions',
      parse: (n: number) => `Reading ${n} lines in this browser`,
      mask: 'Masking names and account numbers',
      sort: 'Sorting merchants into 8 categories',
      find: 'Finding paychecks, rent, loans and subscriptions',
    },
    leavesTitle: 'Everything that leaves this browser',
    leavesNote: 'Masked label, amount, month and day. No balances, no account numbers, no names. Nothing is stored.',
    more: (n: number) => `+ ${n} more lines`,
    guessTitle: {
      own: 'While we read: what do you spend in a month?',
      other: 'While we read: what does this life spend in a month?',
    },
    guessLabel: 'Your guess, per month',
    guessHint: 'Everything except savings and one-off trips.',
    lock: 'Lock my guess',
    locked: 'Guess locked',
    waiting: 'Almost done…',
  },

  reveal: {
    youGuessed: 'You guessed',
    actual: 'Actual monthly spending',
    over: (diff: string) => `${diff} more than you thought`,
    under: (diff: string) => `${diff} less than you thought`,
    close: 'Spot on, within 10%',
    noGuess: 'Monthly spending',
    payIn: 'Paychecks in',
    leftOver: 'Left over',
    shortfall: 'Short each month',
    biggest: (category: string, share: string) => `${category} is ${share} of the month.`,
    breakdownLabel: 'Monthly spending by category',
    perMonth: 'a month',
    oneOffsTitle: 'One-offs, not counted as monthly',
    months: (n: number) => (n === 1 ? 'from 1 full month' : `averaged over ${n} full months`),
    categorizedBy: { ai: 'Sorted by AI, summed in code', rules: 'Sorted by keyword rules, summed in code', mixed: 'Sorted by AI and rules, summed in code' },
  },

  review: {
    questionsTitle: 'Two things a statement can’t tell us',
    questionsLead: 'Tap an answer or skip. The totals above follow your answers.',
    merchant: (label: string) => `What is “${label}” mostly?`,
    cash: 'What does the cash pay for?',
    missing: (category: string) => `No ${category.toLowerCase()} in the statement. Paid somewhere else?`,
    none: 'No, none',
    skip: 'Skip',
    cta: 'Build my 10-year plan',
    again: 'Start over',
    estimatesNote: 'Age, savings and loan balances start as typical values for you to correct on the plan.',
  },

  errors: {
    generate: 'Couldn’t get the transactions. Try again.',
    unreadable: 'We couldn’t read that file as a bank statement. Download a CSV from your bank and try again.',
    network: 'Couldn’t reach the server. Check your connection and try again.',
    retry: 'Try again',
  },

  sourceLabel: {
    generated: 'Generated statement',
    bank: 'Demo bank connection · simulated',
    upload: 'Your statement',
  },
} as const;

export type StartCopy = typeof start;
export type StartCategoryNames = Record<CostCategory, string>;
