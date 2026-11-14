// @vitest-environment jsdom
// useEventEditor, useAssumptions, useCompare, useChanceOfSuccess, usePlanMoves, useAiLine on the MP2
// fixtures: no network, no engine, no worker (those are MP7b).
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetPlanStore, usePlanStore } from './planStore';
import type { EventEditorVM, PlanVM } from './types';
import { useAiLine } from './useAiLine';
import { useAssumptions } from './useAssumptions';
import { useChanceOfSuccess } from './useChanceOfSuccess';
import { useCompare } from './useCompare';
import { useEventCatalog } from './useEventCatalog';
import { useEventEditor } from './useEventEditor';
import { usePlan } from './usePlan';
import { usePlanMoves } from './usePlanMoves';

beforeEach(() => {
  resetPlanStore();
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function ready(vm: EventEditorVM) {
  if (vm.status !== 'ready') throw new Error('editor not ready');
  return vm;
}
const field = (vm: EventEditorVM, key: string) => ready(vm).fields.find((f) => f.key === key)!;

describe('useEventEditor', () => {
  it('buyHome: fields carry values, sources and estimate tags', () => {
    const { result } = renderHook(() => useEventEditor('ev-buy-home'));
    const vm = ready(result.current);
    expect(vm.title).toBe('Buy a home');
    expect(field(vm, 'homeValue')).toMatchObject({ value: 615400, display: '$615,400' });
    expect(field(vm, 'homeValue').source).toBeDefined();
    expect(field(vm, 'rate')).toMatchObject({ kind: 'rate', display: '6.5%' });
    // Insurance is the area's estimate until the person types a number.
    expect(field(vm, 'insuranceMonthly')).toMatchObject({ value: 292.82, isEstimate: true });
    act(() => ready(result.current).update('insuranceMonthly', 310));
    expect(field(result.current, 'insuranceMonthly')).toMatchObject({ value: 310, isEstimate: false });
  });

  it('down payment % and $ stay in sync, both ways', () => {
    const { result } = renderHook(() => useEventEditor('ev-buy-home'));
    // 123,080 / 615,400 = 0.20
    expect(ready(result.current).downPaymentPct).toBeCloseTo(0.2, 10);
    expect(ready(result.current).downPaymentPctLabel).toBe('20%');
    // 25% of 615,400 = 153,850
    act(() => ready(result.current).update('downPaymentPct', 0.25));
    expect(field(result.current, 'downPayment')).toMatchObject({ value: 153850, display: '$153,850' });
    expect(ready(result.current).downPaymentPct).toBeCloseTo(0.25, 10);
    // $61,540 / 615,400 = 0.10
    act(() => ready(result.current).update('downPayment', 61540));
    expect(ready(result.current).downPaymentPct).toBeCloseTo(0.1, 10);
    expect(ready(result.current).downPaymentPctLabel).toBe('10%');
    // A new price keeps the dollars: 61,540 / 800,000 = 0.076925
    act(() => ready(result.current).update('homeValue', 800000));
    expect(field(result.current, 'downPayment').value).toBe(61540);
    expect(ready(result.current).downPaymentPct).toBeCloseTo(0.076925, 10);
    // More than the price is capped at the price (100%).
    act(() => ready(result.current).update('downPayment', 900000));
    expect(ready(result.current).downPaymentPct).toBe(1);
  });

  it('breakdown: monthly payment, tax and insurance, and it follows the down payment', () => {
    const { result } = renderHook(() => useEventEditor('ev-buy-home'));
    // Loan 615,400 − 123,080 = 492,320 at 6.5% for 30 years: r = 0.065/12, n = 360,
    // payment = 492,320 × r / (1 − (1 + r)^−360) = 3,111.80.
    // Tax 615,400 × 0.01625 / 12 = 833.35; insurance 292.82; total 4,237.97.
    const b = ready(result.current).breakdown!;
    expect(b.lines.map((l) => l.key)).toEqual(['principalAndInterest', 'propertyTax', 'insurance']);
    expect(b.lines[0]!.amount).toBeCloseTo(3111.8, 1);
    expect(b.lines[1]!.amount).toBeCloseTo(833.35, 2);
    expect(b.total).toBeCloseTo(4237.97, 1);
    expect(b.totalLabel).toBe('$4,238');
    // Paying cash leaves no loan: total = tax + insurance = 1,126.17.
    act(() => ready(result.current).update('payCash', true));
    expect(ready(result.current).breakdown!.total).toBeCloseTo(1126.17, 2);
  });

  it('preview: with vs without the event, and it changes when the event changes', () => {
    const catalog = renderHook(() => useEventCatalog());
    let id = '';
    act(() => void (id = catalog.result.current.add('windfall')!));
    const { result } = renderHook(() => useEventEditor(id));
    // A $10,000 windfall in 2027 adds $10,000 to net worth at retirement (no growth in the placeholder plan).
    const row = (r: EventEditorVM) => ready(r).preview.rows.find((x) => x.id === 'netWorthAtRetirement')!;
    expect(row(result.current)).toMatchObject({ withLabel: '$119,000', withoutLabel: '$109,000', deltaLabel: '+$10,000', tone: 'good' });
    act(() => ready(result.current).update('amount', 25000));
    expect(row(result.current).deltaLabel).toBe('+$25,000');
    expect(ready(result.current).preview.series).toHaveLength(59);
    // Turning the eye off keeps the preview of what the event would do.
    act(() => ready(result.current).toggleEnabled());
    expect(ready(result.current).enabled).toBe(false);
    expect(row(result.current).deltaLabel).toBe('+$25,000');
  });

  it('remove deletes the event and closes the editor; an unknown id is notFound', () => {
    const catalog = renderHook(() => useEventCatalog());
    const plan = renderHook(() => usePlan('baseline'));
    let id = '';
    act(() => void (id = catalog.result.current.add('expense')!));
    const { result } = renderHook(() => useEventEditor(id));
    act(() => ready(result.current).remove());
    expect(result.current.status).toBe('notFound');
    expect(catalog.result.current.openEventId).toBeNull();
    const vm = plan.result.current as Extract<PlanVM, { status: 'ready' }>;
    expect(vm.tables.events.some((e) => e.id === id)).toBe(false);
    expect(renderHook(() => useEventEditor('nope')).result.current.status).toBe('notFound');
  });
});

describe('useAssumptions', () => {
  it('lists the fields with hints and sources', () => {
    const { result } = renderHook(() => useAssumptions());
    const f = (k: string) => result.current.fields.find((x) => x.key === k)!;
    expect(f('retireAge')).toMatchObject({ value: 67, display: '67' });
    expect(f('endAge').value).toBe(90);
    expect(f('inflation')).toMatchObject({ value: 0.03, display: '3%', hint: 'Most plans use 2–3%.' });
    expect(f('inflation').source).toBeDefined();
    expect(result.current.withdrawalOrder.map((w) => w.group)).toEqual(['cash', 'investments', 'retirement']);
    expect(result.current.savingsSplit).toEqual([{ group: 'cash', label: 'Cash', share: 1, shareLabel: '100%' }]);
  });

  it('update changes the assumption; retire age moves the Retire event', () => {
    const { result } = renderHook(() => useAssumptions());
    const plan = renderHook(() => usePlan('baseline'));
    act(() => result.current.update('inflation', 0.025));
    expect(result.current.fields.find((x) => x.key === 'inflation')!.display).toBe('2.5%');
    act(() => result.current.update('retireAge', 65)); // 2026 + (65 − 32) = 2059
    const vm = plan.result.current as Extract<PlanVM, { status: 'ready' }>;
    expect(vm.chart.markers.find((m) => m.id === 'ev-retire')!.year).toBe(2059);
    act(() => result.current.update('expensesMode', 'manual'));
    act(() => result.current.update('expensesMonthly', 4200));
    expect(result.current.fields.find((x) => x.key === 'expensesMonthly')).toMatchObject({ value: 4200, display: '$4,200' });
    act(() => result.current.updateGrowth('investments', 0.07));
    expect(result.current.growth.find((g) => g.group === 'investments')).toMatchObject({ override: 0.07, rateLabel: '7%' });
    act(() => result.current.updateGrowth('investments', null));
    expect(result.current.growth.find((g) => g.group === 'investments')!.override).toBeNull();
  });

  it('setSavingsSplit needs shares that add up to 100%; setWithdrawalOrder needs the same groups', () => {
    const { result } = renderHook(() => useAssumptions());
    let ok = true;
    act(() => void (ok = result.current.setSavingsSplit([{ group: 'cash', share: 0.5 }, { group: 'retirement', share: 0.4 }]))); // 0.9
    expect(ok).toBe(false);
    expect(result.current.error).toBe('savingsSplit');
    expect(result.current.errorMessage).toBe('Shares must add up to 100%.');
    act(() => void (ok = result.current.setSavingsSplit([{ group: 'cash', share: 0.6 }, { group: 'retirement', share: 0.4 }]))); // 1.0
    expect(ok).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.savingsSplit.map((s) => s.shareLabel)).toEqual(['60%', '40%']);
    act(() => void (ok = result.current.setWithdrawalOrder(['retirement', 'cash', 'investments'])));
    expect(ok).toBe(true);
    expect(result.current.withdrawalOrder.map((w) => w.group)).toEqual(['retirement', 'cash', 'investments']);
    act(() => void (ok = result.current.setWithdrawalOrder(['cash', 'cash', 'investments'])));
    expect(ok).toBe(false);
    expect(result.current.error).toBe('withdrawalOrder');
  });
});

describe('useCompare', () => {
  it('two series, the diff table and the sentence; swap flips them', () => {
    const { result } = renderHook(() => useCompare('baseline', 'with-kid'));
    if (result.current.status !== 'ready') throw new Error('compare not ready');
    const vm = result.current;
    // The kid costs 840.67 × 12 × 5 years of childcare + 850 × 12 × 18 years of other costs = 50,440.20 + 183,600 = 234,040.20
    // by retirement. Baseline at retirement: 109,000; with the kid: 109,000 − 234,040.20 = −125,040.20.
    expect(vm.diffTable[0]).toMatchObject({ id: 'netWorthAtRetirement', aLabel: '$109,000', bLabel: '−$125,040', diffLabel: '+$234,040', tone: 'good' });
    expect(vm.sentenceData).toEqual({ aName: 'Baseline', bName: 'Baseline + a kid', age: 67, direction: 'higher', diffLabel: '$234,040' });
    expect(vm.sentence).toBe('Baseline leaves you $234,040 better off than Baseline + a kid at age 67.');
    expect(vm.series).toHaveLength(59);
    expect(vm.series[0]).toMatchObject({ year: 2026, a: -3213.62, b: -3213.62 }); // the kid arrives in 2030
    act(() => vm.swap());
    if (result.current.status !== 'ready') throw new Error('compare not ready');
    expect(result.current.a.id).toBe('with-kid');
    expect(result.current.diffTable[0]!.diffLabel).toBe('−$234,040');
    expect(result.current.sentenceData.direction).toBe('lower');
  });

  it('the same scenario twice reads as the same; unknown ids are notFound', () => {
    const same = renderHook(() => useCompare('baseline', 'baseline')).result.current;
    if (same.status !== 'ready') throw new Error('compare not ready');
    expect(same.sentenceData.direction).toBe('same');
    expect(same.diffTable.every((r) => r.tone === null)).toBe(true);
    expect(renderHook(() => useCompare('baseline', 'nope')).result.current.status).toBe('notFound');
  });
});

describe('useChanceOfSuccess', () => {
  it('idle until run(); run() is done with the fixture result', () => {
    const { result } = renderHook(() => useChanceOfSuccess());
    expect(result.current.status).toBe('idle');
    expect(result.current.result).toBeNull();
    expect(result.current.idleMessage).not.toBe('');
    act(() => result.current.run());
    expect(result.current.status).toBe('done');
    const r = result.current.result!;
    // monteCarlo.demo.json: successRate 0 of 1,000 paths, seed 42, 59 band years, 40 sample paths.
    expect(r).toMatchObject({ gaugePct: 0, gaugeLabel: '0%', pathsLabel: '0 of 1,000 paths work', paths: 1000, seed: 42, tone: 'bad' });
    expect(r.bands).toHaveLength(59);
    expect(r.samplePaths).toHaveLength(40);
    expect(r.samplePaths[0]!.points).toHaveLength(59);
    expect(r.histograms.map((h) => h.id)).toEqual(['atRetirement', 'atEnd', 'shortfallAge']);
  });

  it('settings: defaults, hints, clamping; a change drops the result; fixed seed toggles', () => {
    const { result } = renderHook(() => useChanceOfSuccess());
    expect(result.current.settings).toMatchObject({ paths: 1000, fixedSeed: true, seed: 42, inflation: { mean: 0.03, sd: 0.02 }, endThreshold: 0 });
    expect(result.current.settings.fields.find((f) => f.key === 'paths')!.hint).toMatch(/1,000/);
    act(() => result.current.run());
    act(() => result.current.updateSettings({ paths: 99999 }));
    expect(result.current.settings.paths).toBe(5000);
    expect(result.current.status).toBe('idle');
    expect(result.current.result).toBeNull();
    act(() => result.current.setFixedSeed(false));
    expect(result.current.settings).toMatchObject({ fixedSeed: false, seed: null });
    act(() => result.current.setFixedSeed(true));
    expect(result.current.settings).toMatchObject({ fixedSeed: true, seed: 42 });
  });

  it('editing the plan drops the result too', () => {
    const chance = renderHook(() => useChanceOfSuccess());
    const plan = renderHook(() => usePlan('baseline'));
    act(() => chance.result.current.run());
    act(() => (plan.result.current as Extract<PlanVM, { status: 'ready' }>).moveEvent('ev-buy-home', 2030));
    expect(chance.result.current.status).toBe('idle');
  });
});

describe('usePlanMoves', () => {
  it('top three moves ranked by the effect at retirement', () => {
    const { result } = renderHook(() => usePlanMoves());
    // $400 a month for 2027–2060 (34 years) = 163,200; $250 a month = 102,000; a $10,000 windfall = 10,000.
    expect(result.current.moves.map((m) => [m.id, m.effectAtRetirementRaw])).toEqual([
      ['move-extra-income', 163200], ['move-side-income', 102000], ['move-windfall', 10000],
    ]);
    expect(result.current.moves[0]).toMatchObject({ effectAtRetirement: '+$163,200 at retirement', successRateDelta: '+6 pts chance of success', added: false, tone: 'good' });
    expect(result.current.moves.every((m) => m.explanation.length > 0)).toBe(true);
  });

  it('addToPlan adds the move to the active scenario; the effect stays the same', () => {
    const moves = renderHook(() => usePlanMoves());
    const plan = renderHook(() => usePlan('baseline'));
    act(() => moves.result.current.addToPlan('move-windfall'));
    expect(moves.result.current.moves.find((m) => m.id === 'move-windfall')).toMatchObject({ added: true, effectAtRetirementRaw: 10000 });
    expect((plan.result.current as Extract<PlanVM, { status: 'ready' }>).tables.events.some((e) => e.id === 'ev-move-windfall')).toBe(true);
    // Adding twice does not duplicate it.
    act(() => moves.result.current.addToPlan('move-windfall'));
    expect(usePlanStore.getState().scenarios[0]!.events.filter((e) => e.id === 'ev-move-windfall')).toHaveLength(1);
  });
});

describe('useAiLine', () => {
  it('shows a labeled line from the fixture', () => {
    const { result } = renderHook(() => useAiLine());
    expect(result.current).toMatchObject({ status: 'shown', label: 'AI estimate' });
    expect(result.current.points).toHaveLength(59);
  });

  it('preview states: off, loading and rejected (with a reason)', () => {
    expect(renderHook(() => useAiLine({ status: 'off' })).result.current).toEqual({ status: 'off', label: 'AI estimate' });
    expect(renderHook(() => useAiLine({ status: 'loading' })).result.current.points).toBeUndefined();
    const rejected = renderHook(() => useAiLine({ status: 'rejected', reason: 'todayMismatch' })).result.current;
    expect(rejected).toMatchObject({ status: 'rejected', reason: 'todayMismatch', label: 'AI estimate' });
    expect(rejected.reasonMessage).toMatch(/today/);
    expect(rejected.points).toBeUndefined();
  });
});
