// The dashboard's own state: the setup flags that no other store holds yet, today's Duel, the last
// Chance run and whether the checklist was dismissed. Held in memory.
// MP11b: read these from the real stores instead (game store for the Duel, the plan store for events
// and the Chance run, ladder progress for "guessed own month"); keep only `checklistDismissed` here.
import { create } from 'zustand';
import type { Rate } from '@lifeguessr/types';
import { monteCarloDemo } from '@/fixtures';

export type DashboardFixtureData = {
  duel: { playedToday: boolean; streak: number };
  guessedOwnMonth: boolean;
  createdPlanEvent: boolean;
  /** Success rate of the last Chance run (0..1); null = never run. Placeholder: monteCarlo.demo.json. */
  planSuccessRate: Rate | null;
  checklistDismissed: boolean;
};
export type DashboardFixtureActions = { update: (patch: Partial<DashboardFixtureData>) => void };

export const initialDashboardData = (): DashboardFixtureData => ({
  duel: { playedToday: false, streak: 3 },
  guessedOwnMonth: false,
  createdPlanEvent: false,
  planSuccessRate: monteCarloDemo.successRate,
  checklistDismissed: false,
});

export const useDashboardStore = create<DashboardFixtureData & DashboardFixtureActions>()((set) => ({
  ...initialDashboardData(),
  update: (patch) => set(patch),
}));

/** Back to the demo state (tests). */
export function resetDashboardStore(): void {
  useDashboardStore.setState(initialDashboardData());
}
