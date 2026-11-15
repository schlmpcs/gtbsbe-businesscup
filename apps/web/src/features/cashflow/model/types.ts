// View-model contract of the Cash Flow screen (MP11, #171). ui/ may import only this file, @/ui-kit/**
// and @/copy (lint-enforced). Hook: useCashFlow (./useCashFlow.ts).
// Units: every Money is unrounded US dollars summed over the period it sits in; `savingsRate` and
// `share` are ratios (0.18 = 18%), not percents. Names: copy.cashflow, copy.planner.categories and
// copy.planner.budgetGroups. Transfers between your own accounts are in neither income nor expenses.
import type { CashFlowPeriod, CashFlowSummary, CostCategory, Money, Rate } from '@lifeguessr/types';
import type { BudgetGroupId } from '@/features/budget/model/groups';
import type { TransactionRowVM } from '@/features/transactions/model/types';

export type { CashFlowPeriod, CashFlowSummary, CostCategory, Money, Rate } from '@lifeguessr/types';
export type { BudgetGroupId } from '@/features/budget/model/groups';
export type { TransactionRowVM } from '@/features/transactions/model/types';

export type CashFlowPeriodKind = 'monthly' | 'quarterly' | 'yearly';
export type CashFlowBreakdown = 'category' | 'group';
export type CashFlowView = 'bars' | 'sankey';

/** One bar pair: the income and expenses of a month, a calendar quarter or a calendar year. */
export type CashFlowBarVM = {
  period: CashFlowPeriod;
  /** 1..4 for a quarterly bar, null otherwise. */
  quarter: 1 | 2 | 3 | 4 | null;
  income: Money;
  expenses: Money;
  /** income - expenses (negative = overspent). */
  savings: Money;
  /** The period contains today (it may still be in progress). */
  isCurrent: boolean;
};

export type CashFlowKpiId = 'income' | 'expenses' | 'savings' | 'savingsRate';
/**
 * A tile for the current period; `previous` is the same figure one period back (null when there is none)
 * and `change` is value - previous (null when either is missing).
 */
export type CashFlowKpiVM =
  | { id: 'income' | 'expenses' | 'savings'; value: Money; previous: Money | null; change: Money | null }
  | { id: 'savingsRate'; value: Rate | null; previous: Rate | null; change: Rate | null };

/** Where the money of the current period went, as the Sankey draws it (by category or by group). */
export type CashFlowFlowTargetVM =
  | { kind: 'category'; id: CostCategory; group: BudgetGroupId; value: Money }
  | { kind: 'group'; id: BudgetGroupId; group: BudgetGroupId; value: Money }
  | { kind: 'oneOffs'; id: string; group: null; value: Money }
  | { kind: 'savings'; id: 'savings'; group: null; value: Money };

export type CashFlowFlowVM = {
  /** What fed Income: pay, and the gap taken from savings when spending beat pay. */
  sources: { id: 'pay' | 'fromSavings'; value: Money }[];
  /** The Income node: the sum of `sources` (= the sum of `targets`). */
  total: Money;
  /** Spending targets largest first, then what was saved (if anything). */
  targets: CashFlowFlowTargetVM[];
};

export type CashFlowBreakdownRowVM =
  | { kind: 'category'; category: CostCategory; amount: Money; share: Rate }
  | { kind: 'group'; group: BudgetGroupId; amount: Money; share: Rate };

export type CashFlowVM = {
  /** False until saved state is loaded (always true on fixtures). */
  ready: boolean;
  /** No transactions in the window the bars cover: show the empty state. */
  empty: boolean;
  period: CashFlowPeriodKind;
  setPeriod: (period: CashFlowPeriodKind) => void;
  view: CashFlowView;
  setView: (view: CashFlowView) => void;
  /** Oldest first, the last one is the current period: 6 months, 4 quarters or 3 years. */
  bars: CashFlowBarVM[];
  /** Income, expenses, savings, savings rate of the current period, in this order. */
  kpis: CashFlowKpiVM[];
  breakdown: CashFlowBreakdown;
  setBreakdown: (breakdown: CashFlowBreakdown) => void;
  /** Spending of the current period by category or group, largest first. `share` is of total expenses. */
  breakdownRows: CashFlowBreakdownRowVM[];
  /** The current period in the engine's shape. */
  summary: CashFlowSummary;
  /** The current period's Sankey, grouped by `breakdown`. */
  flow: CashFlowFlowVM;
  /** The current period's latest lines (transfers left out), newest first, at most LINES_SHOWN. */
  lines: TransactionRowVM[];
  /** How many lines (transfers left out) the current period has in all. */
  lineCount: number;
};
