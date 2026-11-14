// The person's savings goals, kept in this browser (same safeStorage as the other stores). Names are
// what a person would type, so they never leave the browser. Starts empty.
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { GoalSchema, type Goal } from '@lifeguessr/types';
import { registerDataClearer } from '@/lib/model/transactions';
import { safeStateStorage } from '@/lib/safeStorage';

export const GOALS_STORE_KEY = 'lifeguessr.goals';

export type StoredGoal = Goal & { id: string; name: string };

export type GoalsData = { goals: StoredGoal[]; nextId: number };
export type GoalsActions = {
  addGoal: (goal: Goal & { name: string }) => string;
  removeGoal: (id: string) => void;
};

export const initialGoalsData = (): GoalsData => ({ goals: [], nextId: 1 });

export const useGoalsStore = create<GoalsData & GoalsActions>()(
  persist(
    (set, get) => ({
      ...initialGoalsData(),
      addGoal: (goal) => {
        const id = `goal-${get().nextId}`;
        set((s) => ({ goals: [...s.goals, { ...goal, id }], nextId: s.nextId + 1 }));
        return id;
      },
      removeGoal: (id) => set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),
    }),
    {
      name: GOALS_STORE_KEY,
      version: 1,
      storage: createJSONStorage(() => safeStateStorage),
      skipHydration: true,
      // Saved goals read back one by one: a broken one is dropped, the rest are kept.
      merge: (saved, current) => {
        const data = saved as Partial<GoalsData> | undefined;
        if (!data || !Array.isArray(data.goals)) return current;
        const goals = data.goals.flatMap((g): StoredGoal[] => {
          const parsed = GoalSchema.safeParse(g);
          const { id, name } = (g ?? {}) as { id?: unknown; name?: unknown };
          return parsed.success && typeof id === 'string' && typeof name === 'string' ? [{ ...parsed.data, id, name }] : [];
        });
        const nextId = typeof data.nextId === 'number' && Number.isInteger(data.nextId) && data.nextId > 0 ? data.nextId : goals.length + 1;
        return { ...current, goals, nextId };
      },
      partialize: (s) => ({ goals: s.goals, nextId: s.nextId }),
    },
  ),
);

/** Forget every goal ("Delete all my data"). */
export function clearGoals(): void {
  useGoalsStore.setState(initialGoalsData());
  void useGoalsStore.persist.clearStorage();
}
registerDataClearer(clearGoals);
