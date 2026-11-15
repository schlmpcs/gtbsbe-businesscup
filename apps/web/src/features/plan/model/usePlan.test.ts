// @vitest-environment jsdom
// usePlan, useScenarios, useEventCatalog on the engine: the demo profile (what the profile store holds
// before the person enters anything) at 2026-11, ZIP 75206, and the demo scenarios. Expected numbers are
// the engine's plan() of the same inputs, called here directly, so the hooks are checked to show the
// engine's numbers and nothing else.
import { findArea } from '@lifeguessr/data/areas';
import { scenarioDemo } from '@lifeguessr/data/fixtures/plan';
import { plan } from '@lifeguessr/engine';
import type { PlanResult, Scenario } from '@lifeguessr/types';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stampProfile } from '@/state/profile';
import { useAppStore } from '@/state/store';
import { money } from './planFormat';
import { AUTOSAVE_MS, resetPlanStore, usePlanStore } from './planStore';
import type { PlanVM } from './types';
import { useEventCatalog } from './useEventCatalog';
import { usePlan } from './usePlan';
import { useScenarios } from './useScenarios';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(new Date('2026-11-14T12:00:00'));
  useAppStore.getState().reset();
  resetPlanStore();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** The engine's plan of `scenario` on the profile store's profile at 2026-11 and its ZIP's area data. */
function enginePlan(scenario: Scenario): PlanResult {
  const profile = stampProfile(useAppStore.getState().profile, '2026-11');
  return plan(profile, [], scenario, findArea(profile.zip) ?? undefined);
}
const active = (id = 'baseline') => usePlanStore.getState().scenarios.find((s) => s.id === id)!;

function ready(vm: PlanVM) {
  if (vm.status !== 'ready') throw new Error('plan not ready');
  return vm;
}

