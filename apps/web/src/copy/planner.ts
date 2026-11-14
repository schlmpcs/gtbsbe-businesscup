// Shared labels for the planner screens (MP11, epic #160): categories, account groups and budget
// groups, keyed by the ids the view-models return. One place so Dashboard, Accounts, Transactions,
// Cash Flow and Budget never word the same thing twice. No math, no formatted amounts.
import type { AccountGroup, StatementClass } from '@lifeguessr/types';

export const planner = {
  /** A statement line's class: a spending category, money in (`pay`) or money moved (`transfer`). */
  categories: {
    rentUtilities: 'Rent and utilities',
    car: 'Car',
    childcare: 'Childcare',
    groceries: 'Groceries',
    eatingOut: 'Eating out',
    subscriptions: 'Subscriptions',
    debtPayments: 'Debt payments',
    other: 'Other',
    pay: 'Pay',
    transfer: 'Transfer',
  } satisfies Record<StatementClass, string>,
  accountGroups: {
    cash: 'Cash',
    investments: 'Investments',
    retirement: 'Retirement',
    realEstate: 'Real estate',
    vehicle: 'Vehicles',
    otherAsset: 'Other assets',
    creditCard: 'Credit cards',
    loan: 'Loans',
    mortgage: 'Mortgage',
  } satisfies Record<AccountGroup, string>,
  /** Budget groups (budget/model/groups.ts), also used by the Cash Flow "Group" breakdown. */
  budgetGroups: {
    essentials: 'Essentials',
    lifestyle: 'Lifestyle',
    debt: 'Debt',
  },
  assets: 'Assets',
  liabilities: 'Liabilities',
  netWorth: 'Net worth',
  educational: 'Educational simulation, not financial advice.',
} as const;
