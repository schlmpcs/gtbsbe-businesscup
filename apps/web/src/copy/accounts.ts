// Strings for Accounts, Account detail and Add account: the screens' labels (MP11) and the
// "Add account" choices and form defaults (MP8 data, MP17 screens). Account names the person types
// stay in the browser; these are only the defaults and labels.
import type { AccountGroup, Debt } from '@lifeguessr/types';

type LoanKind = Exclude<Debt['kind'], 'card' | 'mortgage'>;

export const accounts = {
  title: 'Accounts',
  periods: { '1m': '1 month', '3m': '3 months', '1y': '1 year', all: 'All' },
  summaryModes: { totals: 'Totals', percent: 'Percent' },
  add: 'Add account',
  exportCsv: 'Export CSV',
  pickType: 'What kind of account?',
  back: 'Back',
  close: 'Close',
  submit: 'Add',
  /** `labelKey` of each add-account form field. */
  fields: {
    name: 'Name',
    balance: 'Balance',
    /** The money field of a thing you own (vehicle, real estate, other): what it is worth now. */
    value: 'Value today',
    apr: 'Interest rate (APR)',
    minPayment: 'Minimum payment (per month)',
    debtKind: 'Loan type',
    growth: 'How its value changes per year (optional)',
  },
  /** Title of the add-account form, e.g. "Add asset: Vehicle". */
  formTitle: {
    asset: (group: string) => `Add asset: ${group}`,
    liability: (group: string) => `Add liability: ${group}`,
  },
  debtKinds: { auto: 'Auto', student: 'Student', personal: 'Personal', bnpl: 'Buy now, pay later' },
  errors: { required: 'Required', invalid: 'Enter a valid number' },
  detail: {
    balance: 'Balance',
    type: 'Type',
    creditLimit: 'Credit limit',
    apr: 'APR',
    minPayment: 'Minimum payment',
    lastUpdated: 'Last updated',
    created: 'Created',
    excluded: 'Left out of net worth',
    transactions: 'Transactions',
    /** The yearly change row of an asset with that field; "Default" when the plan's default applies. */
    growth: 'Change per year',
    growthDefault: 'Default',
  },
  estimate: 'Estimate',

  sides: {
    asset: 'Asset',
    liability: 'Liability',
  },

  /** One label per account group; also the default name of a new account. */
  groups: {
    cash: 'Cash',
    investments: 'Investments',
    retirement: 'Retirement',
    realEstate: 'Real estate',
    vehicle: 'Vehicle',
    otherAsset: 'Other',
    creditCard: 'Credit card',
    loan: 'Loan',
    mortgage: 'Mortgage',
  } satisfies Record<AccountGroup, string>,

  /** Kinds of a Loan account (they set the default rate and term). */
  loanKinds: {
    auto: 'Auto loan',
    student: 'Student loan',
    personal: 'Personal loan',
    bnpl: 'Buy now, pay later',
  } satisfies Record<LoanKind, string>,

  /** The "Add account" menu's extra entries (the account form itself uses `fields`). */
  addMenu: {
    connectBank: 'Connect a bank',
    connectBankNote: 'Coming soon',
    importCsv: 'Import from CSV',
    importCsvNote: 'Add transactions from a bank statement file.',
  },

  form: {
    estimateNote: 'Estimate. Change it if you know yours.',
    /** The "I'm not sure" box on a money field (`canBeEstimate`). */
    notSure: "I'm not sure (mark as estimate)",
    /** Hint under a minimum payment we fill in when it is left blank. */
    defaultedHint: 'Leave it blank and we fill in a typical minimum from the balance and APR.',
    /** Hint under an interest rate (cards and loans). */
    aprHint: 'Per year, in percent (22.8 means 22.8%).',
    /**
     * Hint under an asset's yearly change, per group. `rate` is the plan's default for that group,
     * formatted from the engine constant (e.g. "−15%"); real estate and other assets have no fixed number.
     */
    growthHint: {
      vehicle: (rate: string) => `Leave blank to use a typical ${rate} a year (cars lose value). Use a minus for a loss.`,
      investments: (rate: string) => `Leave blank to use a typical ${rate} a year (before inflation). Use a minus for a loss.`,
      retirement: (rate: string) => `Leave blank to use a typical ${rate} a year (before inflation). Use a minus for a loss.`,
      realEstate: "Leave blank to use your area's typical home price growth. Use a minus for a loss.",
      otherAsset: 'Leave blank to have it keep pace with prices (inflation). Use a minus for a loss.',
    },
    moneyPlaceholder: '0',
  },

  /** "Estimate with AI" next to the yearly change field (Add account and Account detail). */
  growthAi: {
    button: 'Estimate with AI',
    loading: 'Asking the AI…',
    /** The tag on a rate the AI proposed; its one-line reason sits next to it. */
    label: 'AI estimate',
    privacy: 'The name you typed, the type and the value go to the AI to make the estimate. Nothing is stored.',
    scope: 'The AI only suggests the rate. You can change it; our engine runs your plan with it.',
    needsInput: 'Type a name and a value first.',
    errors: {
      unavailable: 'The AI estimate isn’t available right now. The field stays as it was.',
      rateLimited: 'Too many AI requests. Try again in a minute; the field stays as it was.',
      failed: 'We couldn’t get a sensible AI estimate. The field stays as it was.',
    },
  },

  /** The Accounts screen (MP17). Amounts come from the view-model; these are only the words around them. */
  screen: {
    intro: 'Everything you own and owe, in one place. Accounts stay in this browser.',
    loading: 'Loading your accounts…',
    netWorth: 'Net worth',
    /** Next to the 1-month change, e.g. "+$800 last month". */
    lastMonth: 'last month',
    noChange: 'No balance a month back yet',
    chartLabel: 'Net worth over time',
    chartTooFew: 'Your net worth line starts when you have balances from two different months.',
    periodLabel: 'Period',
    summaryTitle: 'Assets and liabilities',
    splitLabel: 'Assets against liabilities',
    groupCount: (n: number) => `${n} ${n === 1 ? 'account' : 'accounts'}`,
    summaryModeLabel: 'Show as',
    groupsTitle: 'Your accounts',
    excludedTag: 'Not counted',
    excludedHint: 'Left out of net worth and the plan',
    manualTag: 'Manual',
    emptyTitle: 'Add your first account',
    emptyBody: 'Type a balance for checking, savings, a card or a loan. Or import a bank statement to start with your transactions.',
    importCta: 'Import a CSV',
    privacy: 'Account names and balances stay in this browser (unless you tap “Estimate with AI”, which sends one account’s name, type and value, not stored).',
  },

  /** Account detail (/accounts/[id]). */
  detailScreen: {
    backToAccounts: 'All accounts',
    notFoundTitle: 'Account not found',
    notFoundBody: 'It may have been deleted, or it was added in another browser.',
    loading: 'Loading the account…',
    chartLabel: 'Balance over time',
    summaryTitle: 'Summary',
    notSet: '—',
    manage: 'Manage',
    newBalance: 'New balance (this month)',
    saveBalance: 'Save balance',
    invalidBalance: 'Enter a balance of 0 or more.',
    rename: 'Rename',
    newName: 'Account name',
    saveName: 'Save name',
    growthLabel: 'Change per year, in percent (blank = default)',
    saveGrowth: 'Save change per year',
    invalidGrowth: 'Enter a percent, like -12 or 4.5, or leave it blank.',
    blankName: 'Enter a name.',
    exclude: 'Leave out of net worth',
    include: 'Count in net worth',
    delete: 'Delete account',
    confirmDelete: 'Delete this account? Its transactions stay, without an account.',
    confirmDeleteYes: 'Yes, delete',
    cancel: 'Cancel',
    noTransactions: 'No transactions on this account yet.',
    addTransaction: 'Add a transaction',
  },
} as const;
