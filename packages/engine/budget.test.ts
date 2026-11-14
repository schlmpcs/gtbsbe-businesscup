// MP9 (#169): budgetRows. Hand-checked numbers next to each case.
import {
  BudgetIncomeRowSchema, BudgetRowSchema, COST_CATEGORIES, type CategoryTotals, type CostCategory, type Money,
} from '@lifeguessr/types';
import { describe, expect, it } from 'vitest';
import { budgetRows } from './budget';

const byCategory = (t: Partial<Record<CostCategory, Money>> = {}): Record<CostCategory, Money> =>
  Object.fromEntries(COST_CATEGORIES.map((c) => [c, t[c] ?? 0])) as Record<CostCategory, Money>;

describe('budgetRows', () => {
  it('day 15 of 30: groceries $200 of $600 is under (expected $300); rent paid in full is on pace', () => {
    const planned = byCategory({ rentUtilities: 1_720, groceries: 600 });
    const actual: CategoryTotals = { month: '2026-11', totals: byCategory({ rentUtilities: 1_720, groceries: 200 }), oneOffs: [] };
    const table = budgetRows(planned, actual, { day: 15, daysInMonth: 30 });
    expect(BudgetIncomeRowSchema.safeParse(table.income).success).toBe(true);
    for (const r of table.rows) expect(BudgetRowSchema.safeParse(r).success).toBe(true);
    const row = (c: CostCategory) => table.rows.find((r) => r.category === c)!;

    // Groceries (flexible): expected = 600 × 15 / 30 = 300. |200 − 300| = 100 > 10% × 300 = 30, and
    // 200 ≤ 600 is not over → under. Remaining = 600 − 200 = 400.
    expect(row('groceries')).toEqual({
      category: 'groceries', planned: 600, actual: 200, remaining: 400, expectedByToday: 300, status: 'under',
    });
    // Rent (fixed): paid this month, so the full 1,720 is expected. |1,720 − 1,720| = 0 ≤ 172 → on pace.
    expect(row('rentUtilities')).toEqual({
      category: 'rentUtilities', planned: 1_720, actual: 1_720, remaining: 0, expectedByToday: 1_720, status: 'onPace',
    });
  });
});
