// The planned amounts, held in memory. Per MONTH. Starts without a budget (`planned: null`).
// MP11b: replace with the real budget store (MP9); hooks read it through selectors only.
import { create } from 'zustand';
import { COST_CATEGORIES, type CostCategory, type Money } from '@lifeguessr/types';

export type BudgetFixtureData = {
  /** null = no budget yet. */
  planned: Record<CostCategory, Money> | null;
  /** Planned monthly income (the profile's take-home pay when created). */
  incomePlanned: Money;
};
export type BudgetFixtureActions = {
  create: (planned: Record<CostCategory, Money>, incomePlanned: Money) => void;
  setPlanned: (category: CostCategory, amount: Money) => void;
};

export const zeroPlanned = (): Record<CostCategory, Money> => Object.fromEntries(COST_CATEGORIES.map((c) => [c, 0])) as Record<CostCategory, Money>;
export const initialBudgetData = (): BudgetFixtureData => ({ planned: null, incomePlanned: 0 });

export const useBudgetStore = create<BudgetFixtureData & BudgetFixtureActions>()((set) => ({
  ...initialBudgetData(),
  create: (planned, incomePlanned) => set({ planned: { ...planned }, incomePlanned }),
  setPlanned: (category, amount) => set((s) => ({ planned: { ...(s.planned ?? zeroPlanned()), [category]: amount } })),
}));

/** Back to "no budget" (tests). */
export function resetBudgetStore(): void {
  useBudgetStore.setState(initialBudgetData());
}
