// The budget table from the plan and the ledger, by the engine (MP9): `budgetRows` for a month,
// `budgetRowsForYear` for a year. This file only prepares their input: the month's totals from the
// ledger (`transactionTotals`) and "how far into the month today is".
import { budgetRows, budgetRowsForYear } from '@lifeguessr/engine';
import { COST_CATEGORIES, type BudgetTable, type CategoryTotals, type CostCategory, type Money, type YearMonth } from '@lifeguessr/types';
import { daysInMonth } from '@/features/bills/model/calendar';
import type { BudgetMode } from './types';

/** Where today is in `month`: the day and the month's length; a past month is all gone, a future one has just begun. */
export function budgetDay(month: YearMonth, today: string): { day: number; daysInMonth: number } {
  const days = daysInMonth(Number(month.slice(0, 4)), Number(month.slice(5, 7)));
  const todayMonth = today.slice(0, 7);
  return { day: month < todayMonth ? days : month > todayMonth ? 1 : Number(today.slice(8, 10)), daysInMonth: days };
}

const zeroMonth = (month: YearMonth, lastDay: number | undefined): CategoryTotals => ({
  month,
  totals: Object.fromEntries(COST_CATEGORIES.map((c) => [c, 0])) as Record<CostCategory, Money>,
  oneOffs: [],
  ...(lastDay === undefined ? {} : { lastDay }),
});

/**
 * The twelve months of `year`: the ledger's totals where there are some, an empty month otherwise, so
 * a year's plan is twelve planned months. An empty month still to come counts as just begun (day 1).
 */
export function yearMonths(totals: readonly CategoryTotals[], year: number, today: string): CategoryTotals[] {
  const todayMonth = today.slice(0, 7);
  return Array.from({ length: 12 }, (_, i) => {
    const month = `${year}-${String(i + 1).padStart(2, '0')}`;
    return totals.find((m) => m.month === month) ?? zeroMonth(month, month > todayMonth ? 1 : month === todayMonth ? Number(today.slice(8, 10)) : undefined);
  });
}

/** The table on screen: the month of `month`, or the year it is in. */
export function budgetTable(args: {
  planned: Record<CostCategory, Money>;
  totals: readonly CategoryTotals[];
  mode: BudgetMode;
  month: YearMonth;
  today: string;
}): BudgetTable {
  const { planned, totals, mode, month, today } = args;
  if (mode === 'year') {
    const year = Number(month.slice(0, 4));
    return budgetRowsForYear(planned, yearMonths(totals, year, today), year);
  }
  return budgetRows(planned, totals.find((m) => m.month === month) ?? null, budgetDay(month, today));
}

/** How much of the period on screen is gone, 0..1, for the "today" marker on the bars. */
export function elapsedShare(mode: BudgetMode, month: YearMonth, today: string): number {
  const todayMonth = today.slice(0, 7);
  const day = Number(today.slice(8, 10));
  const [ty, tm] = [Number(todayMonth.slice(0, 4)), Number(todayMonth.slice(5, 7))];
  const [y, m] = [Number(month.slice(0, 4)), Number(month.slice(5, 7))];
  const monthShare = (cy: number, cm: number): number => (cy * 12 + cm < ty * 12 + tm ? 1 : cy * 12 + cm > ty * 12 + tm ? 0 : day / daysInMonth(cy, cm));
  if (mode === 'month') return monthShare(y, m);
  if (y < ty) return 1;
  if (y > ty) return 0;
  return (tm - 1 + monthShare(ty, tm)) / 12;
}
