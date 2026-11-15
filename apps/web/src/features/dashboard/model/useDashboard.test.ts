// @vitest-environment jsdom
// The Dashboard on the fixtures (accounts.demo.json, transactions.demo.json, profile.demo.json). No network.
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { monteCarloDemo } from '@/fixtures';
import { useAccountsStore } from '@/lib/model/accounts';
import { useAppStore } from '@/state/store';
import { usePlanStore } from '@/features/plan/model/planStore';
import { ledger } from '@/features/transactions/model/transactionsStore';
import { useBudgetStore } from '@/features/budget/model/budgetStore';
import { FIXTURE_NOW, resetFixtureStores } from './resetFixtureStores';
import { useDashboard } from './useDashboard';

const TODAY = '2026-11-15';
const NOW = new Date(2026, 10, 15, 9, 0); // local time: 09:00
const addPlanEvent = () => {
  const { activeId } = usePlanStore.getState();
  usePlanStore.getState().edit(activeId, (s) => ({ ...s, events: [{ id: 'ev-1', type: 'windfall', year: 2027, enabled: true, amount: 5000 }] }));
};
/** Back to a plan the person never changed. */
const untouchPlan = () => usePlanStore.setState({ touched: false });
const dash = () => renderHook(() => useDashboard({ today: TODAY, now: NOW }));
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FIXTURE_NOW);
  await resetFixtureStores();
});
afterEach(() => vi.useRealTimers());

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
    expect(vm.topMove).not.toBeNull();
    expect(vm.duel).toEqual({ playedToday: false, played: 0, total: 5, streak: 3 });
    expect(vm.budget).toMatchObject({ hasBudget: false, rows: [], groups: [] });
    expect(vm.recentTransactions).toHaveLength(5);
    expect(vm.recentTransactions[0]).toMatchObject({ id: 'tx-170', date: '2026-11-12' });
    expect(vm.links.accounts).toBe('/accounts');
  });

  it('greets by the hour', () => {
    expect(renderHook(() => useDashboard({ today: TODAY, now: new Date(2026, 10, 15, 14) })).result.current.greeting.part).toBe('afternoon');
    expect(renderHook(() => useDashboard({ today: TODAY, now: new Date(2026, 10, 15, 21) })).result.current.greeting.part).toBe('evening');
  });

  it('does not count the sample profile\'s seeded accounts as the person\'s', () => {
    const { result } = dash();
    expect(useAppStore.getState().profileOrigin).toBe('demo');
    expect(result.current.checklist.items.find((i) => i.id === 'accounts')!.done).toBe(false);
  });

  it('turns checklist items done when the underlying state changes, and can be dismissed', () => {
    useAppStore.setState({ profileOrigin: 'user' });
    const { result } = dash();
    const state = () => Object.fromEntries(result.current.checklist.items.map((i) => [i.id, i.done]));
    // A 3-day Duel streak, accounts and a ledger are there; the own-month guess, a budget and a plan of their own are not.
    expect(state()).toEqual({ duel: true, guess: false, accounts: true, csv: true, budget: false, planEvent: false });
    expect(result.current.checklist).toMatchObject({ done: 3, total: 6, visible: true });
    expect(result.current.checklist.items.map((i) => i.labelKey)).toEqual([
      'playedDuel', 'guessedOwnMonth', 'addedAccounts', 'importedCsv', 'setBudget', 'createdPlanEvent',
    ]);
    expect(result.current.checklist.items.find((i) => i.id === 'budget')!.href).toBe('/budget');

    act(() => useAppStore.getState().setSelfGuess(3500)); // the own-month guess lives in the app store
    expect(result.current.checklist.done).toBe(4);
    act(() => useAccountsStore.setState({ accounts: [] }));
    expect(state().accounts).toBe(false);
    expect(result.current.netWorth).toMatchObject({ value: 0, hasAccounts: false, sparkline: [] });
    act(() => void useAccountsStore.getState().addAccount({ group: 'cash', name: 'Cash', balance: 10 }));
    expect(state().accounts).toBe(true);
    act(() => useBudgetStore.getState().create({ rentUtilities: 1950, car: 310, childcare: 0, groceries: 520, eatingOut: 340, subscriptions: 85, debtPayments: 0, other: 450 }, 5200));
    expect(state().budget).toBe(true);
    act(() => addPlanEvent());
    expect(result.current.checklist).toMatchObject({ done: 6, total: 6, visible: false }); // all done: the card goes away

    act(() => untouchPlan());
    expect(result.current.checklist.visible).toBe(true);
    act(() => result.current.dismissChecklist());
    expect(result.current.checklist).toMatchObject({ dismissed: true, visible: false });
  });

  it('turns the accounts and ledger items done and undone as the stores change', async () => {
    useAppStore.setState({ profileOrigin: 'user' });
    const { result } = dash();
    const state = () => Object.fromEntries(result.current.checklist.items.map((i) => [i.id, i.done]));
    expect(state()).toMatchObject({ accounts: true, csv: true });

    // Accounts: removing every one through the store's own action empties the item; adding one fills it.
    act(() => {
      for (const a of useAccountsStore.getState().accounts) useAccountsStore.getState().removeAccount(a.id);
    });
    expect(state().accounts).toBe(false);
    act(() => void useAccountsStore.getState().addAccount({ group: 'cash', name: 'Savings', balance: 250 }));
    expect(state().accounts).toBe(true);
    expect(result.current.netWorth).toMatchObject({ value: 250, hasAccounts: true });

    // Ledger: an empty store is "not imported"; one saved line is.
    await act(async () => ledger().clear());
    expect(state().csv).toBe(false);
    expect(result.current.recentTransactions).toEqual([]);
    await act(async () => {
      await ledger().addManual({ direction: 'debit', amount: 12, merchant: 'Coffee', date: '2026-11-14', cls: 'eatingOut' });
    });
    expect(state().csv).toBe(true);
    expect(result.current.recentTransactions).toMatchObject([{ label: 'Coffee', amount: -12 }]);
  });

  it('plans to the end age and shows the real Chance of success, the same run as /plan', async () => {
    const { result } = dash();
    const plan = result.current.plan!;
    expect(plan).not.toBeNull();
    // engine plan(): a point a year from this year to the end age.
    expect(plan.points[0]!.year).toBe(2026);
    expect(plan.points.at(-1)!.age).toBe(plan.endAge);
    expect(plan.endAge).toBe(90);
    expect(plan.retireAge).toBeGreaterThan(plan.points[0]!.age);
    // The dashboard starts /plan's Monte Carlo run; the result is the plan store's, not a fixture's.
    expect(plan.chance).toEqual({ status: 'running' });
    await waitFor(() => expect(result.current.plan!.chance.status).toBe('result'), { timeout: 10_000 });
    const stored = usePlanStore.getState().chanceResult!;
    expect(usePlanStore.getState().chanceStatus).toBe('done');
    expect(result.current.plan!.chance).toEqual({ status: 'result', successRate: stored.successRate, good: stored.successRate >= 0.8, paths: stored.paths });
    expect(stored.seed).toBe(usePlanStore.getState().chanceSettings.seed);
    expect(stored).not.toBe(monteCarloDemo);
  });

  it('cuts net worth to the 1, 3, 6 and 12 month periods', () => {
    const { result } = dash();
    const { periods } = result.current.netWorth;
    // History: October -21200, November -5900.
    expect(periods['1m']).toEqual({ points: [{ month: '2026-10', value: -21200 }, { month: '2026-11', value: -5900 }], change: 15300 });
    expect(periods['12m'].points.map((p) => p.month)).toEqual(['2026-10', '2026-11']);
    expect(periods['12m'].change).toBe(15300);
  });

  it('lists the recurring bills still due this month and the goals', () => {
    const { result } = dash();
    const { upcoming, remainingDue, empty } = result.current.recurring;
    expect(empty).toBe(false);
    // From the 15th on: the auto loan and the card minimum, both on the 20th (the accounts' assumed due day).
    expect(upcoming.map((b) => [b.date, b.labelKey, b.amount])).toEqual([['2026-11-20', 'loan', 412], ['2026-11-20', 'card', 193.92]]);
    expect(remainingDue).toBeCloseTo(605.92, 2);
    for (const b of upcoming) {
      expect(b.date >= TODAY).toBe(true);
      expect(b.section).not.toBe('income');
    }
    expect(upcoming.map((b) => b.date)).toEqual([...upcoming.map((b) => b.date)].sort());
    expect(result.current.goals).toEqual([]);
  });

  it('lists the 3 budget lines with the least left, once a budget exists', () => {
    const { result } = dash();
    act(() => useBudgetStore.getState().create({ rentUtilities: 1950, car: 310, childcare: 0, groceries: 520, eatingOut: 340, subscriptions: 85, debtPayments: 0, other: 450 }, 5200));
    expect(result.current.budget.hasBudget).toBe(true);
    // Remaining = planned - actual (November so far): subscriptions 85 - 57.96 = 27.04, rent 1950 - 1883.15 = 66.85,
    // car 310 - 184.98 = 125.02, eating out 179.44, ...; childcare and debt (nothing planned, nothing spent) are left out.
    expect(result.current.budget.rows.map((r) => r.category)).toEqual(['subscriptions', 'rentUtilities', 'car']);
    expect(result.current.budget.rows[0]!.remaining).toBeCloseTo(27.04, 2);
    // Groups: essentials and lifestyle (debt has nothing planned or spent); totals over every category.
    expect(result.current.budget.groups.map((g) => g.id)).toEqual(['essentials', 'lifestyle']);
    const { totals, groups } = result.current.budget;
    expect(totals.planned).toBe(1950 + 310 + 520 + 340 + 85 + 450);
    expect(groups.reduce((s, g) => s + g.actual, 0)).toBeCloseTo(totals.actual, 6);
    expect(totals.remaining).toBeCloseTo(totals.planned - totals.actual, 6);
    expect(result.current.budget.todayMarker).toBeCloseTo(15 / 30, 6);
  });
});
