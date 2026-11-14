// Items the person marked "not recurring", kept in this browser (same safeStorage as the other stores).
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { registerDataClearer } from '@/lib/model/transactions';
import { safeStateStorage } from '@/lib/safeStorage';

export const RECURRING_STORE_KEY = 'lifeguessr.recurring';

export type RecurringData = { notRecurring: string[] };
export type RecurringActions = { markNotRecurring: (id: string) => void };

export const useRecurringStore = create<RecurringData & RecurringActions>()(
  persist(
    (set) => ({
      notRecurring: [],
      markNotRecurring: (id) => set((s) => (s.notRecurring.includes(id) ? s : { notRecurring: [...s.notRecurring, id] })),
    }),
    {
      name: RECURRING_STORE_KEY,
      version: 1,
      storage: createJSONStorage(() => safeStateStorage),
      skipHydration: true,
      // Saved ids read back one by one: anything that is not a string is dropped.
      merge: (saved, current) => {
        const ids = (saved as Partial<RecurringData> | undefined)?.notRecurring;
        return Array.isArray(ids) ? { ...current, notRecurring: ids.filter((i): i is string => typeof i === 'string') } : current;
      },
      partialize: (s) => ({ notRecurring: s.notRecurring }),
    },
  ),
);

/** Forget what was hidden ("Delete all my data"). */
export function clearRecurring(): void {
  useRecurringStore.setState({ notRecurring: [] });
  void useRecurringStore.persist.clearStorage();
}
registerDataClearer(clearRecurring);
