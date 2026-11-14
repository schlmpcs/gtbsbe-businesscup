// The ledger the planner screens read, held in memory and seeded from the demo fixture.
// MP11b: replace with the real transactions store (MP9/MP10); hooks read it through selectors only.
import { create } from 'zustand';
import { merchantKey } from '@lifeguessr/engine';
import type { LedgerTransaction, StatementClass } from '@lifeguessr/types';
import { transactionsDemo } from '@/fixtures';

export type TransactionsFixtureData = {
  transactions: LedgerTransaction[];
  /** Counter for ids of lines made here (`tx-new-1`, ...). */
  nextId: number;
};
export type TransactionsFixtureActions = {
  /** Adds a line (its id is made here) and returns the id. */
  addTransaction: (t: Omit<LedgerTransaction, 'id'>) => string;
  /** Adds imported lines whose ids are not there yet; returns how many were added. */
  addMany: (lines: readonly LedgerTransaction[]) => number;
  setCategory: (id: string, category: StatementClass, applyAll: boolean) => void;
  setGoal: (id: string, goalId: string | null) => void;
  /** Unlinks every line from a goal (when the goal is removed). */
  clearGoal: (goalId: string) => void;
  removeAccountLinks: (accountId: string) => void;
};

export const initialTransactionsData = (): TransactionsFixtureData => ({ transactions: transactionsDemo.map((t) => ({ ...t })), nextId: 1 });

export const useTransactionsStore = create<TransactionsFixtureData & TransactionsFixtureActions>()((set, get) => ({
  ...initialTransactionsData(),
  addTransaction: (t) => {
    const id = `tx-new-${get().nextId}`;
    set((s) => ({ transactions: [...s.transactions, { ...t, id }], nextId: s.nextId + 1 }));
    return id;
  },
  addMany: (lines) => {
    const have = new Set(get().transactions.map((t) => t.id));
    const fresh = lines.filter((l) => !have.has(l.id)).map((l) => ({ ...l }));
    if (fresh.length > 0) set((s) => ({ transactions: [...s.transactions, ...fresh] }));
    return fresh.length;
  },
  setCategory: (id, category, applyAll) =>
    set((s) => {
      const target = s.transactions.find((t) => t.id === id);
      if (!target) return s;
      const key = merchantKey(target.label);
      return {
        transactions: s.transactions.map((t) =>
          t.id === id || (applyAll && merchantKey(t.label) === key) ? { ...t, cls: category, categoryOverridden: true } : t,
        ),
      };
    }),
  setGoal: (id, goalId) =>
    set((s) => ({
      transactions: s.transactions.map((t) => {
        if (t.id !== id) return t;
        const { goalId: _old, ...rest } = t;
        return goalId === null ? rest : { ...rest, goalId };
      }),
    })),
  clearGoal: (goalId) =>
    set((s) => ({
      transactions: s.transactions.map((t) => {
        if (t.goalId !== goalId) return t;
        const { goalId: _old, ...rest } = t;
        return rest;
      }),
    })),
  removeAccountLinks: (accountId) =>
    set((s) => ({
      transactions: s.transactions.map((t) => {
        if (t.accountId !== accountId) return t;
        const { accountId: _old, ...rest } = t;
        return rest;
      }),
    })),
}));

/** Back to the demo ledger (tests). */
export function resetTransactionsStore(): void {
  useTransactionsStore.setState(initialTransactionsData());
}
