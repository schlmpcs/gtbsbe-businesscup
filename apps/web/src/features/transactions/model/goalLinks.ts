// Which ledger lines the person counted toward a savings goal (`allocate` on Goals). The Transactions
// store keeps a line's goal only when the line is made with one, so a later allocation is kept here,
// in this browser, next to the goals. A line's goal is its own `goalId` first, then its link.
// MP11b blocked: no `setGoal` on the Transactions store (lib/model/transactions.ts); when it has one
// this file can go.
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { registerDataClearer } from '@/lib/model/transactions';
import { safeStateStorage } from '@/lib/safeStorage';

export const GOAL_LINKS_KEY = 'lifeguessr.goalLinks';

export type GoalLinksData = { links: Record<string, string> };
export type GoalLinksActions = {
  link: (transactionId: string, goalId: string) => void;
  /** Frees every line counted toward a goal (the goal was removed). */
  unlinkGoal: (goalId: string) => void;
};

export const useGoalLinks = create<GoalLinksData & GoalLinksActions>()(
  persist(
    (set) => ({
      links: {},
      link: (transactionId, goalId) => set((s) => ({ links: { ...s.links, [transactionId]: goalId } })),
      unlinkGoal: (goalId) => set((s) => ({ links: Object.fromEntries(Object.entries(s.links).filter(([, g]) => g !== goalId)) })),
    }),
    { name: GOAL_LINKS_KEY, version: 1, storage: createJSONStorage(() => safeStateStorage), skipHydration: true, partialize: (s) => ({ links: s.links }) },
  ),
);

/** Forget every link ("Delete all my data"). */
export function clearGoalLinks(): void {
  useGoalLinks.setState({ links: {} });
  void useGoalLinks.persist.clearStorage();
}
registerDataClearer(clearGoalLinks);
