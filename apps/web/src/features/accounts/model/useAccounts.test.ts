// @vitest-environment jsdom
// Accounts, Account detail and Add account on the fixtures (accounts.demo.json). No network.
import { act, renderHook } from '@testing-library/react';
import { cardMinPaymentFor } from '@lifeguessr/engine';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetFixtureStores } from '@/features/dashboard/model/resetFixtureStores';
import { useAccountsStore } from './accountsStore';
import { useAccount } from './useAccount';
import { useAccounts } from './useAccounts';
import { useAddAccount } from './useAddAccount';

const TODAY = '2026-11-15';
beforeEach(resetFixtureStores);

describe('useAccounts', () => {
  it('renders the demo balance sheet', () => {
    const { result } = renderHook(() => useAccounts({ today: TODAY }));
    const vm = result.current;
    expect(vm.ready).toBe(true);
    expect(vm.isEmpty).toBe(false);
    // Assets that count: checking 1300 + savings 2500 + 401(k) 14500 = 18300 (the car is excluded).
    // Liabilities: card 6400 + auto loan 17800 = 24200. Net worth = 18300 - 24200 = -5900.
    expect(vm.netWorth).toBe(-5900);
    expect(vm.summary.assets.total).toBe(18300);
    expect(vm.summary.liabilities.total).toBe(24200);
    // Share of assets + liabilities (42500): 18300 / 42500.
    expect(vm.summary.assets.share).toBeCloseTo(18300 / 42500, 10);
    expect(vm.summary.assets.segments.map((s) => s.group)).toEqual(['retirement', 'cash']);
    // 1-month change, like for like (the 401(k) has no October balance): checking +150, savings +200,
    // card 6550 -> 6400 = +150 net worth, auto loan 18100 -> 17800 = +300 net worth. Total +800.
    expect(vm.change1m).toBe(800);
    expect(vm.groups.map((g) => g.group)).toEqual(['cash', 'retirement', 'vehicle', 'creditCard', 'loan']);
    const byGroup = Object.fromEntries(vm.groups.map((g) => [g.group, g]));
    expect(byGroup.cash!.total).toBe(3800);
    expect(byGroup.cash!.change1m).toBe(350); // 150 + 200
    expect(byGroup.retirement!.change1m).toBeNull();
    expect(byGroup.vehicle!.total).toBe(0); // excluded
    expect(byGroup.vehicle!.accounts[0]!.excluded).toBe(true);
    expect(byGroup.creditCard!.change1m).toBe(-150); // balance 6550 -> 6400
    expect(vm.canRefresh).toBe(false);
  });

  it('draws the net worth history and cuts it by period', () => {
    const { result } = renderHook(() => useAccounts({ today: TODAY }));
    // October: 1150 + 2300 - 6550 - 18100 = -21200. November: -5900 (the 401(k) is new).
    expect(result.current.chart).toEqual([
      { month: '2026-10', value: -21200 },
      { month: '2026-11', value: -5900 },
    ]);
    act(() => result.current.setPeriod('1m'));
    expect(result.current.chart).toHaveLength(2);
    act(() => result.current.setSummaryMode('percent'));
    expect(result.current.summaryMode).toBe('percent');
  });

  it('opens the add flow and starts empty after deleting everything', () => {
    const { result } = renderHook(() => useAccounts({ today: TODAY }));
    act(() => result.current.add());
    expect(result.current.adding).toBe(true);
    act(() => useAccountsStore.setState({ accounts: [] }));
    expect(result.current.isEmpty).toBe(true);
    expect(result.current.netWorth).toBe(0);
    expect(result.current.change1m).toBeNull();
    expect(result.current.chart).toEqual([]);
  });
});

