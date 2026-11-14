// Pure view shaping of the budget table: bars and groups. The numbers are the engine's; this adds the
// bar ratios and the group sums the engine does not give.
import type { BudgetIncomeRow, BudgetRow, BudgetTable, BudgetTotals, Money } from '@lifeguessr/types';
import { BUDGET_GROUPS } from './groups';
import type { BudgetGroupVM, BudgetIncomeRowVM, BudgetRowVM } from './types';

/** Share of the plan spent: 0 for nothing planned and nothing spent, 1 for spending on an unplanned line. */
export const progressOf = (planned: number, actual: number): number => (planned > 0 ? actual / planned : actual > 0 ? 1 : 0);

export const toRowVM = (row: BudgetRow, todayMarker: number): BudgetRowVM => ({ ...row, progress: progressOf(row.planned, row.actual), todayMarker });

/**
 * The income line. The engine has no planned income (its line is planned = actual = the detected pay),
 * so the planned take-home pay, for `months` months, replaces `planned` and `remaining` follows it.
 */
export function toIncomeVM(row: BudgetIncomeRow, incomePlanned: Money, months: number, todayMarker: number): BudgetIncomeRowVM {
  const planned = incomePlanned * months;
  return { ...row, planned, remaining: planned - row.actual, progress: progressOf(planned, row.actual), todayMarker };
}

export function sumRows(rows: readonly BudgetRow[]): BudgetTotals {
  const sum = (key: keyof BudgetTotals) => rows.reduce((total, r) => total + r[key], 0);
  return { planned: sum('planned'), actual: sum('actual'), remaining: sum('remaining'), expectedByToday: sum('expectedByToday') };
}

/** The table's rows in their groups, every category in exactly one. `todayMarker` is how far into the period today is (0..1). */
export function toGroupVMs(table: BudgetTable, todayMarker: number): BudgetGroupVM[] {
  return BUDGET_GROUPS.map(({ id, categories }) => {
    const rows = table.rows.filter((r) => categories.includes(r.category));
    return { id, rows: rows.map((r) => toRowVM(r, todayMarker)), totals: sumRows(rows) };
  });
}
