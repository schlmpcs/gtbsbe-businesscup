// Strings for Accounts (P2): the "Add account" choices and the account form (MP8 data, MP17 screens).
// Account names the person types stay in the browser; these are only the defaults and labels.
import type { AccountGroup, Debt } from '@lifeguessr/types';

type LoanKind = Exclude<Debt['kind'], 'card' | 'mortgage'>;

export const accounts = {
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

  add: {
    title: 'Add account',
    connectBank: 'Connect a bank',
    connectBankNote: 'Coming soon',
    importCsv: 'Import from CSV',
    importCsvNote: 'Add transactions from a bank statement file.',
  },

  form: {
    name: 'Name',
    balance: 'Balance',
    apr: 'Interest rate (APR)',
    minPayment: 'Minimum payment per month',
    estimateNote: 'Estimate. Change it if you know yours.',
  },
} as const;
