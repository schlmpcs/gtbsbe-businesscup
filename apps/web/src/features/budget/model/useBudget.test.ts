// @vitest-environment jsdom
// Budget on the fixtures: the demo profile's spending as the plan, the November 2026 ledger as the actuals.
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { profileDemo } from '@/fixtures';
import { FIXTURE_NOW, resetFixtureStores } from '@/features/dashboard/model/resetFixtureStores';
import { ledger } from '@/features/transactions/model/transactionsStore';
import type { StatementItem } from '@lifeguessr/types';
import { useBudget } from './useBudget';

const TODAY = '2026-11-15'; // day 15 of 30
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FIXTURE_NOW);
  await resetFixtureStores();
});
afterEach(() => vi.useRealTimers());

const rowOf = (vm: ReturnType<typeof useBudget>, category: string) => vm.groups.flatMap((g) => g.rows).find((r) => r.category === category)!;

describe('useBudget', () => {
  it('starts without a budget and still shows what was spent', () => {
    const { result } = renderHook(() => useBudget({ today: TODAY }));
    expect(result.current.ready).toBe(true);
    expect(result.current.hasBudget).toBe(false);
    expect(result.current.monthLabel).toBe('November 2026');
    expect(result.current.isCurrent).toBe(true);
    expect(result.current.groups.map((g) => g.id)).toEqual(['essentials', 'lifestyle', 'debt']);
    expect(result.current.groups.flatMap((g) => g.rows)).toHaveLength(8); // every cost category once
    expect(rowOf(result.current, 'rentUtilities')).toMatchObject({ planned: 0, actual: expect.closeTo(1883.15, 2), progress: 1 });
  });

  it('createBudget fills planned from the demo profile (profile.spending)', () => {
    const { result } = renderHook(() => useBudget({ today: TODAY }));
    act(() => result.current.createBudget());
    const vm = result.current;
    expect(vm.hasBudget).toBe(true);
    for (const row of vm.groups.flatMap((g) => g.rows)) expect(row.planned).toBe(profileDemo.spending[row.category].value);
    // 1950 + 310 + 0 + 520 + 340 + 85 + 0 + 450 = 3655 a month.
    expect(vm.totals.planned).toBe(3655);
    expect(vm.income).toMatchObject({ planned: 5200, actual: 2400 }); // take-home pay vs one 2400 pay line so far
    // The engine's pace (MP9): halfway through the month (15 / 30) a flexible line is half its plan, a fixed
    // line (rent, childcare, debt, subscriptions) is its whole plan once anything was paid, else 0.
    // Rent 1950 + car 155 + childcare 0 + groceries 260 + eating out 170 + subscriptions 85 + debt 0 + other 225 = 2845.
    expect(vm.totals.expectedByToday).toBe(2845);
    expect(vm.groups[0]!.rows[0]!.todayMarker).toBe(0.5);
    // Rent: planned 1950, actual 1883.15 -> remaining 66.85, 96.6% of the plan; it is paid, so the pace is 1950
    // and 66.85 is within 10% of it (195): on pace.
    expect(rowOf(vm, 'rentUtilities')).toMatchObject({ planned: 1950, remaining: expect.closeTo(66.85, 2), expectedByToday: 1950, status: 'onPace' });
    expect(rowOf(vm, 'rentUtilities').progress).toBeCloseTo(1883.15 / 1950, 10);
    // Eating out: 160.56 against a pace of 340 / 2 = 170; 9.44 off is within 10% of 170 (17): on pace.
    expect(rowOf(vm, 'eatingOut').status).toBe('onPace');
    // Groceries: 169.47 against a pace of 520 / 2 = 260; 90.53 off is more than 26: under.
    expect(rowOf(vm, 'groceries').status).toBe('under');
    // An unplanned category with no spending sits exactly on its (zero) pace and is empty.
    expect(rowOf(vm, 'childcare')).toMatchObject({ planned: 0, actual: 0, progress: 0, status: 'onPace' });
  });

  it('takes the actuals from imported transactions', async () => {
    await ledger().clear();
    // A categorizer stand-in (no network): one class per line, in order, by the merchant.
    const categorize = async (items: readonly StatementItem[]) => ({
      months: [],
      categorizedBy: 'rules' as const,
      lines: items.map((i) => ({ cls: i.label.startsWith('PAYROLL') ? ('pay' as const) : ('groceries' as const), oneOffHint: false })),
    });
    const csv = 'Date,Description,Amount\n2026-11-02,GROCERY MART,-80.00\n2026-11-09,GROCERY MART,-45.50\n2026-11-03,PAYROLL ACME,3000.00\n';
    await ledger().importFile(new File([csv], 'statement.csv', { type: 'text/csv' }), { categorize: categorize as never, remember: false });

    const { result } = renderHook(() => useBudget({ today: TODAY }));
    // Groceries in November: 80.00 + 45.50 = 125.50 spent; nothing planned yet, so remaining is -125.50. Pay in: 3000.
    expect(rowOf(result.current, 'groceries')).toMatchObject({ planned: 0, actual: 125.5, remaining: -125.5, status: 'over' });
    expect(result.current.totals).toMatchObject({ planned: 0, actual: 125.5 });
    expect(result.current.income).toMatchObject({ actual: 3000 });
    // October has no lines now.
    act(() => result.current.prev());
    expect(result.current.totals.actual).toBe(0);
    // With a plan of 400 groceries, the same 125.50 is under the plan: remaining 400 - 125.50 = 274.50.
    act(() => result.current.today());
    act(() => void result.current.setPlanned('groceries', 400));
    expect(rowOf(result.current, 'groceries')).toMatchObject({ planned: 400, actual: 125.5, remaining: 274.5 });
  });

  it('marks a line over once spending passes the plan, and takes a new plan', () => {
    const { result } = renderHook(() => useBudget({ today: TODAY }));
    expect(result.current.setPlanned('groceries', -5)).toBe(false);
    act(() => void result.current.setPlanned('groceries', 100)); // no budget yet: starts one from zero
    expect(result.current.hasBudget).toBe(true);
    expect(rowOf(result.current, 'groceries')).toMatchObject({ planned: 100, status: 'over' }); // actual 169.47 > 100
    expect(rowOf(result.current, 'groceries').remaining).toBeCloseTo(-69.47, 2);
    expect(rowOf(result.current, 'groceries').progress).toBeCloseTo(1.6947, 4);
  });

  it('moves between months and years', () => {
    const { result } = renderHook(() => useBudget({ today: TODAY }));
    act(() => result.current.createBudget());
    act(() => result.current.prev());
    expect(result.current.monthLabel).toBe('October 2026');
    expect(result.current.isCurrent).toBe(false);
    expect(result.current.groups[0]!.rows[0]!.todayMarker).toBe(1); // a past month is all gone
    expect(rowOf(result.current, 'groceries').actual).toBeCloseTo(509.26, 2);
    act(() => result.current.today());
    expect(result.current.monthLabel).toBe('November 2026');
    act(() => result.current.setMode('year'));
    expect(result.current.monthLabel).toBe('2026');
    // The year is twelve planned months: rent 1950 * 12 = 23400.
    expect(rowOf(result.current, 'rentUtilities').planned).toBe(23400);
    act(() => result.current.next());
    expect(result.current.monthLabel).toBe('2027');
    expect(result.current.groups[0]!.rows[0]!.todayMarker).toBe(0);
  });
});
