// STUB until T9 (Aibek) — replace with the real implementation + tests
// Returns the "no upload" state from the spec: the monthly spend implied by the profile, no
// average and no drift flags. Spec: docs/ENGINEERING.md → Month-end.
/* eslint-disable @typescript-eslint/no-unused-vars -- `history` and `current` are used by T9 */
import { COST_CATEGORIES, type CategoryTotals, type CostCategory, type MonthEnd, type Money, type Profile } from '@lifeguessr/types';

export type CurrentMonth = { month: string; day: number; totals: Record<CostCategory, Money> };

/** Month-end projection vs the 3-month average, with drift flags per category. */
export function monthEnd(p: Profile, history: CategoryTotals[], current?: CurrentMonth): MonthEnd {
  // debtPayments is informational; loan/card payments come from p.debts (see the contract).
  const projectedSpend = COST_CATEGORIES
    .filter((c) => c !== 'debtPayments')
    .reduce((sum, c) => sum + p.spending[c].value, 0);
  return { projectedSpend, vsAverage: null, drifts: [] };
}
