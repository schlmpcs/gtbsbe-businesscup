// The budget table from planned amounts and the ledger: planned, actual, remaining and where "today" is.
//
// MP11b: this is `budgetRows` / `budgetRowsForYear` (MP9) with the same BudgetTable shape; wire to the
// engine and delete this file's `fixtureBudgetTable` (keep `elapsedShare` only if the engine does not
// take the day). The status rule here is a placeholder: over = actual above planned; onPace = above the
// pace expected by today but within the plan; under = at or below the pace.
import { COST_CATEGORIES, type BudgetRow, type BudgetTable, type CashFlowPeriod, type CostCategory, type LedgerTransaction, type Money, type YearMonth } from '@lifeguessr/types';
import { daysInMonth } from '@/features/bills/model/calendar';
import { incomeOf, inPeriod, spendingByCategory } from '@/features/transactions/model/ledger';
import type { BudgetMode } from './types';

/** How much of a period is gone, 0..1: a past period is 1, a future one 0, the current one counts the days. */
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

export function periodOf(mode: BudgetMode, month: YearMonth): CashFlowPeriod {
  return mode === 'month' ? { from: month, to: month } : { from: `${month.slice(0, 4)}-01`, to: `${month.slice(0, 4)}-12` };
}

function statusOf(planned: Money, actual: Money, expected: Money): BudgetRow['status'] {
  return actual > planned ? 'over' : actual > expected ? 'onPace' : 'under';
}

function line(planned: Money, actual: Money, elapsed: number) {
  const expectedByToday = planned * elapsed;
  return { planned, actual, remaining: planned - actual, expectedByToday, status: statusOf(planned, actual, expectedByToday) };
}

/** `planned` is per month; a year is twelve of them. */
export function fixtureBudgetTable(args: {
  planned: Record<CostCategory, Money>;
  incomePlanned: Money;
  txs: readonly LedgerTransaction[];
  mode: BudgetMode;
  month: YearMonth;
  today: string;
}): BudgetTable {
  const { planned, incomePlanned, txs, mode, month, today } = args;
  const period = periodOf(mode, month);
  const factor = mode === 'year' ? 12 : 1;
  const elapsed = elapsedShare(mode, month, today);
  const spent = new Map(spendingByCategory(txs, period).map((s) => [s.category, s.amount]));
  const rows: BudgetRow[] = COST_CATEGORIES.map((category) => ({ category, ...line(planned[category] * factor, spent.get(category) ?? 0, elapsed) }));
  const sum = (key: 'planned' | 'actual' | 'remaining' | 'expectedByToday') => rows.reduce((total, r) => total + r[key], 0);
  const earned = txs.filter((t) => inPeriod(t, period)).reduce((total, t) => total + incomeOf(t), 0);
  return {
    income: line(incomePlanned * factor, earned, elapsed),
    rows,
    totals: { planned: sum('planned'), actual: sum('actual'), remaining: sum('remaining'), expectedByToday: sum('expectedByToday') },
  };
}
