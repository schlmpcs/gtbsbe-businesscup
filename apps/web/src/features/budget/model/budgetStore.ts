// The person's budget plan, kept in this browser (same safeStorage as the other stores). `planned` is per
// MONTH per category: "Create budget" fills it from the profile's spending (MP9 `budgetRows` input), and
// each cell the person edits replaces its value. Starts without a budget (`planned: null`).
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { COST_CATEGORIES, type CostCategory, type Money } from '@lifeguessr/types';
import { registerDataClearer } from '@/lib/model/transactions';
import { safeStateStorage } from '@/lib/safeStorage';

export const BUDGET_STORE_KEY = 'lifeguessr.budget';

export type BudgetData = {
  /** null = no budget yet. */
  planned: Record<CostCategory, Money> | null;
  /** Planned monthly income (the profile's take-home pay when created). */
  incomePlanned: Money;
};
export type BudgetActions = {
  create: (planned: Record<CostCategory, Money>, incomePlanned: Money) => void;
  setPlanned: (category: CostCategory, amount: Money) => void;
};

export const zeroPlanned = (): Record<CostCategory, Money> => Object.fromEntries(COST_CATEGORIES.map((c) => [c, 0])) as Record<CostCategory, Money>;
export const initialBudgetData = (): BudgetData => ({ planned: null, incomePlanned: 0 });

const isAmount = (v: unknown): v is Money => typeof v === 'number' && Number.isFinite(v) && v >= 0;

/** Saved data read back: a plan with any amount that is not a finite number >= 0 is dropped (the engine rejects it). */
function restore(saved: unknown): BudgetData {
  const data = (saved ?? {}) as { planned?: Record<string, unknown> | null; incomePlanned?: unknown };
  const planned = data.planned;
  if (!planned || typeof planned !== 'object' || !COST_CATEGORIES.every((c) => isAmount(planned[c]))) return initialBudgetData();
  return { planned: planned as Record<CostCategory, Money>, incomePlanned: isAmount(data.incomePlanned) ? data.incomePlanned : 0 };
}

export const useBudgetStore = create<BudgetData & BudgetActions>()(
  persist(
    (set) => ({
      ...initialBudgetData(),
      create: (planned, incomePlanned) => set({ planned: { ...planned }, incomePlanned }),
      setPlanned: (category, amount) => set((s) => ({ planned: { ...(s.planned ?? zeroPlanned()), [category]: amount } })),
    }),
    {
      name: BUDGET_STORE_KEY,
      version: 1,
      storage: createJSONStorage(() => safeStateStorage),
      skipHydration: true,
      merge: (saved, current) => (saved === undefined ? current : { ...current, ...restore(saved) }),
      partialize: (s) => ({ planned: s.planned, incomePlanned: s.incomePlanned }),
    },
  ),
);

/** Forget the budget ("Delete all my data"). */
export function clearBudget(): void {
  useBudgetStore.setState(initialBudgetData());
  void useBudgetStore.persist.clearStorage();
}
registerDataClearer(clearBudget);
