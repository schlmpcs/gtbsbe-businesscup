// @vitest-environment jsdom
// useEventEditor, useAssumptions, useCompare, useChanceOfSuccess, usePlanMoves, useAiLine on the demo
// fixtures (resetPlanStore pins the demo profile at asOf 2026-11, accounts.demo.json, ZIP 75206): the
// real engine, no network (the forecast route is mocked), Monte Carlo through the worker's own handler.
//
// A today's-dollar amount at a plan event keeps its value but for one month of inflation: a $10,000
// windfall in 2027 is 10,000 ÷ 1.03^(1/12) = 9,975.40 in today's dollars, and in cash (3% yield = 3%
// inflation) it keeps that value until it is spent or invested.
import { monteCarlo } from '@lifeguessr/engine';
import type { Forecast, ForecastBundle } from '@lifeguessr/types';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { monteCarloDemo, scenarioDemo } from '@/fixtures';
import { useAppStore } from '@/state/store';
import { mockForecastRoute } from '@/test/forecastApi';
import { handleMonteCarloMessage } from './monteCarlo.worker';
import { fixturePlanInputs } from './planInputs';
import { resetPlanStore, usePlanStore } from './planStore';
import type { EventEditorVM, PlanVM } from './types';
import { aiBandSettings, useAiLine } from './useAiLine';
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
/** Lets queued work finish: a Monte Carlo job runs in a microtask where there is no Worker (jsdom). */
const settle = () =>
  act(async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  });

