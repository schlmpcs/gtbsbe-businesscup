// @vitest-environment jsdom
// useEventEditor, useAssumptions, useCompare, useChanceOfSuccess, usePlanMoves, useAiLine on the engine:
// the demo profile at 2026-11 (ZIP 75206) and the demo scenarios. Expected numbers are worked by hand
// where the engine function is a formula (the mortgage payment) and otherwise come from the engine
// function itself (plan(), monteCarlo()), called here on the same inputs.
import { findArea } from '@lifeguessr/data/areas';
import { monteCarlo, plan } from '@lifeguessr/engine';
import type { PlanResult, Scenario } from '@lifeguessr/types';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stampProfile } from '@/state/profile';
import { useAppStore } from '@/state/store';
import { money, signedMoney } from './planFormat';
import { formatMoney } from '@/lib/format';
import { resetPlanStore, usePlanStore } from './planStore';
import type { EventEditorVM, PlanVM } from './types';
import { useAiLine } from './useAiLine';
import { useAssumptions } from './useAssumptions';
import { effectiveSettings, useChanceOfSuccess } from './useChanceOfSuccess';
import { useCompare } from './useCompare';
import { useEventCatalog } from './useEventCatalog';
import { useEventEditor } from './useEventEditor';
import { usePlan } from './usePlan';
import { usePlanMoves } from './usePlanMoves';

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

const demoProfile = () => stampProfile(useAppStore.getState().profile, '2026-11');
const area = () => findArea('75206')!;
const scenario = (id: string) => usePlanStore.getState().scenarios.find((s) => s.id === id)!;
const enginePlan = (s: Scenario): PlanResult => plan(demoProfile(), [], s, area());

function ready(vm: EventEditorVM) {
  if (vm.status !== 'ready') throw new Error('editor not ready');
  return vm;
}
const field = (vm: EventEditorVM, key: string) => ready(vm).fields.find((f) => f.key === key)!;

