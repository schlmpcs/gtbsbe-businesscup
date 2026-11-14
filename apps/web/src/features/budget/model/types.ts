// View-model contract of the Budget screen (MP11, #171). ui/ may import only this file, @/ui-kit/**
// and @/copy (lint-enforced). Hook: useBudget (./useBudget.ts).
// Units: every Money is unrounded US dollars for the period on screen (a month in 'month' mode, the
// year in 'year' mode). `progress` and `todayMarker` are ratios, not percents. Names: copy.planner
// (categories, budgetGroups) and copy.budget (statuses, columns).
import type { BudgetIncomeRow, BudgetRow, BudgetTotals, CostCategory, YearMonth } from '@lifeguessr/types';
import type { BudgetGroupId } from './groups';

export type { BudgetIncomeRow, BudgetRow, BudgetTotals, CostCategory, Money, YearMonth } from '@lifeguessr/types';
export type { BudgetGroupId } from './groups';

export type BudgetMode = 'month' | 'year';
export type BudgetStatus = BudgetRow['status'];

/** The share of a line the bars draw. */
type BarFields = {
  /** actual / planned, 0 or more (more than 1 = over budget). 0 for an unplanned line with no spending, 1 for one with spending. */
  progress: number;
  /** How far into the period "today" is, 0..1: the same for every line (a past period is 1, a future one 0). */
  todayMarker: number;
};

export type BudgetRowVM = BudgetRow & BarFields;
export type BudgetIncomeRowVM = BudgetIncomeRow & BarFields;

export type BudgetGroupVM = {
  id: BudgetGroupId;
  rows: BudgetRowVM[];
  totals: BudgetTotals;
};

export type BudgetVM = {
  /** False until saved state is loaded (always true on fixtures). */
  ready: boolean;
  /** A budget exists (createBudget or setPlanned was used); false = show the "Create budget" state. */
  hasBudget: boolean;
  mode: BudgetMode;
  setMode: (mode: BudgetMode) => void;
  /** The month on screen, 'YYYY-MM' (in 'year' mode, any month of the year on screen). */
  month: YearMonth;
  /** "November 2026", or "2026" in 'year' mode. */
  monthLabel: string;
  /** The period on screen contains today. */
  isCurrent: boolean;
  income: BudgetIncomeRowVM;
  /** Essentials, lifestyle, debt; every cost category sits in exactly one group. */
  groups: BudgetGroupVM[];
  /** Over the cost categories (income not included). */
  totals: BudgetTotals;
  /** Fills every planned amount from the profile's monthly spending and its take-home pay. */
  createBudget: () => void;
  /** Sets one category's planned amount per MONTH (>= 0); false when `amount` is not a valid amount. */
  setPlanned: (category: CostCategory, amount: number) => boolean;
  /** Previous / next month (year in 'year' mode). */
  prev: () => void;
  next: () => void;
  /** Back to the current month. */
  today: () => void;
};
