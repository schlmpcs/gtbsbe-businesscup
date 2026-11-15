// @vitest-environment jsdom
import { accountsToProfile, profileToAccounts } from '@lifeguessr/engine';
import type { Profile } from '@lifeguessr/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cloneProfileDemo } from '@/fixtures';
import { stampProfile } from '@/state/profile';
import { useAppStore } from '@/state/store';
import { resetClientState } from '@/test/clientState';
import { ACCOUNTS_STORE_KEY, clearAccounts, initAccounts, useAccountsStore } from './accounts';
import { deleteAllMyData } from './transactions';
import { liabilityEstimates, newAccountForm } from './addAccount';

// Demo profile (profile.demo.json): cash $3,800 (measured), retirement $14,500 (estimate),
// card-1 $6,400 at 24.36% (min $193.92, estimate), auto-1 $17,800 at 7.4% (min $412).

/** Local clock at the middle of `month` (1-12) so `currentMonth()` is 'YYYY-MM'. */
function setMonth(year: number, month: number): void {
  vi.setSystemTime(new Date(year, month - 1, 15, 12));
}

const store = () => useAccountsStore.getState();
const account = (id: string) => store().accounts.find((a) => a.id === id)!;
const derivedFields = (p: Profile) => ({ cash: p.cash, retirement: p.retirement, debts: p.debts });

beforeEach(() => {
  clearAccounts();
  resetClientState();
  vi.useFakeTimers({ toFake: ['Date'] });
  setMonth(2026, 11);
});
afterEach(() => {
  clearAccounts();
  vi.useRealTimers();
});

describe('accounts store', () => {
  it('round trip: add, balance edits keep one history point per month (last wins), exclude, reload', () => {
    const id = store().addAccount({ group: 'cash', name: 'Savings', balance: 1200 })!;
    expect(account(id).balance).toEqual({ value: 1200, isEstimate: false });
    expect(account(id).history).toEqual([{ month: '2026-11', balance: 1200 }]);

    // A second edit in November replaces November's point.
    store().setBalance(id, 1500);
    expect(account(id).history).toEqual([{ month: '2026-11', balance: 1500 }]);

    // December adds its own point.
    setMonth(2026, 12);
    store().setBalance(id, 1700);
    expect(account(id).balance).toEqual({ value: 1700, isEstimate: false });
    expect(account(id).history).toEqual([
      { month: '2026-11', balance: 1500 },
      { month: '2026-12', balance: 1700 },
    ]);

    store().setExcluded(id, true);
    expect(account(id).excluded).toBe(true);

    // Saved in the browser; a new page load reads the same accounts back.
    const before = store().accounts;
    const saved = localStorage.getItem(ACCOUNTS_STORE_KEY)!;
    expect(JSON.parse(saved).accounts).toEqual(before);
    clearAccounts();
    localStorage.setItem(ACCOUNTS_STORE_KEY, saved);
    initAccounts();
    expect(store().accounts).toEqual(before);
  });

  it('re-derives the profile every screen reads with accountsToProfile when accounts change', () => {
    initAccounts();
    store().addAccount({ group: 'cash', name: 'Savings', balance: 1200 });
    // cash = 3,800 (Checking) + 1,200 = 5,000; both typed, so measured.
    expect(useAppStore.getState().profile.cash).toEqual({ value: 5000, isEstimate: false });

    store().addAccount({ group: 'investments', name: 'Brokerage', balance: 2000 });
    // retirement = 14,500 (Retirement, estimate) + 2,000 (investments) = 16,500, an estimate.
    expect(useAppStore.getState().profile.retirement).toEqual({ value: 16500, isEstimate: true });

    const cardId = store().addAccount({ group: 'creditCard', name: 'Store card', balance: 900 })!;
    // Default card APR 22.36%; min = max(25, 900 × 0.2236 / 12 + 1% × 900) = max(25, 16.77 + 9) = 25.77, an estimate.
    const card = useAppStore.getState().profile.debts.find((d) => d.id === cardId)!;
    expect(card.kind).toBe('card');
    expect(card.apr).toBe(0.2236);
    expect(card.minPayment.value).toBeCloseTo(25.77, 10);
    expect(card.minPayment.isEstimate).toBe(true);

    // The profile is exactly accountsToProfile(accounts, profile), and the edit made it the user's own.
    const { profile, profileOrigin } = useAppStore.getState();
    expect(derivedFields(profile)).toEqual(derivedFields(accountsToProfile(store().accounts, profile)));
    expect(profileOrigin).toBe('user');

    // Excluded accounts drop out: cash back to 3,800.
    const savings = store().accounts.find((a) => a.name === 'Savings')!;
    store().setExcluded(savings.id, true);
    expect(useAppStore.getState().profile.cash).toEqual({ value: 3800, isEstimate: false });
  });

  it('an empty store seeds from profileToAccounts(profile) and leaves the profile as it was', () => {
    const demo = cloneProfileDemo();
    initAccounts();
    expect(store().accounts).toEqual(profileToAccounts(stampProfile(demo, '2026-11')));
    expect(store().accounts.map((a) => [a.id, a.group, a.name, a.balance.value])).toEqual([
      ['cash', 'cash', 'Checking', 3800],
      ['retirement', 'retirement', 'Retirement', 14500],
      ['card-1', 'creditCard', 'Credit card', 6400],
      ['auto-1', 'loan', 'Auto loan', 17800],
    ]);
    expect(account('cash').history).toEqual([{ month: '2026-11', balance: 3800 }]);
    expect(JSON.parse(localStorage.getItem(ACCOUNTS_STORE_KEY)!).accounts).toEqual(store().accounts);
    expect(useAppStore.getState().profile).toEqual(demo);
    expect(useAppStore.getState().profileOrigin).toBe('demo');
  });

  it('a balance-sheet (S8) edit of the profile reaches the same accounts', () => {
    initAccounts();
    useAppStore.getState().setField('cash', 4500);
    expect(account('cash').balance).toEqual({ value: 4500, isEstimate: false });
    expect(account('cash').history).toEqual([{ month: '2026-11', balance: 4500 }]);

    const studentId = useAppStore.getState().addDebt({ kind: 'student', balance: 20000, apr: 0.0639, minPayment: 230 });
    expect(account(studentId)).toMatchObject({
      group: 'loan', debtKind: 'student', balance: { value: 20000, isEstimate: false }, apr: 0.0639,
      minPayment: { value: 230, isEstimate: false },
    });

    useAppStore.getState().removeDebt('auto-1');
    expect(store().accounts.some((a) => a.id === 'auto-1')).toBe(false);

    const { profile } = useAppStore.getState();
    expect(derivedFields(accountsToProfile(store().accounts, profile))).toEqual(derivedFields(profile));
  });
});

