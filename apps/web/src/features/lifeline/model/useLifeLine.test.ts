// @vitest-environment jsdom
// useLifeLine on the demo fixtures (resetPlanStore pins the demo profile at asOf 2026-11, accounts.demo.json,
// ZIP 75206 and scenario.demo.json with "Buy a home" in 2033, age 39): the real engine, no network. In
// jsdom there is no Worker, so the decision sweep runs in a microtask (monteCarloJob.ts).
import { buyHomeBreakdown, decisionSweep, eventAtYear, plan } from '@lifeguessr/engine';
import type { PlanEventOf, Scenario } from '@lifeguessr/types';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fixturePlanInputs } from '@/features/plan/model/planFixtures';
import { DEFAULT_CHANCE_SETTINGS, resetPlanStore, usePlanStore } from '@/features/plan/model/planStore';
import type { LifeLineVM } from './types';
import { DRAFT_EVENT_ID, homeDecision, LIFELINE_PATHS, niceStep, sweepYears, useLifeLine } from './useLifeLine';

beforeEach(() => resetPlanStore());
afterEach(() => cleanup());

function ready(vm: LifeLineVM) {
  if (vm.status !== 'ready') throw new Error('life line not ready');
  return vm;
}
const measured = (vm: LifeLineVM) => vm.status === 'ready' && vm.kpis.find((k) => k.id === 'chance')!.value !== null;

describe('helpers', () => {
  it('sweepYears: 4 years before to 8 after, from next year, before retiring', () => {
    expect(sweepYears(2033, 2026, 2061)).toEqual([2029, 2030, 2031, 2032, 2033, 2034, 2035, 2036, 2037, 2038, 2039, 2040, 2041]);
    expect(sweepYears(2028, 2026, 2031)).toEqual([2027, 2028, 2029, 2030]);
  });

  it('niceStep picks 1, 2 or 5 × 10^k', () => {
    expect(niceStep(1_900_000)).toBe(500_000);
    expect(niceStep(700_000)).toBe(200_000);
    expect(niceStep(0)).toBe(1);
  });

  it('a plan without "Buy a home" gets the engine default three years out, as a draft', () => {
    const inputs = fixturePlanInputs();
    const s = usePlanStore.getState().scenarios[0]!;
    const without: Scenario = { ...s, events: s.events.filter((e) => e.type !== 'buyHome') };
    const d = homeDecision(inputs, without);
    expect(d).toMatchObject({ eventId: DRAFT_EVENT_ID, inPlan: false, event: { type: 'buyHome', year: 2029 } });
    expect(d.scenario.events.at(-1)).toBe(d.event);
    expect(homeDecision(inputs, s)).toMatchObject({ eventId: 'ev-buy-home', inPlan: true, scenario: s });
  });
});

describe('useLifeLine', { timeout: 30_000 }, () => {
  it('at the plan year: the plan KPIs, no "before" line, then the Chance of success from the sweep', async () => {
    const { result } = renderHook(() => useLifeLine());
    const vm = ready(result.current);
    const inputs = fixturePlanInputs();
    const scenario = usePlanStore.getState().scenarios[0]!;
    const p = plan(inputs.profile, inputs.accounts, scenario, inputs.area);
    expect(vm.slider).toMatchObject({ value: 39, base: 39, min: 35, max: 47, titleNot: null });
    expect(vm.headline).toEqual({ lead: 'When should you buy a home?', payoff: null, payoffTone: 'neutral' });
    expect(vm.kpis[0]).toMatchObject({ id: 'atRetirement', label: 'Net worth at 67', was: null, delta: null });
    expect(vm.chart.selected).toEqual(p.years.map((y) => ({ age: y.age, netWorth: y.netWorth })));
    expect(vm.chart.before).toBeNull();
    expect(vm.kpis[1]).toMatchObject({ id: 'chance', value: null, note: 'Measuring…' });

    await waitFor(() => expect(measured(result.current)).toBe(true), { timeout: 20_000 });
    const [point] = decisionSweep(inputs.profile, inputs.accounts, scenario, 'ev-buy-home', [2033], inputs.area,
      { ...DEFAULT_CHANCE_SETTINGS, paths: LIFELINE_PATHS, seed: usePlanStore.getState().fixedSeed });
    const done = ready(result.current);
    expect(done.kpis[1]!.gaugePct).toBe(Math.round(point!.chance!.successRate * 100));
    expect(done.chart.band).toHaveLength(p.years.length);
    expect(done.house.art).toBe(point!.chance!.successRate >= 0.8 ? 'home-large' : 'house-build');
  });

  it('dragging to 35: the plan with the home in 2029 vs 2033, money runs out at 35, house under construction', async () => {
    const { result } = renderHook(() => useLifeLine());
    await waitFor(() => expect(measured(result.current)).toBe(true), { timeout: 20_000 });
    act(() => ready(result.current).setAge(35));
    const vm = ready(result.current);
    const inputs = fixturePlanInputs();
    const scenario = usePlanStore.getState().scenarios[0]!;
    const moved = plan(inputs.profile, inputs.accounts, eventAtYear(scenario, 'ev-buy-home', 2029), inputs.area);
    expect(moved.kpis.shortfallAge).toBe(35);
    expect(vm.chart.selected).toEqual(moved.years.map((y) => ({ age: y.age, netWorth: y.netWorth })));
    expect(vm.chart.before).not.toBeNull();
    expect(vm.headline.lead).toBe('Buy a home 4 years sooner');
    expect(vm.headline.payoffTone).toBe('bad');
    expect(vm.kpis[2]).toMatchObject({ id: 'runsOut', value: 'at 35', was: 'Never', delta: 'new', tone: 'bad' });
    expect(vm.chart.runsOut).toMatchObject({ age: 35, line: 'selected' });
    expect(vm.slider.titleNot).toBe(', not 39');
    expect(vm.house.art).toBe('house-build');
    const ev = scenario.events.find((e) => e.id === 'ev-buy-home') as PlanEventOf<'buyHome'>;
    expect(vm.slider.facts.map((f) => f.label)).toContain(`Payment $${Math.round(buyHomeBreakdown(ev).total).toLocaleString('en-US')}/mo with tax and insurance`);
  });

  it('"Put it in my plan" moves the event in the scenario and the slider settles on it', async () => {
    const { result } = renderHook(() => useLifeLine());
    act(() => ready(result.current).setAge(41));
    expect(ready(result.current).apply).toEqual({ label: 'Put "buy at 41" in my plan', done: false });
    act(() => ready(result.current).applyToPlan());
    const s = usePlanStore.getState().scenarios[0]!;
    expect(s.events.find((e) => e.id === 'ev-buy-home')!.year).toBe(2035);
    const vm = ready(result.current);
    expect(vm.slider).toMatchObject({ value: 41, base: 41 });
    expect(vm.apply).toEqual({ label: 'In your plan', done: true });
  });
});
