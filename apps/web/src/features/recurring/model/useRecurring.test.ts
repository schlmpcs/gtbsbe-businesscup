// @vitest-environment jsdom
// Recurring on the fixtures: the engine's detectSubscriptions over the ledger, plus profile and account items.
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetFixtureStores } from '@/features/dashboard/model/resetFixtureStores';
import { useRecurring } from './useRecurring';

const TODAY = '2026-11-15';
beforeEach(resetFixtureStores);

describe('useRecurring', () => {
  it('lists income, expenses and credit cards for the month', () => {
    const { result } = renderHook(() => useRecurring({ today: TODAY }));
    const vm = result.current;
    expect(vm.ready).toBe(true);
    expect(vm.error).toBeNull();
    expect(vm.empty).toBe(false);
    expect(vm.monthLabel).toBe('November 2026');
    expect(vm.sections.map((s) => s.id)).toEqual(['income', 'expenses', 'creditCards']);
    const [income, expenses, cards] = vm.sections;
    expect(income!.items).toMatchObject([{ id: 'income:take-home', amount: 5200, labelKey: 'takeHomePay', dayOfMonth: null }]);
    expect(cards!.items).toMatchObject([{ id: 'account:card-1', label: 'Credit card', amount: 193.92, amountIsEstimate: true }]);
    // Expenses: rent 1950, the auto loan 412, and the four monthly charges the detector finds in the
    // statement (Planet Fitness 24.99, Netflix 17.99, Spotify 11.99, Apple 2.99 = 57.96).
    const statement = expenses!.items.filter((i) => i.origin === 'statement');
    expect(statement.map((i) => i.amount).sort((a, b) => a - b)).toEqual([2.99, 11.99, 17.99, 24.99]);
    expect(expenses!.total).toBeCloseTo(1950 + 412 + 57.96, 2);
    expect(expenses!.items.find((i) => i.id === 'rent')).toMatchObject({ dayOfMonth: 1, dayIsEstimate: true });
  });

  it('places items on the calendar by day of the month', () => {
    const { result } = renderHook(() => useRecurring({ today: TODAY }));
    const cells = result.current.calendar.weeks.flat();
    expect(result.current.calendar.weeks.every((w) => w.length === 7)).toBe(true);
    expect(cells.filter((c) => c.day !== null)).toHaveLength(30); // November
    expect(cells.find((c) => c.isToday)!.iso).toBe(TODAY);
    expect(cells.find((c) => c.day === 1)!.items.map((i) => i.id)).toContain('rent');
    expect(cells.find((c) => c.day === 20)!.items.map((i) => i.id)).toEqual(expect.arrayContaining(['account:card-1', 'account:auto-1']));
  });

  it('hides an item marked not recurring and moves between months', () => {
    const { result } = renderHook(() => useRecurring({ today: TODAY }));
    act(() => result.current.markNotRecurring('rent'));
    expect(result.current.sections[1]!.items.find((i) => i.id === 'rent')).toBeUndefined();
    act(() => result.current.prev());
    expect(result.current.monthLabel).toBe('October 2026');
    expect(result.current.isCurrent).toBe(false);
    act(() => result.current.next());
    act(() => result.current.next());
    expect(result.current.monthLabel).toBe('December 2026');
    act(() => result.current.today());
    expect(result.current.isCurrent).toBe(true);
  });
});