describe('growth and its AI note', () => {
  const note = { source: 'ai', reason: 'Luxury sedans lose about 12% a year after year 5.' } as const;

  it('stores an accepted AI estimate as growth plus a note; any later growth edit drops the note', () => {
    const id = store().addAccount({ group: 'vehicle', name: 'BMW 540i 2018', balance: 28_000 })!;
    expect(store().updateAccount(id, { growth: -0.12, growthNote: note })).toBe(true);
    expect(account(id)).toMatchObject({ growth: -0.12, growthNote: note });

    store().updateAccount(id, { growth: -0.1 }); // the person typed their own rate
    expect(account(id).growth).toBe(-0.1);
    expect(account(id).growthNote).toBeUndefined();

    store().updateAccount(id, { growth: -0.12, growthNote: note });
    store().updateAccount(id, { growth: null }); // back to the default
    expect(account(id).growth).toBeUndefined();
    expect(account(id).growthNote).toBeUndefined();
  });

  it('a name or balance edit keeps the note; a note without a rate is refused', () => {
    const id = store().addAccount({ group: 'vehicle', name: 'Car', balance: 9_000 })!;
    store().updateAccount(id, { growth: -0.12, growthNote: note });
    store().updateAccount(id, { name: 'Old car' });
    store().setBalance(id, 8_000);
    expect(account(id).growthNote).toEqual(note);

    const plain = store().addAccount({ group: 'vehicle', name: 'Bike', balance: 500 })!;
    store().updateAccount(plain, { growthNote: note });
    expect(account(plain).growthNote).toBeUndefined();
  });
});

describe('delete all my data', () => {
  it('deleteAllMyData() empties the accounts store', async () => {
    store().addAccount({ group: 'cash', name: 'Savings', balance: 1200 });
    expect(store().accounts.length).toBeGreaterThan(0);
    await deleteAllMyData();
    expect(store().accounts).toEqual([]);
    expect(store().ready).toBe(false);
    expect(localStorage.getItem(ACCOUNTS_STORE_KEY)).toBeNull();
  });
});

describe('add-account form', () => {
  it('prefills a liability’s APR and minimum as estimates from the engine defaults', () => {
    // Card: APR 22.36%; min = max(25, 2,000 × 0.2236 / 12 + 1% × 2,000) = 37.2667 + 20 = 57.2667.
    const card = liabilityEstimates('creditCard', 2000);
    expect(card.apr).toEqual({ value: 0.2236, isEstimate: true });
    expect(card.minPayment.value).toBeCloseTo(57.2667, 4);
    expect(card.minPayment.isEstimate).toBe(true);

    // Personal loan: APR 11.9%, 24 months; r = 0.0099167, payment = 10,000 × 0.0099167 / (1 − 1.0099167^−24) = 470.27.
    const loan = liabilityEstimates('loan', 10000, { debtKind: 'personal' });
    expect(loan.apr).toEqual({ value: 0.119, isEstimate: true });
    expect(loan.minPayment.value).toBeCloseTo(470.27, 2);
    expect(loan.minPayment.isEstimate).toBe(true);

    const form = newAccountForm('creditCard');
    expect(form).toMatchObject({ group: 'creditCard', name: 'Credit card', balance: 0 });
    expect(form.apr).toEqual({ value: 0.2236, isEstimate: true });
    expect(form.minPayment?.isEstimate).toBe(true);
    expect(newAccountForm('cash')).toEqual({ group: 'cash', name: 'Cash', balance: 0 });
  });
});
