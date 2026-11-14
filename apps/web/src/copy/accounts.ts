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
  },
} as const;