describe('useEventEditor', () => {
  it('buyHome: fields carry values; a default value shows its source, an own number does not', () => {
    const { result } = renderHook(() => useEventEditor('ev-buy-home'));
    const vm = ready(result.current);
    expect(vm.title).toBe('Buy a home');
    // $350,000 is the demo person's own price, not the ZIP's ACS median: no source.
    expect(field(vm, 'homeValue')).toMatchObject({ value: 350000, display: '$350,000' });
    expect(field(vm, 'homeValue').source).toBeUndefined();
    // Rate, tax and insurance are still the engine defaults: Freddie Mac PMMS, ACS and NAIC.
    expect(field(vm, 'rate')).toMatchObject({ kind: 'rate', display: '7.11%' });
    expect(field(vm, 'rate').source?.name).toMatch(/Freddie Mac/);
    expect(field(vm, 'propertyTaxRate').source).toEqual(area().propertyTaxRate!.source);
    expect(field(vm, 'insuranceMonthly')).toMatchObject({ value: 292.82, isEstimate: true });
    expect(field(vm, 'insuranceMonthly').source).toBeDefined();
    // Insurance is our estimate until the person types a number; then it is theirs and has no source.
    act(() => ready(result.current).update('insuranceMonthly', 310));
    expect(field(result.current, 'insuranceMonthly')).toMatchObject({ value: 310, isEstimate: false });
    expect(field(result.current, 'insuranceMonthly').source).toBeUndefined();
    // Back to the ZIP's median value: its ACS source shows.
    act(() => ready(result.current).update('homeValue', area().homeValueMedian!.value));
    expect(field(result.current, 'homeValue').source).toEqual(area().homeValueMedian!.source);
  });

  it('down payment % and $ stay in sync, both ways', () => {
    const { result } = renderHook(() => useEventEditor('ev-buy-home'));
    // 70,000 / 350,000 = 0.20
    expect(ready(result.current).downPaymentPct).toBeCloseTo(0.2, 10);
    expect(ready(result.current).downPaymentPctLabel).toBe('20%');
    // 25% of 350,000 = 87,500
    act(() => ready(result.current).update('downPaymentPct', 0.25));
    expect(field(result.current, 'downPayment')).toMatchObject({ value: 87500, display: '$87,500' });
    expect(ready(result.current).downPaymentPct).toBeCloseTo(0.25, 10);
    // $35,000 / 350,000 = 0.10
    act(() => ready(result.current).update('downPayment', 35000));
    expect(ready(result.current).downPaymentPct).toBeCloseTo(0.1, 10);
    expect(ready(result.current).downPaymentPctLabel).toBe('10%');
    // A new price keeps the dollars: 35,000 / 500,000 = 0.07
    act(() => ready(result.current).update('homeValue', 500000));
    expect(field(result.current, 'downPayment').value).toBe(35000);
    expect(ready(result.current).downPaymentPct).toBeCloseTo(0.07, 10);
    // More than the price is capped at the price (100%).
    act(() => ready(result.current).update('downPayment', 900000));
    expect(ready(result.current).downPaymentPct).toBe(1);
  });

  it('breakdown: the engine’s buyHomeBreakdown, and it follows the down payment', () => {
    const { result } = renderHook(() => useEventEditor('ev-buy-home'));
    // Loan 350,000 − 70,000 = 280,000 at 7.11% for 30 years: r = 0.0711/12 = 0.005925, n = 360,
    // payment = 280,000 × r / (1 − (1 + r)^−360) = 1,883.58.
    // Tax 350,000 × 0.01625 / 12 = 473.96; insurance 292.82; total 2,650.36.
    const b = ready(result.current).breakdown!;
    expect(b.lines.map((l) => l.key)).toEqual(['principalAndInterest', 'propertyTax', 'insurance']);
    expect(b.lines[0]!.amount).toBeCloseTo(1883.58, 1);
    expect(b.lines[1]!.amount).toBeCloseTo(473.96, 2);
    expect(b.total).toBeCloseTo(2650.36, 1);
    expect(b.totalLabel).toBe('$2,650');
    // Paying cash leaves no loan: total = tax + insurance = 766.78.
    act(() => ready(result.current).update('payCash', true));
    expect(ready(result.current).breakdown!.total).toBeCloseTo(766.78, 1);
  });

  it('preview: plan() with vs without the event, and it changes when the event changes', () => {
    const catalog = renderHook(() => useEventCatalog());
    let id = '';
    act(() => void (id = catalog.result.current.add('windfall')!));
    const { result } = renderHook(() => useEventEditor(id));
    const row = (r: EventEditorVM) => ready(r).preview.rows.find((x) => x.id === 'netWorthAtRetirement')!;
    const s = scenario('baseline');
    const withIt = enginePlan(s).kpis.netWorthAtRetirement;
    const without = enginePlan({ ...s, events: s.events.filter((e) => e.id !== id) }).kpis.netWorthAtRetirement;
    expect(row(result.current)).toMatchObject({ withLabel: money(withIt), withoutLabel: money(without), deltaLabel: signedMoney(withIt - without), tone: 'good' });
    // The $10,000 windfall in 2027 sits in cash (the scenario saves to cash), which earns less than
    // inflation: in today's dollars it is worth a little under $10,000 at retirement.
    expect(withIt - without).toBeGreaterThan(9_000);
    expect(withIt - without).toBeLessThan(10_000);
    const small = withIt - without;
    act(() => ready(result.current).update('amount', 25000));
    expect(ready(result.current).preview.rows[0]!.deltaLabel).not.toBe(signedMoney(small));
    expect(ready(result.current).preview.series).toHaveLength(59);
    // Turning the eye off keeps the preview of what the event would do.
    const on = row(result.current).deltaLabel;
    act(() => ready(result.current).toggleEnabled());
    expect(ready(result.current).enabled).toBe(false);
    expect(row(result.current).deltaLabel).toBe(on);
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
  it('lists the fields with hints, the area’s CPI source and the engine’s growth defaults', () => {
    const { result } = renderHook(() => useAssumptions());
    const f = (k: string) => result.current.fields.find((x) => x.key === k)!;
    expect(f('retireAge')).toMatchObject({ value: 67, display: '67' });
    expect(f('endAge').value).toBe(90);
    expect(f('inflation')).toMatchObject({ value: 0.03, display: '3%', hint: 'Most plans use 2–3%.' });
    expect(f('inflation').source).toEqual(area().cpiYoY.source);
    expect(result.current.withdrawalOrder.map((w) => w.group)).toEqual(['cash', 'investments', 'retirement']);
    expect(result.current.savingsSplit).toEqual([{ group: 'cash', label: 'Cash', share: 1, shareLabel: '100%' }]);
    const g = (k: string) => result.current.growth.find((x) => x.group === k)!;
    expect(g('investments').rate).toBe(0.06); // returnAnnualNominal
    expect(g('realEstate')).toMatchObject({ rate: area().homeAppreciationAnnual!.value, source: area().homeAppreciationAnnual!.source });
  });

  it('update changes the assumption; retire age moves the Retire event', () => {
    const { result } = renderHook(() => useAssumptions());
    const plan = renderHook(() => usePlan('baseline'));
    act(() => result.current.update('inflation', 0.025));
    expect(result.current.fields.find((x) => x.key === 'inflation')!.display).toBe('2.5%');
    act(() => result.current.update('retireAge', 65)); // 2026 + (65 − 32) = 2059
    const vm = plan.result.current as Extract<PlanVM, { status: 'ready' }>;
    expect(vm.chart.markers.find((m) => m.id === 'ev-retire')!.year).toBe(2059);
    expect(vm.kpis[1]!.label).toBe('At retirement (65)');
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
  it('two engine series, the diff table and the sentence; swap flips them', () => {
    const { result } = renderHook(() => useCompare('baseline', 'with-kid'));
    if (result.current.status !== 'ready') throw new Error('compare not ready');
    const vm = result.current;
    const a = enginePlan(scenario('baseline'));
    const b = enginePlan(scenario('with-kid'));
    const d = a.kpis.netWorthAtRetirement - b.kpis.netWorthAtRetirement;
    expect(d).toBeGreaterThan(0); // the kid costs money
    expect(vm.diffTable[0]).toMatchObject({
      id: 'netWorthAtRetirement', aLabel: money(a.kpis.netWorthAtRetirement), bLabel: money(b.kpis.netWorthAtRetirement), diffLabel: signedMoney(d), tone: 'good',
    });
    // With the kid in 2030 and the home in 2032, the plan runs short; without, it lasts past 90.
    expect(b.kpis.shortfallAge).not.toBeNull();
    expect(vm.diffTable[2]).toMatchObject({ aLabel: 'Past 90', bLabel: `Age ${b.kpis.shortfallAge}` });
    expect(vm.sentenceData).toEqual({ aName: 'Baseline', bName: 'Baseline + a kid', age: 67, direction: 'higher', diffLabel: money(d) });
    expect(vm.sentence).toBe(`Baseline leaves you ${money(d)} better off than Baseline + a kid at age 67.`);
    expect(vm.series).toHaveLength(59);
    expect(vm.series.map((x) => x.b)).toEqual(b.years.map((y) => y.netWorth));
    expect(vm.series[0]!.a).toBe(vm.series[0]!.b); // the kid arrives in 2030
    act(() => vm.swap());
    if (result.current.status !== 'ready') throw new Error('compare not ready');
    expect(result.current.a.id).toBe('with-kid');
    expect(result.current.diffTable[0]!.diffLabel).toBe(signedMoney(-d));
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
  it('idle until run(); run() is the engine’s monteCarlo() on the active scenario', () => {
    const { result } = renderHook(() => useChanceOfSuccess());
    expect(result.current.status).toBe('idle');
    expect(result.current.result).toBeNull();
    expect(result.current.idleMessage).not.toBe('');
    act(() => result.current.run());
    expect(result.current.status).toBe('running');
    act(() => void vi.advanceTimersByTime(0));
    expect(result.current.status).toBe('done');
    const r = result.current.result!;
    const settings = effectiveSettings(usePlanStore.getState().chanceSettings, scenario('baseline'), area());
    const mc = monteCarlo(demoProfile(), [], scenario('baseline'), settings, area());
    expect(r).toMatchObject({ gaugePct: Math.round(mc.successRate * 100), paths: 1000, seed: 42 });
    // The demo plan works in most paths (a $350,000 home in 2032 paid from savings).
    expect(r.gaugePct).toBeGreaterThanOrEqual(80);
    expect(r.tone).toBe('good');
    expect(r.bands).toHaveLength(59);
    expect(r.samplePaths).toHaveLength(200);
    expect(r.samplePaths[0]!.points).toHaveLength(59);
    expect(r.histograms.map((h) => h.id)).toEqual(['atRetirement', 'atEnd', 'shortfallAge']);
    // Each histogram marks the rules-based plan's own value (same display unit as the run).
    const kpis = plan(demoProfile(), [], scenario('baseline'), area()).kpis;
    expect(r.histograms.map((h) => h.planValue)).toEqual([kpis.netWorthAtRetirement, kpis.netWorthAtEnd, kpis.shortfallAge]);
    expect(r.histograms[0]!.planLabel).toBe(`Plan ${formatMoney(kpis.netWorthAtRetirement, { compact: true })}`);
    if (kpis.shortfallAge === null) expect(r.histograms[2]!.planLabel).toBe('Plan: lasts past 90');
    // Growth draws around the plan's own rates, so the median tracks plan().
    expect(result.current.settings.growth.map((g) => [g.group, g.mean, g.sd])).toEqual([
      ['investments', 0.06, 0.15], ['retirement', 0.06, 0.15], ['realEstate', area().homeAppreciationAnnual!.value, 0.05],
    ]);
  });

  it('a run that fails shows an error and no numbers', () => {
    const { result } = renderHook(() => useChanceOfSuccess());
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // A settings value monteCarlo() refuses (a non-finite end threshold) makes it throw.
    act(() => {
      const st = usePlanStore.getState();
      st.setChance({ chanceSettings: { ...st.chanceSettings, endThreshold: Number.NaN } });
    });
    act(() => result.current.run());
    act(() => void vi.advanceTimersByTime(0));
    expect(result.current.status).toBe('error');
    expect(result.current.result).toBeNull();
    expect(result.current.errorMessage).toMatch(/could not run/);
    spy.mockRestore();
  });

  it('settings: defaults, hints, clamping; a change drops the result; fixed seed toggles', () => {
    const { result } = renderHook(() => useChanceOfSuccess());
    expect(result.current.settings).toMatchObject({ paths: 1000, fixedSeed: true, seed: 42, inflation: { mean: 0.03, sd: 0.02 }, endThreshold: 0 });
    expect(result.current.settings.fields.find((f) => f.key === 'paths')!.hint).toMatch(/1,000/);
    act(() => result.current.run());
    act(() => void vi.advanceTimersByTime(0));
    act(() => result.current.updateSettings({ paths: 99999 }));
    expect(result.current.settings.paths).toBe(5000);
    expect(result.current.status).toBe('idle');
    expect(result.current.result).toBeNull();
    act(() => result.current.setFixedSeed(false));
    expect(result.current.settings).toMatchObject({ fixedSeed: false, seed: null });
    act(() => result.current.setFixedSeed(true));
    expect(result.current.settings).toMatchObject({ fixedSeed: true, seed: 42 });
  });

  it('editing the plan drops the result, and a run still pending is dropped too', () => {
    const chance = renderHook(() => useChanceOfSuccess());
    const plan = renderHook(() => usePlan('baseline'));
    act(() => chance.result.current.run());
    act(() => void vi.advanceTimersByTime(0));
    act(() => (plan.result.current as Extract<PlanVM, { status: 'ready' }>).moveEvent('ev-buy-home', 2033));
    expect(chance.result.current.status).toBe('idle');
    act(() => chance.result.current.run());
    act(() => (plan.result.current as Extract<PlanVM, { status: 'ready' }>).moveEvent('ev-buy-home', 2034));
    act(() => void vi.advanceTimersByTime(0));
    expect(chance.result.current.status).toBe('idle');
    expect(chance.result.current.result).toBeNull();
  });
});

describe('usePlanMoves', () => {
  it('the engine’s moves for the profile, ranked by plan() with vs without each at retirement', () => {
    const { result } = renderHook(() => usePlanMoves());
    const moves = result.current.moves;
    // The demo profile: a card at 24.36% and "everything else" $450 a month (the largest flexible line).
    expect(moves.map((m) => m.id)).toEqual(['cutCategory:other', 'payCardFirst:card-1']);
    const base = enginePlan(scenario('baseline')).kpis.netWorthAtRetirement;
    // cutCategory trims the line by cutCategoryShare (20%): 450 → 360.
    const p = demoProfile();
    const cut = plan({ ...p, spending: { ...p.spending, other: { value: 360, isEstimate: true } } }, [], scenario('baseline'), area());
    expect(moves[0]!.effectAtRetirementRaw).toBeCloseTo(cut.kpis.netWorthAtRetirement - base, 6);
    expect(moves[0]).toMatchObject({ title: 'Spend less on everything else', added: false, tone: 'good', successRateDelta: null });
    expect(moves[0]!.effectAtRetirement).toBe(`${signedMoney(moves[0]!.effectAtRetirementRaw)} at retirement`);
    expect(moves[0]!.effectAtRetirementRaw).toBeGreaterThan(moves[1]!.effectAtRetirementRaw);
    expect(moves.every((m) => m.explanation.length > 0)).toBe(true);
  });

  it('addToPlan adds the move to the active scenario: the plan moves by its effect, the profile does not change', () => {
    const moves = renderHook(() => usePlanMoves());
    const plan = renderHook(() => usePlan('baseline'));
    const ret = () => (plan.result.current as Extract<PlanVM, { status: 'ready' }>).kpis[1]!.raw as number;
    const before = ret();
    const effect = moves.result.current.moves[0]!.effectAtRetirementRaw;
    const profile = useAppStore.getState().profile;
    act(() => moves.result.current.addToPlan('cutCategory:other'));
    expect(ret()).toBeCloseTo(before + effect, 6);
    expect(useAppStore.getState().profile).toBe(profile);
    expect(moves.result.current.moves.find((m) => m.id === 'cutCategory:other')).toMatchObject({ added: true });
    expect(moves.result.current.moves.find((m) => m.id === 'cutCategory:other')!.effectAtRetirementRaw).toBeCloseTo(effect, 6);
    // Adding twice does not duplicate it; the other scenario is untouched.
    act(() => moves.result.current.addToPlan('cutCategory:other'));
    expect(usePlanStore.getState().movesApplied.baseline).toHaveLength(1);
    expect(usePlanStore.getState().movesApplied['with-kid']).toBeUndefined();
  });
});

describe('useAiLine', () => {
  it('is off by default: no line reaches a user as an AI estimate', () => {
    expect(renderHook(() => useAiLine()).result.current).toEqual({ status: 'off', label: 'AI estimate' });
  });

  it('preview shown: draws only the points it is given, labeled', () => {
    const points = [{ year: 2026, netWorth: -3000 }, { year: 2027, netWorth: 12000 }];
    const { result } = renderHook(() => useAiLine({ status: 'shown', points }));
    expect(result.current).toMatchObject({ status: 'shown', label: 'AI estimate', points });
    // Shown without points is off: nothing is drawn from a fixture.
    expect(renderHook(() => useAiLine({ status: 'shown' })).result.current).toEqual({ status: 'off', label: 'AI estimate' });
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