describe('usePlan', () => {
  it('shows the four KPI cards of the engine plan, formatted, with tones and tooltips', () => {
    const { result } = renderHook(() => usePlan('baseline'));
    const vm = ready(result.current);
    const k = enginePlan(active()).kpis;
    expect(vm.kpis.map((x) => [x.id, x.value, x.raw])).toEqual([
      ['netWorthEndOfYear', money(k.netWorthEndOfYear), k.netWorthEndOfYear],
      ['netWorthAtRetirement', money(k.netWorthAtRetirement), k.netWorthAtRetirement],
      ['netWorthAtEnd', money(k.netWorthAtEnd), k.netWorthAtEnd],
      ['shortfall', 'Past 90', null],
    ]);
    // The demo story: today's balance sheet is below zero (card + car loan), the $350,000 home in 2032
    // is paid from savings, and the money lasts past 90.
    expect(vm.kpis[0]!.tone).toBe('bad');
    expect(k.netWorthAtRetirement).toBeGreaterThan(500_000);
    expect(k.shortfallAge).toBeNull();
    expect(vm.kpis.every((x) => x.tooltip.length > 0 && x.tooltipKey === x.id)).toBe(true);
    expect(vm.disclaimer).toMatch(/educational simulation/i);
  });

  it('builds the chart, its event markers and x ticks, and the three tables from plan()', () => {
    const { result } = renderHook(() => usePlan('baseline'));
    const vm = ready(result.current);
    const p = enginePlan(active());
    // 2026 (age 32) to 2084 (age 90) = 59 plan years.
    expect(vm.chart.points).toHaveLength(59);
    expect(vm.chart.points.map((x) => x.netWorth)).toEqual(p.years.map((y) => y.netWorth));
    expect(vm.chart.points[0]).toMatchObject({ year: 2026, age: 32, belowZero: true });
    expect(vm.chart.markers.map((m) => [m.id, m.year, m.icon]).sort()).toEqual([
      ['ev-buy-home', 2032, 'home'],
      ['ev-retire', 2061, 'beach'],
      ['ev-social-security', 2061, 'shield'],
    ]);
    expect(vm.chart.retireYear).toBe(2061); // 2026 + (67 − 32)
    expect(vm.chart.yearRange).toEqual({ min: 2026, max: 2084 });
    expect(vm.chart.xTicks[0]).toEqual({ year: 2026, age: 32, label: '2026' });
    expect(vm.chart.xTicks.map((t) => t.age % 5)).toEqual([2, ...vm.chart.xTicks.slice(1).map(() => 0)]);

    expect(vm.tables.accounts.rows).toHaveLength(59);
    // The home and its mortgage are rows of their own, named after the event.
    const names = vm.tables.accounts.columns.map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(['Home', 'Mortgage']));
    expect(vm.tables.accounts.rows.find((r) => r.isRetirementYear)!.year).toBe(2061);
    // Assets then liabilities, each group listing its accounts; totals are the engine's.
    const { sections } = vm.tables.accounts;
    expect(sections.map((s) => s.id)).toEqual(['assets', 'liabilities']);
    expect(sections.flatMap((s) => s.groups.flatMap((g) => g.accountIds)).sort()).toEqual(vm.tables.accounts.columns.map((c) => c.accountId).sort());
    expect(sections[1]!.groups.map((g) => g.group)).toContain('mortgage');
    const r2040 = vm.tables.accounts.rows.find((r) => r.year === 2040)!;
    const p2040 = p.years.find((y) => y.year === 2040)!;
    expect(r2040).toMatchObject({ assetsLabel: money(p2040.assets), liabilitiesLabel: money(p2040.liabilities) });
    const mortgageIds = new Set(sections[1]!.groups.find((g) => g.group === 'mortgage')!.accountIds);
    const mortgageEnd = p2040.accounts.filter((a) => mortgageIds.has(a.accountId)).reduce((s, a) => s + a.end, 0);
    expect(r2040.groupEnds.mortgage).toBe(money(mortgageEnd));
    const y0 = p.years[0]!;
    const income = y0.cashFlow.income.reduce((s, l) => s + l.amount, 0);
    expect(vm.tables.cashFlow.rows[0]).toMatchObject({ incomeLabel: money(income), netLabel: money(y0.cashFlow.net) });
    // 2032: the $70,000 down payment is a one-time cost of that year.
    const y2032 = vm.tables.cashFlow.rows.find((r) => r.year === 2032)!;
    expect(y2032.expenseLines.find((l) => l.key === 'oneOffCosts')!.label).toBe('One-time costs and down payments');
    expect(vm.tables.events.map((e) => [e.id, e.year, e.age])).toEqual([
      ['ev-buy-home', 2032, 38], ['ev-retire', 2061, 67], ['ev-social-security', 2061, 67],
    ]);
    expect(vm.tables.events[0]!.summary).toBe('$350,000 home, 20% down'); // 70,000 / 350,000 = 0.2
  });

  it('returns notFound for an unknown scenario', () => {
    const { result } = renderHook(() => usePlan('nope'));
    expect(result.current.status).toBe('notFound');
  });

  it('moveEvent changes the event year, clamped to the plan years, and the plan follows', () => {
    const { result } = renderHook(() => usePlan('baseline'));
    act(() => ready(result.current).moveEvent('ev-buy-home', 2034.4));
    expect(ready(result.current).tables.events.find((e) => e.id === 'ev-buy-home')!.year).toBe(2034);
    expect(ready(result.current).kpis[1]!.raw).toBe(enginePlan(active()).kpis.netWorthAtRetirement);
    act(() => ready(result.current).moveEvent('ev-buy-home', 2200));
    expect(ready(result.current).chart.markers.find((m) => m.id === 'ev-buy-home')!.year).toBe(2084);
    act(() => ready(result.current).moveEvent('ev-buy-home', 1990));
    expect(ready(result.current).chart.markers.find((m) => m.id === 'ev-buy-home')!.year).toBe(2026);
  });

  it('moving the Retire event moves the retirement age with it', () => {
    const { result } = renderHook(() => usePlan('baseline'));
    act(() => ready(result.current).moveEvent('ev-retire', 2056)); // 2056 − 2026 + 32 = age 62
    const vm = ready(result.current);
    expect(vm.chart.retireYear).toBe(2056);
    expect(vm.kpis[1]!.label).toBe('At retirement (62)');
  });

  it('autosave: saving right after a change, saved 300 ms later', () => {
    const { result } = renderHook(() => usePlan('baseline'));
    expect(ready(result.current).saveState).toBe('saved');
    act(() => ready(result.current).moveEvent('ev-buy-home', 2033));
    expect(ready(result.current)).toMatchObject({ saveState: 'saving', saveLabel: 'Saving…' });
    act(() => void vi.advanceTimersByTime(AUTOSAVE_MS - 1));
    expect(ready(result.current).saveState).toBe('saving');
    act(() => void vi.advanceTimersByTime(1));
    expect(ready(result.current)).toMatchObject({ saveState: 'saved', saveLabel: 'Saved just now' });
  });

  it('setDisplay("future") shows the engine plan in nominal dollars', () => {
    const { result } = renderHook(() => usePlan('baseline'));
    act(() => ready(result.current).setDisplay('future'));
    const vm = ready(result.current);
    expect(vm.display.value).toBe('future');
    const k = enginePlan(active()).kpis;
    expect(vm.kpis[1]!.raw).toBe(k.netWorthAtRetirement);
    expect(k.netWorthAtRetirement).toBeGreaterThan(enginePlan(scenarioDemo as Scenario).kpis.netWorthAtRetirement);
  });

  it('a profile change moves the plan: the hooks read the profile store', () => {
    const { result } = renderHook(() => usePlan('baseline'));
    const before = ready(result.current).kpis[1]!.raw as number;
    act(() => useAppStore.getState().setSpending('eatingOut', 140)); // $200 a month less
    const after = ready(result.current).kpis[1]!.raw as number;
    expect(after).toBeGreaterThan(before);
    expect(after).toBe(enginePlan(active()).kpis.netWorthAtRetirement);
  });
});

