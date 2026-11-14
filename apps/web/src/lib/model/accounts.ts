// The Accounts store (MP8, #168; P2): the person's accounts, kept in this browser only.
//
// - Accounts live in localStorage through the same `safeStorage` as the profile, under their own key.
//   Account names are personal (CLAUDE.md rule 6): they are never sent to the server. The profile
//   derived from them (balances and debts, no names) is what a session save and the forecast carry.
// - Every balance edit sets the account's history point for this month (one per month, last edit wins).
// - One source of truth: when accounts change, the profile every other screen reads is re-derived with
//   the engine's `accountsToProfile` and stored through the app store's `setProfile`.
// - The other way round: the balance sheet (S8) and other profile edits change cash, retirement and
//   debts on the profile directly. `reconcileAccounts` carries such a change into the same accounts
//   (the cash difference goes to the first cash account, the retirement difference to the first
//   retirement account, debts match accounts by id), so neither side overwrites the other.
// - An empty store starts from `profileToAccounts(profile)`, so nobody opens an empty Accounts page.
// - `clearAccounts` is registered with "Delete all my data" (MP10).
import { accountsToProfile, profileToAccounts } from '@lifeguessr/engine';
import {
  AccountSchema,
  type Account, type AccountGroup, type Debt, type Estimate, type Money, type Profile, type Rate, type YearMonth,
} from '@lifeguessr/types';
import { useEffect } from 'react';
import { create } from 'zustand';
import { readStorage, removeStorage, writeStorage } from '@/lib/safeStorage';
import { useHydrated } from '@/state/hydration';
import { currentMonth, stampProfile } from '@/state/profile';
import { useAppStore } from '@/state/store';
import { accountFromForm, isLiabilityGroup, type AccountForm, type LoanKind } from './addAccount';
import { registerDataClearer } from './transactions';

export const ACCOUNTS_STORE_KEY = 'lifeguessr.accounts';
const STORAGE_VERSION = 1;

// ----- Pure helpers ------------------------------------------------------------------------------

/** `history` with `month`'s point set to `balance` (replacing an earlier edit that month), oldest first. */
export function withHistoryPoint(history: Account['history'], month: YearMonth, balance: Money): Account['history'] {
  return [...history.filter((h) => h.month !== month), { month, balance }].sort((a, b) => a.month.localeCompare(b.month));
}

/** The account with a new balance and this month's history point; the same object when nothing changes. */
function withBalance(a: Account, balance: Estimate<Money>, month: YearMonth): Account {
  if (a.balance.value === balance.value && a.balance.isEstimate === balance.isEstimate) return a;
  const history = a.balance.value === balance.value ? a.history : withHistoryPoint(a.history, month, balance.value);
  return { ...a, balance: { ...balance }, history };
}

/** The first `${prefix}-n` id no account uses. */
function freeId(accounts: readonly Account[], prefix: string): string {
  const used = new Set(accounts.map((a) => a.id));
  for (let n = 1; ; n++) if (!used.has(`${prefix}-${n}`)) return `${prefix}-${n}`;
}

/** The accounts an empty store starts with: `profileToAccounts`, history dated `month`. */
export function seedAccounts(profile: Profile, month: YearMonth): Account[] {
  return profileToAccounts(stampProfile(profile, month));
}

const debtKey = (d: Debt) => [d.id, d.kind, d.balance, d.apr, d.minPayment.value, d.minPayment.isEstimate, d.extraPayment ?? 0];
const sameEstimate = (a: Estimate<number>, b: Estimate<number>) => a.value === b.value && a.isEstimate === b.isEstimate;

/** Whether two profiles agree on everything accounts decide: cash, retirement and debts (any order). */
export function sameAccountFields(a: Profile, b: Profile): boolean {
  if (!sameEstimate(a.cash, b.cash) || !sameEstimate(a.retirement, b.retirement)) return false;
  if (a.debts.length !== b.debts.length) return false;
  const keys = (p: Profile) => p.debts.map((d) => JSON.stringify(debtKey(d))).sort();
  return JSON.stringify(keys(a)) === JSON.stringify(keys(b));
}

/**
 * Carry a profile total (cash, or retirement + investments) into the accounts: the difference goes to
 * the first included account of `groups[0]` (else of the other groups), never below $0, and every
 * included account of the groups takes the profile's estimate flag. With no such account and a
 * positive total, the seed account for it is added.
 */
