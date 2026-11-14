// The dashboard's own state. `checklistDismissed` is the person's and is kept in this browser (same
// safeStorage as the other stores). The rest is what no real store holds yet, kept as placeholders:
// - `duelStreak`: there is no Duel streak store (the Duel keeps only today's rounds, features/game/model/duelProgress.ts), so it is 0.
// - `planSuccessRate`: the Chance run is a fixture until MP7b (features/plan/model/useChanceOfSuccess.ts keeps
//   no result), so this is the Monte Carlo demo's rate. Replace both when those stores exist.
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Rate } from '@lifeguessr/types';
import { monteCarloDemo } from '@/fixtures';
import { registerDataClearer } from '@/lib/model/transactions';
import { safeStateStorage } from '@/lib/safeStorage';

export const DASHBOARD_STORE_KEY = 'lifeguessr.dashboard';

export type DashboardData = {
  /** Consecutive days with a finished Duel. Placeholder: nothing records it yet. */
  duelStreak: number;
  /** Success rate of the last Chance run (0..1); null = never run. Placeholder: monteCarlo.demo.json. */
  planSuccessRate: Rate | null;
  checklistDismissed: boolean;
};
export type DashboardActions = { update: (patch: Partial<DashboardData>) => void };

export const initialDashboardData = (): DashboardData => ({
  duelStreak: 0,
  planSuccessRate: monteCarloDemo.successRate,
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