describe('useScenarios', () => {
  it('lists the two demo scenarios, the first active, and can compare', () => {
    const { result } = renderHook(() => useScenarios());
    expect(result.current.items.map((s) => [s.id, s.name, s.active])).toEqual([
      ['baseline', 'Baseline', true],
      ['with-kid', 'Baseline + a kid', false],
    ]);
    expect(result.current.canCompare).toBe(true);
  });

  it('a profile of the person’s own gets the engine Baseline: Retire and Social Security at 67', () => {
    act(() => useAppStore.getState().setSpending('eatingOut', 300)); // the profile is now the person's own
    const { result } = renderHook(() => useScenarios());
    expect(result.current.items.map((s) => s.name)).toEqual(['Baseline']);
    const events = usePlanStore.getState().scenarios[0]!.events;
    expect(events.map((e) => [e.type, e.year])).toEqual([['retire', 2061], ['socialSecurity', 2061]]);
  });

  it('select, add (duplicate the active one), rename and remove', () => {
    const { result } = renderHook(() => useScenarios());
    act(() => result.current.select('with-kid'));
    expect(result.current.activeId).toBe('with-kid');
    let id = '';
    act(() => void (id = result.current.add()));
    expect(result.current.items).toHaveLength(3);
    expect(result.current.items.find((s) => s.active)).toMatchObject({ id, name: 'Scenario 3' });
    act(() => result.current.rename(id, '  Plan C '));
    expect(result.current.items.find((s) => s.id === id)!.name).toBe('Plan C');
    act(() => result.current.rename(id, '   ')); // empty names are ignored
    expect(result.current.items.find((s) => s.id === id)!.name).toBe('Plan C');
    act(() => result.current.remove(id));
    expect(result.current.items).toHaveLength(2);
    expect(result.current.items.some((s) => s.active)).toBe(true);
    act(() => result.current.remove('with-kid'));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.canCompare).toBe(false);
    expect(result.current.canRemove).toBe(false);
    act(() => result.current.remove('baseline')); // the last one stays
    expect(result.current.items).toHaveLength(1);
  });

  it('a duplicate carries the events of the original', () => {
    const scenarios = renderHook(() => useScenarios());
    act(() => void scenarios.result.current.add());
    const copy = renderHook(() => usePlan(scenarios.result.current.activeId));
    expect(ready(copy.result.current).tables.events).toHaveLength(3);
  });
});

describe('useEventCatalog', () => {
  it('lists the nine event types; Retire and Social Security are taken in the Baseline', () => {
    const { result } = renderHook(() => useEventCatalog());
    expect(result.current.entries).toHaveLength(9);
    const enabled = Object.fromEntries(result.current.entries.map((e) => [e.type, e.enabled]));
    expect(enabled).toMatchObject({ buyHome: true, haveKid: true, windfall: true, retire: false, socialSecurity: false });
    expect(result.current.entries.every((e) => e.title && e.description && e.icon)).toBe(true);
  });

  it('add(type) creates the event with the engine defaults and opens the editor on it', () => {
    const catalog = renderHook(() => useEventCatalog());
    const plan = renderHook(() => usePlan('baseline'));
    let id: string | null = null;
    act(() => void (id = catalog.result.current.add('haveKid')));
    expect(id).not.toBeNull();
    expect(catalog.result.current.openEventId).toBe(id);
    const row = ready(plan.result.current).tables.events.find((e) => e.id === id)!;
    expect(row).toMatchObject({ type: 'haveKid', year: 2027, enabled: true });
    // Dallas County infant childcare in the demo ZIP's area data.
    const childcare = findArea('75206')!.childcareMonthly!.infant;
    expect(row.summary).toBe(`${money(childcare)} a month of childcare for 5 years`);
    act(() => catalog.result.current.closeEditor());
    expect(catalog.result.current.openEventId).toBeNull();
  });

  it('refuses a second Retire event', () => {
    const catalog = renderHook(() => useEventCatalog());
    let id: string | null = 'x';
    act(() => void (id = catalog.result.current.add('retire')));
    expect(id).toBeNull();
  });
});
