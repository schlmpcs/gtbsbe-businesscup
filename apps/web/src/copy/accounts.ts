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
    apr: 'Interest rate (APR)',
    minPayment: 'Minimum payment (per month)',
    debtKind: 'Loan type',
    growth: 'Expected change per year',
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
    percentHint: 'Per year, in percent (22.8 means 22.8%).',
    moneyPlaceholder: '0',
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
    summaryModeLabel: 'Show as',
    groupsTitle: 'Your accounts',
    excludedTag: 'Not counted',
    excludedHint: 'Left out of net worth and the plan',
    manualTag: 'Manual',
    emptyTitle: 'Add your first account',
    emptyBody: 'Type a balance for checking, savings, a card or a loan. Or import a bank statement to start with your transactions.',
    importCta: 'Import a CSV',
    privacy: 'Account names and balances stay in this browser.',
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
    editBalance: 'Update balance',
    newBalance: 'New balance (this month)',
    saveBalance: 'Save balance',
    invalidBalance: 'Enter a balance of 0 or more.',
    rename: 'Rename',
    newName: 'Account name',
    saveName: 'Save name',
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
