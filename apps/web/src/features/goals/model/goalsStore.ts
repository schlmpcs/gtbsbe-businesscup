// The savings goals, held in memory and seeded with two demo goals (names are what a person would type).
// MP11b: replace with the real goals store; hooks read it through selectors only.
import { create } from 'zustand';
import type { Goal } from '@lifeguessr/types';

export type StoredGoal = Goal & { id: string; name: string };

export type GoalsFixtureData = { goals: StoredGoal[]; nextId: number };
export type GoalsFixtureActions = {
  addGoal: (goal: Goal & { name: string }) => string;
  removeGoal: (id: string) => void;
};

export const initialGoalsData = (): GoalsFixtureData => ({
  goals: [
    { id: 'goal-1', name: 'Emergency fund', target: 15_000, years: 3 },
    { id: 'goal-2', name: 'House deposit', target: 60_000, years: 10 },
  ],
  nextId: 3,
});

export const useGoalsStore = create<GoalsFixtureData & GoalsFixtureActions>()((set, get) => ({
  ...initialGoalsData(),
  addGoal: (goal) => {
    const id = `goal-${get().nextId}`;
    set((s) => ({ goals: [...s.goals, { ...goal, id }], nextId: s.nextId + 1 }));
    return id;
  },
  removeGoal: (id) => set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),
}));

/** Back to the demo goals (tests). */
export function resetGoalsStore(): void {
  useGoalsStore.setState(initialGoalsData());
}
