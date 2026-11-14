// Budget table: planned vs actual per category. Task MP9 (#169). Stubs until then: signatures are
// final, bodies throw.
import type { BudgetDay, BudgetTable, CategoryTotals, CostCategory, Money } from '@lifeguessr/types';

/** One month: `planned` monthly (default profile.spending), `actual` from the month's statement or daily log. */
export function budgetRows(
  _planned: Record<CostCategory, Money>, _actual: CategoryTotals | null, _today: BudgetDay,
): BudgetTable {
  throw new Error('not implemented: budgetRows (MP9)');
}

/** The year view: sums the months of `year` that have data (`planned` is monthly). */
export function budgetRowsForYear(
  _planned: Record<CostCategory, Money>, _months: readonly CategoryTotals[], _year: number,
): BudgetTable {
  throw new Error('not implemented: budgetRowsForYear (MP9)');
}