describe('useEventEditor', () => {
  it('buyHome: fields carry values, sources and estimate tags', () => {
    const { result } = renderHook(() => useEventEditor('ev-buy-home'));
    const vm = ready(result.current);
    expect(vm.title).toBe('Buy a home');
    expect(field(vm, 'homeValue')).toMatchObject({ value: 375000, display: '$375,000' });
    expect(field(vm, 'homeValue').source).toBeDefined();
    expect(field(vm, 'rate')).toMatchObject({ kind: 'rate', display: '7.11%' });
    // Insurance is the area's estimate until the person types a number.
    expect(field(vm, 'insuranceMonthly')).toMatchObject({ value: 292.82, isEstimate: true });
    act(() => ready(result.current).update('insuranceMonthly', 310));
    expect(field(result.current, 'insuranceMonthly')).toMatchObject({ value: 310, isEstimate: false });
  });

  it('down payment % and $ stay in sync, both ways', () => {
    const { result } = renderHook(() => useEventEditor('ev-buy-home'));
    // 75,000 / 375,000 = 0.20
    expect(ready(result.current).downPaymentPct).toBeCloseTo(0.2, 10);
    expect(ready(result.current).downPaymentPctLabel).toBe('20%');
    // 25% of 375,000 = 93,750
    act(() => ready(result.current).update('downPaymentPct', 0.25));
    expect(field(result.current, 'downPayment')).toMatchObject({ value: 93750, display: '$93,750' });
    expect(ready(result.current).downPaymentPct).toBeCloseTo(0.25, 10);
    // $37,500 / 375,000 = 0.10
    act(() => ready(result.current).update('downPayment', 37500));
    expect(ready(result.current).downPaymentPct).toBeCloseTo(0.1, 10);
    expect(ready(result.current).downPaymentPctLabel).toBe('10%');
    // A new price keeps the dollars: 37,500 / 800,000 = 0.046875
    act(() => ready(result.current).update('homeValue', 800000));
    expect(field(result.current, 'downPayment').value).toBe(37500);
    expect(ready(result.current).downPaymentPct).toBeCloseTo(0.046875, 10);
    // More than the price is capped at the price (100%).
    act(() => ready(result.current).update('downPayment', 900000));
    expect(ready(result.current).downPaymentPct).toBe(1);
  });

  it('breakdown: monthly payment, tax and insurance, and it follows the down payment', () => {
    const { result } = renderHook(() => useEventEditor('ev-buy-home'));
    // Loan 375,000 − 75,000 = 300,000 at 7.11% for 30 years: r = 0.0711/12 = 0.005925, n = 360,
    // payment = 300,000 × r / (1 − (1 + r)^−360) = 2,018.12.
    // Tax 375,000 × 0.01625 / 12 = 507.81; insurance 292.82; total 2,818.75.
    const b = ready(result.current).breakdown!;
    expect(b.lines.map((l) => l.key)).toEqual(['principalAndInterest', 'propertyTax', 'insurance']);
    expect(b.lines[0]!.amount).toBeCloseTo(2018.12, 1);
    expect(b.lines[1]!.amount).toBeCloseTo(507.81, 2);
    expect(b.total).toBeCloseTo(2818.75, 1);
    expect(b.totalLabel).toBe('$2,819');
    // Paying cash leaves no loan: total = tax + insurance = 507.81 + 292.82 = 800.63.
    act(() => ready(result.current).update('payCash', true));
    expect(ready(result.current).breakdown!.total).toBeCloseTo(800.63, 2);
  });

  it('preview: with vs without the event, and it changes when the event changes', () => {
    const catalog = renderHook(() => useEventCatalog());
    let id = '';
    act(() => void (id = catalog.result.current.add('windfall')!));
    const { result } = renderHook(() => useEventEditor(id));
    // A $10,000 windfall in 2027 is 9,975.40 in today's dollars and waits in cash until the home's down
    // payment in January 2033, where it replaces that much of the draw from investments. Those dollars then
    // stay invested at 6% for the 347 months to the end of 2061 (February 2033 … December 2061), against 3%
    // inflation: 9,975.40 × (1.06 / 1.03)^(347/12) = 9,975.40 × 2.293779 = 22,881.36.
    // Without: 936,904.28 (plan.demo.json); with: 936,904.28 + 22,881.36 = 959,785.64.
    const row = (r: EventEditorVM) => ready(r).preview.rows.find((x) => x.id === 'netWorthAtRetirement')!;
    expect(row(result.current)).toMatchObject({ withLabel: '$959,786', withoutLabel: '$936,904', deltaLabel: '+$22,881', tone: 'good' });
    // 25,000 ÷ 1.03^(1/12) = 24,938.49; × 2.293779 = 57,203.39.
    act(() => ready(result.current).update('amount', 25000));
    expect(row(result.current).deltaLabel).toBe('+$57,203');
    expect(ready(result.current).preview.series).toHaveLength(59);
    // Turning the eye off keeps the preview of what the event would do.
    act(() => ready(result.current).toggleEnabled());
    expect(ready(result.current).enabled).toBe(false);
    expect(row(result.current).deltaLabel).toBe('+$57,203');
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
    expect(result.current.savingsSplit).toEqual([
      { group: 'cash', label: 'Cash', share: 0.3, shareLabel: '30%' },
      { group: 'investments', label: 'Investments', share: 0.4, shareLabel: '40%' },
      { group: 'retirement', label: 'Retirement', share: 0.3, shareLabel: '30%' },
    ]);
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
    // Baseline at retirement: 936,904.28 (plan.demo.json); with the kid: 594,952.17 (plan() of
    // scenario.alt.json, which runs short from 39); 936,904.28 − 594,952.17 = 341,952.11. That is more than
    // the kid's 233,464.41 of costs (next test): the money would otherwise have been invested at 6%.
    expect(vm.diffTable[0]).toMatchObject({ id: 'netWorthAtRetirement', aLabel: '$936,904', bLabel: '$594,952', diffLabel: '+$341,952', tone: 'good' });
    expect(vm.sentenceData).toEqual({ aName: 'Baseline', bName: 'Baseline + a kid', age: 67, direction: 'higher', diffLabel: '$341,952' });
    expect(vm.sentence).toBe('Baseline leaves you $341,952 better off than Baseline + a kid at age 67.');
    expect(vm.series).toHaveLength(59);
    expect(vm.series[0]).toMatchObject({ year: 2026, age: 32 });
    expect(vm.series[3]!.a).toBe(vm.series[3]!.b); // 2029: the kid arrives in 2030
    expect(vm.series[4]!.a).toBeGreaterThan(vm.series[4]!.b);
    act(() => vm.swap());
    if (result.current.status !== 'ready') throw new Error('compare not ready');
    expect(result.current.a.id).toBe('with-kid');
    expect(result.current.diffTable[0]!.diffLabel).toBe('−$341,952');
    expect(result.current.sentenceData.direction).toBe('lower');
  });

  it('when both plans run short before the kid, the difference is exactly what the kid costs', () => {
    // Test-local pair: the sample's two scenarios with every dollar saved going to cash and the home bought in
    // 2029. The $75,000 down payment then empties cash and the 401(k) in 2029, so both run short from 35,
    // before the kid arrives in 2030. From then on the kid's costs only take from cash (3% yield = 3%
    // inflation) or add to the shortfall (which grows with inflation), so in today's dollars they come off
    // net worth one for one: 840.67 × 12 × 5 years of childcare + 850 × 12 × 18 years of other costs =
    // 50,440.20 + 183,600 = 234,040.20, less one month of inflation: ÷ 1.03^(1/12) = 233,464.41.
    usePlanStore.setState((s) => ({
      scenarios: s.scenarios.map((sc) => ({
        ...sc,
        assumptions: { ...sc.assumptions, savingsSplit: [{ group: 'cash', share: 1 }] },
        events: sc.events.map((e) => (e.type === 'buyHome' ? { ...e, year: 2029 } : e)),
      })),
    }));
    const { result } = renderHook(() => useCompare('baseline', 'with-kid'));
    if (result.current.status !== 'ready') throw new Error('compare not ready');
    const vm = result.current;
    // Baseline at retirement 875,318.86; with the kid 875,318.86 − 233,464.41 = 641,854.45 (plan(): 641,854.44).
    expect(vm.diffTable[0]).toMatchObject({ id: 'netWorthAtRetirement', aLabel: '$875,319', bLabel: '$641,854', diffLabel: '+$233,464', tone: 'good' });
    expect(vm.sentenceData).toEqual({ aName: 'Baseline', bName: 'Baseline + a kid', age: 67, direction: 'higher', diffLabel: '$233,464' });
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
  it('idle until run(); run() is running, then done with monteCarlo.demo.json', async () => {
    const { result } = renderHook(() => useChanceOfSuccess());
    expect(result.current.status).toBe('idle');
    expect(result.current.result).toBeNull();
    expect(result.current.idleMessage).not.toBe('');
    act(() => result.current.run());
    expect(result.current.status).toBe('running');
    await settle();
    expect(result.current.status).toBe('done');
    const r = result.current.result!;
    // monteCarlo.demo.json has the same inputs and settings: 832 of 1,000 paths work (successRate 0.832,
    // stored to two decimals as 0.83; at least GOOD_SUCCESS_RATE 80%, so the tone is good); seed 42, 59 band
    // years, every ⌈1,000 / 200⌉ = 5th path drawn: 200 sample paths.
    expect(monteCarloDemo.successRate).toBe(0.83);
    expect(r).toMatchObject({ gaugePct: 83, gaugeLabel: '83%', pathsLabel: '832 of 1,000 paths work', paths: 1000, seed: 42, tone: 'good' });
    expect(r.bands).toHaveLength(59);
    expect(r.bands[0]!.p50).toBeCloseTo(monteCarloDemo.bands[0]!.p50, 2);
    expect(r.samplePaths).toHaveLength(200);
    expect(r.samplePaths[0]!.points).toHaveLength(59);
    expect(r.histograms.map((h) => h.id)).toEqual(['atRetirement', 'atEnd', 'shortfallAge']);
  });

  it('a plan that runs short in every path: the Compare pair (Baseline + a kid) gauges 0%, tone bad', async () => {
    // scenario.alt.json runs short from 39 on the plan line (usePlan.test.ts); with the default settings
    // (inflation 3% ± 2%, seed 42) it runs short in every one of the 1,000 paths, all by age 39 or so.
    usePlanStore.setState({ activeId: 'with-kid' });
    const { result } = renderHook(() => useChanceOfSuccess());
    act(() => result.current.run());
    await settle();
    expect(result.current.status).toBe('done');
    const r = result.current.result!;
    expect(r).toMatchObject({ gaugePct: 0, gaugeLabel: '0%', pathsLabel: '0 of 1,000 paths work', successfulPaths: 0, tone: 'bad' });
    expect(r.samplePaths.every((p) => !p.success)).toBe(true);
    const shortfall = r.histograms.find((h) => h.id === 'shortfallAge')!;
    expect(shortfall.bins.reduce((n, b) => n + b.count, 0)).toBe(1000);
  });

  it('worker: the same seed twice gives the same gauge %', async () => {
    // Without the home the plan almost never runs short; with "success needs at least $800,000" at 90 (about
    // the median end net worth, $816,000), the gauge lands between 0% and 100%, so the draws decide it.
    const editor = renderHook(() => useEventEditor('ev-buy-home'));
    act(() => ready(editor.result.current).toggleEnabled());
    const { result } = renderHook(() => useChanceOfSuccess());
    act(() => result.current.updateSettings({ endThreshold: 800_000 }));
    act(() => result.current.run());
    await settle();
    const first = result.current.result!;
    act(() => result.current.run());
    expect(result.current.status).toBe('running');
    await settle();
    const second = result.current.result!;
    expect(first.seed).toBe(42);
    expect(second.gaugePct).toBe(first.gaugePct);
    expect(first.gaugePct).toBeGreaterThan(0);
    expect(first.gaugePct).toBeLessThan(100);
    // The worker's own message handler gives the same for that seed.
    const { scenarios, activeId, chanceSettings } = usePlanStore.getState();
    const req = { kind: 'monteCarlo' as const, inputs: fixturePlanInputs(), scenario: scenarios.find((s) => s.id === activeId)!, settings: chanceSettings };
    const a = handleMonteCarloMessage(req);
    const b = handleMonteCarloMessage(req);
    if (a.kind !== 'monteCarlo' || b.kind !== 'monteCarlo') throw new Error('no Monte Carlo result');
    expect(b.result.successRate).toBe(a.result.successRate);
    expect(Math.round(a.result.successRate * 100)).toBe(first.gaugePct);
  });

  it('settings: defaults, hints, clamping; a change drops the result; fixed seed toggles', async () => {
    const { result } = renderHook(() => useChanceOfSuccess());
    expect(result.current.settings).toMatchObject({ paths: 1000, fixedSeed: true, seed: 42, inflation: { mean: 0.03, sd: 0.02 }, endThreshold: 0 });
    expect(result.current.settings.fields.find((f) => f.key === 'paths')!.hint).toMatch(/1,000/);
    act(() => result.current.run());
    await settle();
    act(() => result.current.updateSettings({ paths: 99999 }));
    expect(result.current.settings.paths).toBe(5000);
    expect(result.current.status).toBe('idle');
    expect(result.current.result).toBeNull();
    act(() => result.current.setFixedSeed(false));
    expect(result.current.settings).toMatchObject({ fixedSeed: false, seed: null });
    act(() => result.current.setFixedSeed(true));
    expect(result.current.settings).toMatchObject({ fixedSeed: true, seed: 42 });
  });

  it('editing the plan drops the result too', async () => {
    const chance = renderHook(() => useChanceOfSuccess());
    const plan = renderHook(() => usePlan('baseline'));
    act(() => chance.result.current.run());
    await settle();
    expect(chance.result.current.status).toBe('done');
    act(() => (plan.result.current as Extract<PlanVM, { status: 'ready' }>).moveEvent('ev-buy-home', 2030));
    expect(chance.result.current.status).toBe('idle');
  });
});

describe('usePlanMoves', () => {
  beforeEach(() => useAppStore.getState().uncommitMove());

  it('top moves ranked by the effect at retirement, then the success-rate delta from the worker', async () => {
    const { result } = renderHook(() => usePlanMoves());
    // The demo profile has two candidates (moveCandidates): spend less on "other" and pay the card first;
    // both help. Effects are planMoveEffects on the demo plan (engine output, today's dollars).
    expect(result.current.moves.map((m) => m.id)).toEqual(['cutCategory:other', 'payCardFirst:card-1']);
    expect(result.current.moves[0]!.effectAtRetirementRaw).toBeCloseTo(59740.98, 2);
    expect(result.current.moves[1]!.effectAtRetirementRaw).toBeCloseTo(14433.45, 2);
    expect(result.current.moves[0]).toMatchObject({
      title: 'Spend less on everything else', effectAtRetirement: '+$59,741 at retirement',
      successRateStatus: 'measuring', successRateDeltaRaw: 0, added: false, tone: 'good',
    });
    expect(result.current.moves.every((m) => m.explanation.length > 0)).toBe(true);
    // Same seed with and without each move (engine output): the plan works in 832 of 1,000 paths; spending
    // less on "other" lifts that by 11 points, paying the card first by 2.
    await settle();
    expect(result.current.moves.map((m) => [m.id, m.successRateStatus, m.successRateDelta])).toEqual([
      ['cutCategory:other', 'done', '+11 pts chance of success'],
      ['payCardFirst:card-1', 'done', '+2 pts chance of success'],
    ]);
    expect(result.current.moves[0]!.successRateDeltaRaw).toBeCloseTo(0.11, 10);
    expect(result.current.moves[1]!.successRateDeltaRaw).toBeCloseTo(0.02, 10);
  });

  it('on a plan that runs short in every path, the moves leave the chance at 0% (0 pts)', async () => {
    // The Compare pair (Baseline + a kid) runs short in all 1,000 paths, with each move too (0% → 0%).
    usePlanStore.setState({ activeId: 'with-kid' });
    const { result } = renderHook(() => usePlanMoves());
    expect(result.current.moves.map((m) => m.id)).toEqual(['cutCategory:other', 'payCardFirst:card-1']);
    await settle();
    expect(result.current.moves.map((m) => [m.successRateStatus, m.successRateDelta, m.successRateDeltaRaw])).toEqual([
      ['done', '0 pts chance of success', 0],
      ['done', '0 pts chance of success', 0],
    ]);
  });

  it('addToPlan commits the move (as on the forecast screen); the effect stays the same', () => {
    const moves = renderHook(() => usePlanMoves());
    const effect = moves.result.current.moves[1]!.effectAtRetirementRaw;
    act(() => moves.result.current.addToPlan('payCardFirst:card-1'));
    expect(moves.result.current.moves.find((m) => m.id === 'payCardFirst:card-1')).toMatchObject({ added: true, effectAtRetirementRaw: effect });
    expect(useAppStore.getState().committedMove?.id).toBe('payCardFirst:card-1');
    // Adding twice keeps one committed move.
    act(() => moves.result.current.addToPlan('payCardFirst:card-1'));
    expect(moves.result.current.moves.filter((m) => m.added)).toHaveLength(1);
  });
});

describe('useAiLine', () => {
  /**
   * An AI forecast (nominal dollars, months 0–120 from asOf November 2026): month 0 = `today`, and at each
   * plan year's last month m = 12 × (i + 1) − 10 (2026 → 2, …, 2035 → 110) the value `at(i)` in today's
   * dollars grown by 1.03^(m/12); straight lines in between, flat after month 110.
   */
  function aiBundle(today: number, at: (i: number) => number): ForecastBundle {
    const knots = [{ m: 0, v: today }, ...Array.from({ length: 10 }, (_, i) => {
      const m = 12 * (i + 1) - 10;
      return { m, v: at(i) * 1.03 ** (m / 12) };
    })];
    const points = Array.from({ length: 121 }, (_, month) => {
      const k = knots.findIndex((x) => x.m >= month);
      let mid: number;
      if (k === -1) mid = knots[knots.length - 1]!.v;
      else if (k === 0) mid = knots[0]!.v;
      else {
        const lo = knots[k - 1]!;
        const hi = knots[k]!;
        mid = lo.v + ((hi.v - lo.v) * (month - lo.m)) / (hi.m - lo.m);
      }
      return { month, low: mid, mid, high: mid };
    });
    const base: Forecast = { points, in10y: points[120]!, todaysDollars: false };
    return { source: 'ai', model: 'test-model', base, scenarios: {} };
  }
  // Today's net worth of the demo accounts: 1,300 + 2,500 + 14,500 − 6,400 − 17,800 = −5,900 (the car is excluded).
  const TODAY = -5900;
  // The band the hook checks against: the demo scenario, seed 42, 300 paths (what the worker runs).
  const band = () => {
    const { profile, accounts, area } = fixturePlanInputs();
    return monteCarlo(profile, accounts, scenarioDemo, aiBandSettings(scenarioDemo), area).bands;
  };

  it("an in-band forecast is shown, labeled 'AI estimate', in the plan's years and today's dollars", async () => {
    vi.useRealTimers();
    const b = band();
    const route = mockForecastRoute(() => aiBundle(TODAY, (i) => b[i]!.p50));
    const { result } = renderHook(() => useAiLine());
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('shown'));
    expect(result.current.label).toBe('AI estimate');
    // 2026 … 2035: the plan years whose last month is within the 120 forecast months.
    expect(result.current.points!.map((p) => p.year)).toEqual(Array.from({ length: 10 }, (_, i) => 2026 + i));
    result.current.points!.forEach((p, i) => expect(p.netWorth).toBeCloseTo(b[i]!.p50, 6));
    expect(route.calls).toHaveLength(1);
  });

  it('a forecast outside the p5–p95 band is rejected and hidden', async () => {
    vi.useRealTimers();
    const b = band();
    // 2031 at twice the band's |p95| plus $100,000: above the band whatever its sign.
    mockForecastRoute(() => aiBundle(TODAY, (i) => (i === 5 ? 2 * Math.abs(b[i]!.p95!) + 100_000 : b[i]!.p50)));
    const { result } = renderHook(() => useAiLine());
    await waitFor(() => expect(result.current.status).toBe('rejected'));
    expect(result.current).toMatchObject({ label: 'AI estimate', reason: 'outsideBand' });
    expect(result.current.reasonMessage).toMatch(/range/);
    expect(result.current.points).toBeUndefined();
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
