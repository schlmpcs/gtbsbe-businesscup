// @vitest-environment jsdom
// Budget on the fixtures: the demo profile's spending as the plan, the November 2026 ledger as the actuals.
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { profileDemo } from '@/fixtures';
import { resetFixtureStores } from '@/features/dashboard/model/resetFixtureStores';
import { useBudget } from './useBudget';

const TODAY = '2026-11-15'; // day 15 of 30
beforeEach(resetFixtureStores);

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
    // Halfway through the month (15 / 30) the pace is half the plan.
    expect(vm.totals.expectedByToday).toBe(1827.5);
    expect(vm.groups[0]!.rows[0]!.todayMarker).toBe(0.5);
    // Rent: planned 1950, actual 1883.15 -> remaining 66.85, 96.6% of the plan, above the pace of 975.
    expect(rowOf(vm, 'rentUtilities')).toMatchObject({ planned: 1950, remaining: expect.closeTo(66.85, 2), expectedByToday: 975, status: 'onPace' });
    expect(rowOf(vm, 'rentUtilities').progress).toBeCloseTo(1883.15 / 1950, 10);
    // Eating out: 160.56 against a pace of 340 / 2 = 170 -> under.
    expect(rowOf(vm, 'eatingOut').status).toBe('under');
    // An unplanned category with no spending is under and empty.
    expect(rowOf(vm, 'childcare')).toMatchObject({ planned: 0, actual: 0, progress: 0, status: 'under' });
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
