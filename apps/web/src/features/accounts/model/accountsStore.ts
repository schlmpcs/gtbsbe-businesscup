// The accounts the planner screens read, held in memory and seeded from the demo fixture.
// MP11b: replace with the real accounts store (MP8); `useAccountsStore` is read through selectors only
// in hooks, so swapping the source changes this file and nothing in the screens.
import { create } from 'zustand';
import type { Account } from '@lifeguessr/types';
import { accountsDemo } from '@/fixtures';

export type AccountsFixtureData = {
  accounts: Account[];
  /** The add-account flow is open. */
  adding: boolean;
  /** Counter for ids of accounts made here (`account-1`, ...): no clock, no randomness. */
  nextId: number;
};
export type AccountsFixtureActions = {
  setAdding: (adding: boolean) => void;
  /** Adds an account (its id is made here) and returns the id. */
  addAccount: (account: Omit<Account, 'id'>) => string;
  updateAccount: (id: string, update: (account: Account) => Account) => void;
  removeAccount: (id: string) => void;
};

export const initialAccountsData = (): AccountsFixtureData => ({ accounts: accountsDemo.map((a) => ({ ...a })), adding: false, nextId: 1 });

export const useAccountsStore = create<AccountsFixtureData & AccountsFixtureActions>()((set, get) => ({
  ...initialAccountsData(),
  setAdding: (adding) => set({ adding }),
  addAccount: (account) => {
    const id = `account-${get().nextId}`;
    set((s) => ({ accounts: [...s.accounts, { ...account, id }], nextId: s.nextId + 1 }));
    return id;
  },
  updateAccount: (id, update) => set((s) => ({ accounts: s.accounts.map((a) => (a.id === id ? update(a) : a)) })),
  removeAccount: (id) => set((s) => ({ accounts: s.accounts.filter((a) => a.id !== id) })),
}));

/** Back to the demo accounts (tests). */
export function resetAccountsStore(): void {
  useAccountsStore.setState(initialAccountsData());
}
