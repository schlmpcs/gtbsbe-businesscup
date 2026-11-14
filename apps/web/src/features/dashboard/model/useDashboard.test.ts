// @vitest-environment jsdom
// The Dashboard on the fixtures (accounts.demo.json, transactions.demo.json, profile.demo.json). No network.
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { monteCarloDemo } from '@/fixtures';
import { useAccountsStore } from '@/features/accounts/model/accountsStore';
import { useBudgetStore } from '@/features/budget/model/budgetStore';
import { useDashboardStore } from './dashboardStore';
import { resetFixtureStores } from './resetFixtureStores';
import { useDashboard } from './useDashboard';

const TODAY = '2026-11-15';
const NOW = new Date(2026, 10, 15, 9, 0); // local time: 09:00
const dash = () => renderHook(() => useDashboard({ today: TODAY, now: NOW }));
beforeEach(resetFixtureStores);

describe('useDashboard', () => {
  it('renders every card from the fixtures', () => {
    const { result } = dash();
    const vm = result.current;
    expect(vm.ready).toBe(true);
    expect(vm.greeting.part).toBe('morning');
    // Same balance sheet as Accounts: 18300 - 24200 = -5900, +800 over the month, two history points.
    expect(vm.netWorth).toMatchObject({ value: -5900, change1m: 800, hasAccounts: true });
    expect(vm.netWorth.sparkline.map((p) => p.value)).toEqual([-21200, -5900]);
    // November up to the 15th is every November line (the last is the 12th): 2544.96. October in full: 3948.01.
    expect(vm.spending.month).toBe('2026-11');
    expect(vm.spending.thisMonth).toBeCloseTo(2544.96, 2);
    expect(vm.spending.lastMonth).toBeCloseTo(3948.01, 2);
    // October's money out through the 15th (a day-by-day sum of the ledger): 3122.87.
    expect(vm.spending.lastMonthToDate).toBeCloseTo(3122.87, 2);
    expect(vm.spending.points).toHaveLength(31); // the longer of the two months (October)
    expect(vm.spending.points[14]).toMatchObject({ day: 15 });
    expect(vm.spending.points[14]!.thisMonth).toBeCloseTo(2544.96, 2);
    expect(vm.spending.points[15]!.thisMonth).toBeNull(); // the 16th has not happened
    expect(vm.spending.points[30]).toMatchObject({ day: 31, thisMonth: null }); // November has 30 days
    expect(vm.plan).toEqual({ status: 'result', successRate: monteCarloDemo.successRate });
    expect(vm.topMove).not.toBeNull();
    expect(vm.duel).toEqual({ playedToday: false, streak: 3 });
    expect(vm.budget).toEqual({ hasBudget: false, rows: [] });
    expect(vm.recentTransactions).toHaveLength(5);
    expect(vm.recentTransactions[0]).toMatchObject({ id: 'tx-170', date: '2026-11-12' });
    expect(vm.links.accounts).toBe('/accounts');
  });

  it('greets by the hour', () => {
    expect(renderHook(() => useDashboard({ today: TODAY, now: new Date(2026, 10, 15, 14) })).result.current.greeting.part).toBe('afternoon');
    expect(renderHook(() => useDashboard({ today: TODAY, now: new Date(2026, 10, 15, 21) })).result.current.greeting.part).toBe('evening');
  });

  it('turns checklist items done when the underlying state changes, and can be dismissed', () => {
    const { result } = dash();
    const state = () => Object.fromEntries(result.current.checklist.items.map((i) => [i.id, i.done]));
    // A 3-day Duel streak, accounts and a ledger are there; the own-month guess and a plan event are not.
    expect(state()).toEqual({ duel: true, guess: false, accounts: true, csv: true, planEvent: false });
    expect(result.current.checklist).toMatchObject({ done: 3, total: 5, visible: true });
    expect(result.current.checklist.items.map((i) => i.labelKey)).toEqual(['playedDuel', 'guessedOwnMonth', 'addedAccounts', 'importedCsv', 'createdPlanEvent']);

    act(() => useDashboardStore.getState().update({ guessedOwnMonth: true }));
    expect(result.current.checklist.done).toBe(4);
    act(() => useAccountsStore.setState({ accounts: [] }));
    expect(state().accounts).toBe(false);
    expect(result.current.netWorth).toMatchObject({ value: 0, hasAccounts: false, sparkline: [] });
    act(() => useAccountsStore.getState().addAccount({ group: 'cash', name: 'Cash', balance: { value: 10, isEstimate: false }, history: [] }));
    expect(state().accounts).toBe(true);
    act(() => useDashboardStore.getState().update({ createdPlanEvent: true }));
    expect(result.current.checklist).toMatchObject({ done: 5, total: 5, visible: false }); // all done: the card goes away

    act(() => useDashboardStore.getState().update({ createdPlanEvent: false }));
    expect(result.current.checklist.visible).toBe(true);
    act(() => result.current.dismissChecklist());
    expect(result.current.checklist).toMatchObject({ dismissed: true, visible: false });
  });

  it('shows "Run" until a Chance run exists', () => {
    const { result } = dash();
    act(() => useDashboardStore.getState().update({ planSuccessRate: null }));
    expect(result.current.plan).toEqual({ status: 'run' });
  });

  it('lists the 3 budget lines with the least left, once a budget exists', () => {
    const { result } = dash();
    act(() => useBudgetStore.getState().create({ rentUtilities: 1950, car: 310, childcare: 0, groceries: 520, eatingOut: 340, subscriptions: 85, debtPayments: 0, other: 450 }, 5200));
    expect(result.current.budget.hasBudget).toBe(true);
    // Remaining = planned - actual (November so far): subscriptions 85 - 57.96 = 27.04, rent 1950 - 1883.15 = 66.85,
    // car 310 - 184.98 = 125.02, eating out 179.44, ...; childcare and debt (nothing planned, nothing spent) are left out.
    expect(result.current.budget.rows.map((r) => r.category)).toEqual(['subscriptions', 'rentUtilities', 'car']);
    expect(result.current.budget.rows[0]!.remaining).toBeCloseTo(27.04, 2);
  });
});