function reconcileTotal(
  accounts: Account[], groups: readonly AccountGroup[], target: Estimate<Money>, current: Estimate<Money>,
  seed: Account, month: YearMonth,
): Account[] {
  if (sameEstimate(target, current)) return accounts;
  const inPool = (a: Account) => !a.excluded && groups.includes(a.group);
  const primary = accounts.find((a) => inPool(a) && a.group === groups[0]) ?? accounts.find(inPool);
  if (!primary) {
    if (target.value <= 0) return accounts;
    const id = accounts.some((a) => a.id === seed.id) ? freeId(accounts, seed.group) : seed.id;
    return [...accounts, { ...seed, id }];
  }
  const balance = Math.max(0, primary.balance.value + target.value - current.value);
  return accounts.map((a) => {
    if (!inPool(a)) return a;
    return withBalance(a, { value: a === primary ? balance : a.balance.value, isEstimate: target.isEstimate }, month);
  });
}

/** The debt the profile would get from this one account (same engine call as the whole profile). */
const debtOf = (a: Account, profile: Profile): Debt => accountsToProfile([a], profile).debts[0]!;

/**
 * Carry the profile's debts into the liability accounts, matched by id: a changed debt updates its
 * account (name and history kept), a new debt adds an account, an included liability account without
 * a debt is removed. An excluded account whose id a new debt takes gets a new id.
 */
function reconcileDebts(accounts: Account[], profile: Profile, month: YearMonth): Account[] {
  const debtIds = new Set(profile.debts.map((d) => d.id));
  let next = accounts.filter((a) => a.excluded || !isLiabilityGroup(a.group) || debtIds.has(a.id));
  for (const d of profile.debts) {
    const mapped = profileToAccounts(stampProfile({ ...profile, debts: [d] }, month)).at(-1)!;
    const existing = next.find((a) => a.id === d.id && !a.excluded && isLiabilityGroup(a.group));
    if (!existing) {
      next = next.map((a) => (a.id === d.id ? { ...a, id: freeId(next, a.group) } : a));
      next.push(mapped);
      continue;
    }
    // Extra payments live on the profile only (accountsToProfile keeps them), so they are not compared.
    const core = (x: Debt) => JSON.stringify(debtKey({ ...x, extraPayment: 0 }));
    if (core(debtOf(existing, profile)) === core(d)) continue;
    const updated: Account = { ...existing, group: mapped.group, apr: d.apr, minPayment: { ...d.minPayment } };
    if (mapped.debtKind) updated.debtKind = mapped.debtKind;
    else delete updated.debtKind;
    const withNewBalance = withBalance(updated, { value: d.balance, isEstimate: false }, month);
    next = next.map((a) => (a === existing ? withNewBalance : a));
  }
  return next;
}

/**
 * The accounts brought in line with a profile that was edited elsewhere (S8, a confirmed patch, a
 * restored session, a life card). The same array when the accounts already give this profile.
 */
export function reconcileAccounts(accounts: Account[], profile: Profile, month: YearMonth): Account[] {
  const derived = accountsToProfile(accounts, profile);
  if (sameAccountFields(derived, profile)) return accounts;
  const seeds = seedAccounts(profile, month);
  let next = reconcileTotal(accounts, ['cash'], profile.cash, derived.cash, seeds[0]!, month);
  next = reconcileTotal(next, ['retirement', 'investments'], profile.retirement, derived.retirement, seeds[1]!, month);
  next = reconcileDebts(next, profile, month);
  const unchanged = next.length === accounts.length && next.every((a, i) => a === accounts[i]);
  return unchanged ? accounts : next;
}

// ----- Storage ---------------------------------------------------------------------------------

/** Saved accounts, each checked against the contract; broken entries and repeated ids are dropped. */
function loadAccounts(): Account[] {
  let saved: unknown;
  try {
    saved = JSON.parse(readStorage(ACCOUNTS_STORE_KEY) ?? 'null');
  } catch {
    return []; // not JSON
  }
  const list = saved && typeof saved === 'object' ? (saved as { accounts?: unknown }).accounts : undefined;
  if (!Array.isArray(list)) return [];
  const out: Account[] = [];
  for (const item of list) {
    const parsed = AccountSchema.safeParse(item);
    if (parsed.success && !out.some((a) => a.id === parsed.data.id)) out.push(parsed.data as Account);
  }
  return out;
}

function saveAccounts(accounts: Account[]): void {
  writeStorage(ACCOUNTS_STORE_KEY, JSON.stringify({ version: STORAGE_VERSION, accounts }));
}

// ----- Store -----------------------------------------------------------------------------------

/** Account fields an edit can change; `null` removes the field (back to the engine default). */
export type AccountChanges = {
  name?: string;
  apr?: Rate | null;
  /** Monthly; a typed minimum is measured. */
  minPayment?: Money | null;
  debtKind?: LoanKind;
  growth?: Rate | null;
};

export type AccountsData = {
  accounts: Account[];
  /** False until `initAccounts` has loaded (or seeded) them in this page load. */
  ready: boolean;
};