describe('useAccount', () => {
  it('renders one account and its lines', () => {
    const { result } = renderHook(() => useAccount('card-1', { today: TODAY }));
    expect(result.current.found).toBe(true);
    const a = result.current.account!;
    expect(a.balance).toBe(6400);
    expect(a.kind).toBe('liability');
    expect(a.summary).toMatchObject({ apr: 0.2436, minPayment: { value: 193.92, isEstimate: true }, creditLimit: null, lastUpdated: '2026-11', created: '2026-10' });
    expect(a.chart.map((p) => p.value)).toEqual([6550, 6400]);
    expect(a.transactions).toEqual([]);
    expect(renderHook(() => useAccount('checking-1', { today: TODAY })).result.current.account!.transactions).toHaveLength(170);
    expect(renderHook(() => useAccount('nope', { today: TODAY })).result.current.found).toBe(false);
  });

  it('edits the balance, renames, excludes, adds a line and deletes', () => {
    const { result } = renderHook(() => useAccount('card-1', { today: TODAY }));
    expect(result.current.editBalance(-1)).toBe(false);
    act(() => void result.current.editBalance(6000));
    expect(result.current.account!.balance).toBe(6000);
    expect(result.current.account!.chart.at(-1)).toEqual({ month: '2026-11', value: 6000 }); // the November point is replaced
    expect(result.current.rename('  ')).toBe(false);
    act(() => void result.current.rename('Travel card'));
    expect(result.current.account!.name).toBe('Travel card');
    act(() => result.current.exclude());
    expect(result.current.account!.excluded).toBe(true);
    act(() => result.current.exclude(false));
    expect(result.current.account!.excluded).toBe(false);
    let id: string | null = null;
    act(() => {
      id = result.current.addTransaction({ date: '2026-11-14', label: 'Flights', amount: -300, category: 'other' });
    });
    expect(id).not.toBeNull();
    expect(result.current.account!.transactions).toHaveLength(1);
    expect(result.current.addTransaction({ date: '2026-02-30', label: 'x', amount: -1, category: 'other' })).toBeNull();
    act(() => result.current.delete());
    expect(result.current.found).toBe(false);
  });
});

describe('useAddAccount', () => {
  it('walks pick-type, form, submit and adds the account', () => {
    const { result } = renderHook(() => useAddAccount({ today: TODAY }));
    expect(result.current.step).toBe('pick-type');
    expect(result.current.groups).toHaveLength(9);
    act(() => result.current.pickType('creditCard'));
    expect(result.current.step).toBe('form');
    expect(result.current.fields.map((f) => f.id)).toEqual(['name', 'balance', 'apr', 'minPayment']);
    // A card's blank minimum payment is filled in by us and tagged an estimate.
    expect(result.current.fields.find((f) => f.id === 'minPayment')).toMatchObject({ defaulted: true, isEstimate: true, required: false });

    act(() => void result.current.submit());
    expect(result.current.fields.filter((f) => f.error === 'required').map((f) => f.id)).toEqual(['name', 'balance', 'apr']);

    act(() => {
      result.current.setField('name', 'Visa');
      result.current.setField('balance', '$1,000');
      result.current.setField('apr', '20');
    });
    let id: string | null = null;
    act(() => {
      id = result.current.submit();
    });
    expect(id).toBe('account-1');
    expect(result.current.step).toBe('pick-type');
    const added = useAccountsStore.getState().accounts.find((a) => a.id === id)!;
    // 1000 at 20% a year: interest 1000 * 0.2 / 12 = 16.67 plus 1% of the balance (10) = 26.67, above the $25 floor.
    expect(added).toMatchObject({ group: 'creditCard', name: 'Visa', apr: 0.2, balance: { value: 1000, isEstimate: false }, history: [{ month: '2026-11', balance: 1000 }] });
    expect(added.minPayment!.value).toBeCloseTo(cardMinPaymentFor(1000, 0.2), 10);
    expect(added.minPayment!.value).toBeCloseTo(26.6667, 3);
    expect(added.minPayment!.isEstimate).toBe(true);
  });

  it('goes back and closes', () => {
    const { result } = renderHook(() => useAddAccount({ today: TODAY }));
    act(() => result.current.pickType('loan'));
    expect(result.current.fields.map((f) => f.id)).toEqual(['name', 'balance', 'debtKind', 'apr', 'minPayment']);
    act(() => result.current.back());
    expect(result.current.step).toBe('pick-type');
    act(() => useAccountsStore.getState().setAdding(true));
    act(() => result.current.close());
    expect(useAccountsStore.getState().adding).toBe(false);
  });
});
