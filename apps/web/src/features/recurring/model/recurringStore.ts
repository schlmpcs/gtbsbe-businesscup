// Items the person marked "not recurring", held in memory.
// MP11b: persist with the rest of the planner state (MP9/MP10).
import { create } from 'zustand';

export type RecurringFixtureData = { notRecurring: string[] };
export type RecurringFixtureActions = { markNotRecurring: (id: string) => void };

export const useRecurringStore = create<RecurringFixtureData & RecurringFixtureActions>()((set) => ({
  notRecurring: [],
  markNotRecurring: (id) => set((s) => (s.notRecurring.includes(id) ? s : { notRecurring: [...s.notRecurring, id] })),
}));

/** Back to nothing hidden (tests). */
export function resetRecurringStore(): void {
  useRecurringStore.setState({ notRecurring: [] });
}
