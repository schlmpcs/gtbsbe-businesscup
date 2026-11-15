// The dashboard's own state. `checklistDismissed` is the person's and is kept in this browser (same
// safeStorage as the other stores). `duelStreak` is a placeholder: there is no Duel streak store (the
// Duel keeps only today's rounds, features/game/model/duelProgress.ts), so it is 0 and the UI does not
// show it. The plan card's Chance of success is not kept here: it is /plan's own Monte Carlo run
// (features/plan/model/useChanceOfSuccess.ts, kept in the plan store), see ./useDashboard.ts.
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { registerDataClearer } from '@/lib/model/transactions';
import { safeStateStorage } from '@/lib/safeStorage';

export const DASHBOARD_STORE_KEY = 'lifeguessr.dashboard';

export type DashboardData = {
  /** Consecutive days with a finished Duel. Placeholder: nothing records it yet. */
  duelStreak: number;
  checklistDismissed: boolean;
};
export type DashboardActions = { update: (patch: Partial<DashboardData>) => void };

export const initialDashboardData = (): DashboardData => ({
  duelStreak: 0,
  checklistDismissed: false,
});

export const useDashboardStore = create<DashboardData & DashboardActions>()(
  persist(
    (set) => ({
      ...initialDashboardData(),
      update: (patch) => set(patch),
    }),
    {
      name: DASHBOARD_STORE_KEY,
      version: 1,
      storage: createJSONStorage(() => safeStateStorage),
      skipHydration: true,
      merge: (saved, current) => ({ ...current, checklistDismissed: (saved as Partial<DashboardData> | undefined)?.checklistDismissed === true }),
      partialize: (s) => ({ checklistDismissed: s.checklistDismissed }),
    },
  ),
);

/** Show the checklist again ("Delete all my data"). */
export function clearDashboard(): void {
  useDashboardStore.setState({ checklistDismissed: false });
  void useDashboardStore.persist.clearStorage();
}
registerDataClearer(clearDashboard);
