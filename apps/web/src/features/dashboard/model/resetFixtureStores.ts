// Seeds every store the planner screens read with the MP2 demo fixtures, for hook tests (not used by the
// app): the accounts (accounts.demo.json) and the ledger (transactions.demo.json) go through the real
// stores, on the browser-less fallbacks (localStorage in jsdom, a memory record store for the ledger).
// The budget, goals, hidden items and the checklist start empty; the Duel streak is the dashboard's
// placeholder; the plan has scenarios without events and no Chance run yet. Awaited by `beforeEach`.
import { accountsDemo, transactionsDemo } from '@/fixtures';
import { clearAccounts, ACCOUNTS_STORE_KEY, initAccounts } from '@/lib/model/accounts';
import { memoryRecordStore } from '@/lib/model/idb';
import { createTransactionStore } from '@/lib/model/transactions';
import { writeStorage } from '@/lib/safeStorage';
import { startHydration } from '@/state/hydration';
import { useGameStore } from '@/state/game';
import { useAppStore } from '@/state/store';
import { useAccountsUiStore } from '@/features/accounts/model/accountsStore';
import { initialBudgetData, useBudgetStore } from '@/features/budget/model/budgetStore';
import { initialGoalsData, useGoalsStore } from '@/features/goals/model/goalsStore';
import { initialPlanData, usePlanStore } from '@/features/plan/model/planStore';
import { useRecurringStore } from '@/features/recurring/model/recurringStore';
import { useGoalLinks } from '@/features/transactions/model/goalLinks';
import { markLedgerLoaded, setLedgerStore } from '@/features/transactions/model/transactionsStore';
import { resetClientState } from '@/test/clientState';
import { initialDashboardData, useDashboardStore } from './dashboardStore';

/** The moment the fixtures are set at: 15 November 2026, noon local time. Tests fake `Date` with it so the stores date new balances in 2026-11. */
export const FIXTURE_NOW = new Date(2026, 10, 15, 12);

export async function resetFixtureStores(): Promise<void> {
  resetClientState();
  startHydration();
  await Promise.all([useAppStore.persist.rehydrate(), useGameStore.persist.rehydrate()]);

  // Accounts: the fixture list, saved the way the store saves it, then loaded by the store.
  clearAccounts();
  writeStorage(ACCOUNTS_STORE_KEY, JSON.stringify({ version: 1, accounts: accountsDemo }));
  initAccounts();
  useAccountsUiStore.setState({ adding: false });

  // The ledger: a Transactions store over a memory record store holding the fixture lines.
  const store = createTransactionStore({ db: memoryRecordStore(transactionsDemo) });
  setLedgerStore(store);
  await store.load();
  markLedgerLoaded(store);

  // The small browser-only stores: empty, and loaded (nothing is saved).
  useBudgetStore.setState(initialBudgetData());
  useGoalsStore.setState(initialGoalsData());
  useGoalLinks.setState({ links: {} });
  useRecurringStore.setState({ notRecurring: [] });
  useDashboardStore.setState({ ...initialDashboardData(), duelStreak: 3 });
  await Promise.all([useBudgetStore, useGoalsStore, useGoalLinks, useRecurringStore, useDashboardStore].map((s) => s.persist.rehydrate()));

  // Plan: the fixture scenarios, none with an event yet.
  const plan = initialPlanData();
  usePlanStore.setState({ ...plan, scenarios: plan.scenarios.map((s) => ({ ...s, events: [] })) });
}