export type AccountsActions = {
  /** Add an account from the form; returns its id, or null when the form is not a valid account. */
  addAccount: (form: AccountForm) => string | null;
  /** A typed balance (measured), with this month's history point. */
  setBalance: (id: string, balance: Money) => boolean;
  updateAccount: (id: string, changes: AccountChanges) => boolean;
  /** Leave the account out of net worth, the profile and the plan (or bring it back). */
  setExcluded: (id: string, excluded: boolean) => boolean;
  removeAccount: (id: string) => void;
};

export type AccountsState = AccountsData & AccountsActions;

let stopProfileSync: (() => void) | null = null;
let writingProfile = false;

/** Store `next` and re-derive the profile from it (only when that changes the profile). */
function commit(next: Account[]): void {
  useAccountsStore.setState({ accounts: next });
  saveAccounts(next);
  const { profile, setProfile } = useAppStore.getState();
  const derived = accountsToProfile(next, profile);
  if (sameAccountFields(derived, profile)) return;
  writingProfile = true;
  try {
    setProfile(derived, 'user');
  } finally {
    writingProfile = false;
  }
}

/** Apply `edit` to one account; false (nothing stored) for an unknown id or an invalid result. */
function editAccount(id: string, edit: (a: Account) => Account): boolean {
  initAccounts();
  const current = useAccountsStore.getState().accounts;
  const target = current.find((a) => a.id === id);
  if (!target) return false;
  const edited = edit(target);
  if (edited === target) return true;
  if (!AccountSchema.safeParse(edited).success) return false;
  commit(current.map((a) => (a === target ? edited : a)));
  return true;
}

export const useAccountsStore = create<AccountsState>()(() => ({
  accounts: [],
  ready: false,

  addAccount: (form) => {
    initAccounts();
    const current = useAccountsStore.getState().accounts;
    const account = accountFromForm(form, freeId(current, form.group), currentMonth());
    if (!AccountSchema.safeParse(account).success) return null;
    commit([...current, account]);
    return account.id;
  },
  setBalance: (id, balance) => editAccount(id, (a) => withBalance(a, { value: balance, isEstimate: false }, currentMonth())),
  updateAccount: (id, changes) =>
    editAccount(id, (a) => {
      const next: Account = { ...a };
      if (changes.name !== undefined) next.name = changes.name.trim();
      if (changes.debtKind !== undefined) next.debtKind = changes.debtKind;
      if (changes.apr === null) delete next.apr;
      else if (changes.apr !== undefined) next.apr = changes.apr;
      if (changes.minPayment === null) delete next.minPayment;
      else if (changes.minPayment !== undefined) next.minPayment = { value: changes.minPayment, isEstimate: false };
      if (changes.growth === null) delete next.growth;
      else if (changes.growth !== undefined) next.growth = changes.growth;
      return next;
    }),
  setExcluded: (id, excluded) =>
    editAccount(id, (a) => {
      if (Boolean(a.excluded) === excluded) return a;
      const next: Account = { ...a };
      if (excluded) next.excluded = true;
      else delete next.excluded;
      return next;
    }),
  removeAccount: (id) => {
    initAccounts();
    const current = useAccountsStore.getState().accounts;
    if (current.some((a) => a.id === id)) commit(current.filter((a) => a.id !== id));
  },
}));

/**
 * Load the saved accounts (or seed them from the profile when there are none), bring them in line
 * with the current profile, and follow later profile edits. Idempotent; run on the client once the
 * app store is loaded (`useAccountsReady` does that). Actions call it too.
 */
export function initAccounts(): void {
  if (stopProfileSync) return;
  const { profile } = useAppStore.getState();
  const month = currentMonth();
  const saved = loadAccounts();
  const accounts = saved.length > 0 ? reconcileAccounts(saved, profile, month) : seedAccounts(profile, month);
  useAccountsStore.setState({ accounts, ready: true });
  saveAccounts(accounts);
  stopProfileSync = useAppStore.subscribe((s, prev) => {
    if (writingProfile || s.profile === prev.profile) return;
    const current = useAccountsStore.getState().accounts;
    const next = reconcileAccounts(current, s.profile, currentMonth());
    if (next === current) return;
    useAccountsStore.setState({ accounts: next });
    saveAccounts(next);
  });
}

/**
 * "Delete all my data": forget every account in this browser. The profile is left as it is (the app
 * store's own reset handles it); the next `initAccounts` seeds from whatever profile there is then.
 */
export function clearAccounts(): void {
  stopProfileSync?.();
  stopProfileSync = null;
  removeStorage(ACCOUNTS_STORE_KEY);
  useAccountsStore.setState({ accounts: [], ready: false });
}

registerDataClearer(clearAccounts);

/** True once the app store and the accounts are loaded (always false on the server). */
export function useAccountsReady(): boolean {
  const hydrated = useHydrated();
  const ready = useAccountsStore((s) => s.ready);
  useEffect(() => {
    if (hydrated && !ready) initAccounts();
  }, [hydrated, ready]);
  return hydrated && ready;
}
