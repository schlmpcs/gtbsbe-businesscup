// A connected demo bank fills every screen, not only the plan: one read of its statement (the same
// T6/T7 pipeline as an uploaded CSV, so every number below comes from the statement or the engine) goes
//   - into the ledger (Transactions, and from it Cash Flow, Recurring and the Dashboard's spending),
//   - into the profile as measured spending and take-home pay (the Plan and its Chance of success),
//   - into Accounts: the checking account is named after the bank and takes the statement's own last
//     balance (when the file has a Balance column; otherwise the balance stays as it was),
//   - into Budget (created from that spending, only when there is no budget yet), and
//   - into Goals: one "Emergency fund (demo)" goal of three months of that spending over two years,
//     only when there are no goals yet. Nothing the person made is overwritten.
// Like any import, only masked labels, amounts, months and days leave the browser (CLAUDE.md rule 6).
import { COST_CATEGORIES, type CostCategory, type Money } from '@lifeguessr/types';
import { bankDemo as copy } from '@/copy';
import { useBudgetStore } from '@/features/budget/model/budgetStore';
import { useGoalsStore } from '@/features/goals/model/goalsStore';
import { ledger } from '@/features/transactions/model/transactionsStore';
import { readStatementFile as defaultReadStatementFile, type ReadStatementDeps } from '@/features/upload/model/readStatementFile';
import type { StatementFileResult } from '@/features/upload/model/types';
import { initAccounts, useAccountsStore } from '@/lib/model/accounts';
import type { ImportResult } from '@/lib/model/transactions';
import { getAnonId } from '@/state/anonId';
import { useAppStore } from '@/state/store';
import type { DemoBankId } from './banks';
import { latestBalance } from './preview';

/** The emergency-fund goal: this many months of spending, over this many years. */
export const DEMO_GOAL_MONTHS = 3;
export const DEMO_GOAL_YEARS = 2;

export type DemoFillDeps = {
  readStatementFile?: typeof defaultReadStatementFile;
};

export type DemoFillResult = { read: StatementFileResult; imported: ImportResult };

type Persisted = { persist: { hasHydrated: () => boolean; rehydrate: () => Promise<void> | void } };
/** Load a browser store's saved state before writing to it, so the load never overwrites the write. */
async function loaded(store: Persisted): Promise<void> {
  if (!store.persist.hasHydrated()) await store.persist.rehydrate();
}

const monthlySpending = (spending: Record<CostCategory, { value: Money }>) =>
  COST_CATEGORIES.reduce((sum, c) => sum + spending[c].value, 0);

/** Name the checking account after the bank and give it the statement's last balance (when it has one). */
function fillChecking(bankName: string, balance: number | null): void {
  initAccounts();
  const store = useAccountsStore.getState();
  const checking = store.accounts.find((a) => a.id === 'cash' && !a.excluded)
    ?? store.accounts.find((a) => a.group === 'cash' && !a.excluded);
  if (!checking) {
    if (balance !== null) store.addAccount({ group: 'cash', name: copy.fill.checkingName(bankName), balance: Math.max(0, balance) });
    return;
  }
  store.updateAccount(checking.id, { name: copy.fill.checkingName(bankName) });
  if (balance !== null) store.setBalance(checking.id, Math.max(0, balance));
}

/** Budget from the profile's (now measured) spending and take-home pay, when there is none yet. */
async function fillBudget(): Promise<void> {
  await loaded(useBudgetStore);
  if (useBudgetStore.getState().planned) return;
  const { profile } = useAppStore.getState();
  const planned = Object.fromEntries(COST_CATEGORIES.map((c) => [c, profile.spending[c].value])) as Record<CostCategory, Money>;
  useBudgetStore.getState().create(planned, profile.takeHomePay.value);
}

/** The emergency-fund goal, when there are no goals yet. */
async function fillGoal(): Promise<void> {
  await loaded(useGoalsStore);
  if (useGoalsStore.getState().goals.length > 0) return;
  const target = Math.round(DEMO_GOAL_MONTHS * monthlySpending(useAppStore.getState().profile.spending));
  if (target > 0) useGoalsStore.getState().addGoal({ name: copy.fill.goalName, target, years: DEMO_GOAL_YEARS });
}

/** Read the demo bank's statement once and fill every screen from it. Throws like an import. */
export async function fillFromDemoBank(
  file: File, bankId: DemoBankId, readDeps: ReadStatementDeps = {}, deps: DemoFillDeps = {},
): Promise<DemoFillResult> {
  const readFile = deps.readStatementFile ?? defaultReadStatementFile;
  const read = await readFile(file, { ...readDeps, anonId: readDeps.anonId ?? getAnonId() });
  const imported = await ledger().importRead(read);
  useAppStore.getState().applyStatementTotals(read.months);
  fillChecking(copy.banks[bankId], latestBalance(await file.text()));
  await Promise.all([fillBudget(), fillGoal()]);
  return { read, imported };
}

/** A statement reader (the CSV pipeline's signature) that also fills every screen: for /start's review. */
export const demoBankReader = (bankId: DemoBankId, deps: DemoFillDeps = {}) =>
  (file: File, readDeps: ReadStatementDeps = {}): Promise<StatementFileResult> =>
    fillFromDemoBank(file, bankId, readDeps, deps).then((r) => r.read);

/** An importer (the ledger import's signature) that also fills every screen: for /transactions. */
export const demoBankImporter = (bankId: DemoBankId, deps: DemoFillDeps = {}) =>
  (file: File): Promise<ImportResult> => fillFromDemoBank(file, bankId, {}, deps).then((r) => r.imported);
