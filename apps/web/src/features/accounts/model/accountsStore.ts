// The accounts are the real store (MP8, lib/model/accounts.ts: `useAccountsStore`, `useAccountsReady`).
// What is kept here is screen state it does not hold: whether the add-account flow is open.
import { create } from 'zustand';

export type AccountsUiData = { adding: boolean };
export type AccountsUiActions = { setAdding: (adding: boolean) => void };

export const useAccountsUiStore = create<AccountsUiData & AccountsUiActions>()((set) => ({
  adding: false,
  setAdding: (adding) => set({ adding }),
}));
