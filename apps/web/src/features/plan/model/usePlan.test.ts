// @vitest-environment jsdom
// usePlan, useScenarios, useEventCatalog on the demo fixtures (planStore.ts resetPlanStore pins the demo
// profile at asOf 2026-11, accounts.demo.json and ZIP 75206): the real engine, no network. Expected
// numbers are plan.demo.json, regenerated from plan() by `pnpm fixtures:plan`.
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTOSAVE_MS, resetPlanStore } from './planStore';
import type { PlanVM } from './types';
import { useEventCatalog } from './useEventCatalog';
import { usePlan } from './usePlan';
import { useScenarios } from './useScenarios';

beforeEach(() => {
  resetPlanStore();
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function ready(vm: PlanVM) {
  if (vm.status !== 'ready') throw new Error('plan not ready');
  return vm;
}

describe('usePlan', () => {
  it('shows the four KPI cards from the fixture plan, formatted, with tones and tooltips', () => {
    const { result } = renderHook(() => usePlan('baseline'));
    const vm = ready(result.current);
    // plan.demo.json kpis: netWorthEndOfYear −3,102.91; atRetirement (age 67) 936,904.28; atEnd (age 90)
    // 1,138,569.22; shortfallAge null (the 2033 home's $75,000 down payment is covered by cash and
    // investments, so the plan never runs short: "Past 90").
    expect(vm.kpis.map((k) => [k.id, k.value, k.tone])).toEqual([
      ['netWorthEndOfYear', '−$3,103', 'bad'],
      ['netWorthAtRetirement', '$936,904', 'good'],
      ['netWorthAtEnd', '$1,138,569', 'good'],
      ['shortfall', 'Past 90', 'good'],
    ]);
    expect(vm.kpis.every((k) => k.tooltip.length > 0 && k.tooltipKey === k.id)).toBe(true);
    expect(vm.disclaimer).toMatch(/educational simulation/i);
  });

  it('the shortfall card names the age the plan runs short: the Compare pair (Baseline + a kid) at 39', () => {
    // scenario.alt.json adds a kid in 2030: 840.67 of childcare + 850 of other costs = 1,690.67 a month, more
    // than the month's surplus, so cash, investments and retirement are drawn down from 2030 and the
    // $75,000 down payment in 2033 runs past them: shortfall from age 32 + (2033 − 2026) = 39 (plan() output).
    const { result } = renderHook(() => usePlan('with-kid'));
    const shortfall = ready(result.current).kpis.find((k) => k.id === 'shortfall')!;
    expect([shortfall.value, shortfall.tone, shortfall.raw]).toEqual(['Age 39', 'bad', 39]);
  });

  it('builds the chart, its event markers and x ticks, and the three tables', () => {
    const { result } = renderHook(() => usePlan('baseline'));
    const vm = ready(result.current);
    // 2026 (age 32) to 2084 (age 90) = 59 plan years.
    expect(vm.chart.points).toHaveLength(59);
    expect(vm.chart.points[0]).toMatchObject({ year: 2026, age: 32, netWorthLabel: '−$3,103', belowZero: true });
    expect(vm.chart.points[0]!.netWorth).toBeCloseTo(-3102.91, 2);
    expect(vm.chart.points[1]!.belowZero).toBe(false); // 2027: 14,042.21
    expect(vm.chart.markers.map((m) => [m.id, m.year, m.icon]).sort()).toEqual([
      ['ev-buy-home', 2033, 'home'],
      ['ev-retire', 2061, 'beach'],
      ['ev-social-security', 2061, 'shield'],
    ]);
    expect(vm.chart.retireYear).toBe(2061); // 2026 + (67 − 32)
    expect(vm.chart.xTicks[0]).toEqual({ year: 2026, age: 32, label: '2026' });
    expect(vm.chart.xTicks.map((t) => t.age % 5)).toEqual([2, ...vm.chart.xTicks.slice(1).map(() => 0)]);

    expect(vm.tables.accounts.rows).toHaveLength(59);
    expect(vm.tables.accounts.columns.map((c) => c.name)).toContain('Checking');
    // Today's $1,300 in checking, in today's dollars at the end of December (2 months from asOf November):
    // 1,300 ÷ 1.03^(2/12) = 1,293.61. Cash gets 30% of the 2026 net of 1,874.65 (below), shared by balance:
    // 1,874.65 × 0.3 × 1,300 / 3,800 = 192.40 to checking; with 6.63 of cash yield it ends at 1,492.63.
    expect(vm.tables.accounts.rows[0]!.cells['checking-1']).toMatchObject({ start: '$1,294', deposits: '$192', end: '$1,493' });
    // The home and its mortgage are rows of the account table, named after the event.
    expect(vm.tables.accounts.columns.filter((c) => c.accountId.startsWith('ev-buy-home:')).map((c) => [c.name, c.group]))
      .toEqual([['Home', 'realEstate'], ['Mortgage', 'mortgage']]);
    expect(vm.tables.accounts.rows.find((r) => r.isRetirementYear)!.year).toBe(2061);
    // 2026 cash flow (November and December, each month in today's dollars: ÷ 1.03^(1/12) and ÷ 1.03^(2/12),
    // together × 1.992625): take-home 5,200 × 1.992625 = 10,361.65; spending 3,655 a month (1,950 + 310 +
    // 520 + 340 + 85 + 450) × 1.992625 = 7,283.05; plus debt payments 1,203.95 = expenses 8,487.00; net 1,874.65.
    expect(vm.tables.cashFlow.rows[0]).toMatchObject({ incomeLabel: '$10,362', expensesLabel: '$8,487', netLabel: '$1,875', netTone: 'good' });
    expect(vm.tables.cashFlow.rows[0]!.expenseLines.map((l) => [l.label, l.amountLabel])).toEqual([
      ['Spending', '$7,283'], ['Debt payments', '$1,204'], ['One-time costs and down payments', '$0'],
    ]);
    expect(vm.tables.events.map((e) => [e.id, e.year, e.age])).toEqual([
      ['ev-buy-home', 2033, 39], ['ev-retire', 2061, 67], ['ev-social-security', 2061, 67],
    ]);
    expect(vm.tables.events[0]!.summary).toBe('$375,000 home, 20% down'); // 75,000 / 375,000 = 0.2
  });

  it('returns notFound for an unknown scenario', () => {
    const { result } = renderHook(() => usePlan('nope'));
    expect(result.current.status).toBe('notFound');
  });

  it('moveEvent changes the event year in state, clamped to the plan years', () => {
    const { result } = renderHook(() => usePlan('baseline'));
    act(() => ready(result.current).moveEvent('ev-buy-home', 2031.4));
    expect(ready(result.current).tables.events.find((e) => e.id === 'ev-buy-home')!.year).toBe(2031);
    expect(ready(result.current).chart.markers.find((m) => m.id === 'ev-buy-home')!.year).toBe(2031);
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
    act(() => ready(result.current).moveEvent('ev-buy-home', 2030));
    expect(ready(result.current)).toMatchObject({ saveState: 'saving', saveLabel: 'Saving…' });
    act(() => void vi.advanceTimersByTime(AUTOSAVE_MS - 1));
    expect(ready(result.current).saveState).toBe('saving');
    act(() => void vi.advanceTimersByTime(1));
    expect(ready(result.current)).toMatchObject({ saveState: 'saved', saveLabel: 'Saved just now' });
  });

  it('setDisplay("future") grows the values by inflation', () => {
    const { result } = renderHook(() => usePlan('baseline'));
    act(() => ready(result.current).setDisplay('future'));
    const vm = ready(result.current);
    expect(vm.display.value).toBe('future');
    // Retirement is the end of 2061, 12 × 36 − 10 = 422 months after asOf November 2026:
    // 936,904.28 × 1.03^(422/12) = 936,904.28 × 2.827759 = 2,649,339.57.
    expect(vm.kpis[1]!.value).toBe('$2,649,340');
  });
});

describe('useScenarios', () => {
  it('lists the two fixture scenarios, the first active, and can compare', () => {
    const { result } = renderHook(() => useScenarios());
    expect(result.current.items.map((s) => [s.id, s.name, s.active])).toEqual([
      ['baseline', 'Baseline', true],
      ['with-kid', 'Baseline + a kid', false],
    ]);
    expect(result.current.canCompare).toBe(true);
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

  it('add(type) creates the event with its defaults and opens the editor on it', () => {
    const catalog = renderHook(() => useEventCatalog());
    const plan = renderHook(() => usePlan('baseline'));
    let id: string | null = null;
    act(() => void (id = catalog.result.current.add('haveKid')));
    expect(id).not.toBeNull();
    expect(catalog.result.current.openEventId).toBe(id);
    const row = ready(plan.result.current).tables.events.find((e) => e.id === id)!;
    expect(row).toMatchObject({ type: 'haveKid', year: 2027, enabled: true });
    // Dallas County infant childcare in the demo ZIP's area data.
    expect(row.summary).toMatch(/^\$\d[\d,]* a month of childcare for 5 years$/);
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
