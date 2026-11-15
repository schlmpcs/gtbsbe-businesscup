// Strings for the demo bank link (features/bankDemo). It is a DEMO: the banks are made up, the sign-in
// sends nothing, and the transactions are one of our synthetic statements read by the CSV pipeline.
// Never a real bank's name or logo here.
export const bankDemo = {
  badge: 'Demo · sample data',
  /** The one line under "Connect your bank" wherever it is offered. */
  disclaimer: 'A demo of the bank link: pick a test bank, its transactions are sample data. Real bank connections are coming.',
  entry: {
    title: 'Connect your bank',
    short: 'Connect your bank (demo)',
    cta: 'Connect',
  },

  /** Made-up demo banks; each name says "(demo)". */
  banks: {
    maple: 'Maple Credit Union (demo)',
    harbor: 'Harbor Bank (demo)',
    summit: 'Summit Savings (demo)',
    juniper: 'Juniper Federal (demo)',
    lantern: 'Lantern Online Bank (demo)',
    pebble: 'Pebble Money (demo)',
    bluebird: 'Bluebird Bank (demo)',
  },

  pick: {
    title: 'Pick a test bank',
    searchLabel: 'Search demo banks',
    searchPlaceholder: 'Search demo banks',
    none: 'No demo bank by that name.',
  },

  signIn: {
    title: (bank: string) => `Sign in to ${bank}`,
    user: 'Username',
    password: 'Password',
    note: 'Demo credentials — nothing is sent anywhere.',
    submit: 'Connect',
  },

  connecting: {
    title: 'Connecting…',
    steps: {
      verify: 'Verifying',
      accounts: 'Reading accounts',
      /** `days` from the statement once it is in (null before). */
      transactions: (days: number | null) => (days === null ? 'Reading transactions' : `Reading ${days} days of transactions`),
    },
    done: 'Done',
    working: 'In progress',
    waiting: 'Waiting',
  },

  connected: {
    title: 'Connected',
    intro: (bank: string) => `Accounts found at ${bank}. Sample data from a made-up household.`,
    checking: 'Checking (demo)',
    card: 'Credit card (demo)',
    checkingNote: (transactions: number, days: number) => `${transactions} transactions over ${days} days`,
    cardNote: (payments: number) => `Paid from checking ${payments === 1 ? 'once' : `${payments} times`}`,
    use: 'Use these transactions',
    privacy: 'Read in your browser like a CSV: only shop names, amounts and dates go out to be sorted.',
  },

  error: {
    title: 'The demo bank did not answer.',
    retry: 'Try again',
  },

  back: '← Back',
  close: 'Close',
} as const;
