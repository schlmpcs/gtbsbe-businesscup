// @vitest-environment jsdom
// useLifeLine on the demo fixtures (resetPlanStore pins the demo profile (age 32) at asOf 2026-11,
// ZIP 75206 and the seeded demo scenario with "Buy a home" in 2032, age 38): the real engine, no network. In
// the decision sweep runs on the next task (setTimeout), as on the page.
import { buyHomeBreakdown, decisionSweep, eventAtYear, plan } from '@lifeguessr/engine';
import type { PlanEventOf, PlanResult, PlanYear, Scenario } from '@lifeguessr/types';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NO_MOVES, profileFor, usePlanInputs } from '@/features/plan/model/planEngine';
import { DEFAULT_CHANCE_SETTINGS, resetPlanStore, usePlanStore } from '@/features/plan/model/planStore';
import { effectiveSettings } from '@/features/plan/model/useChanceOfSuccess';
import type { LifeLineVM } from './types';
import {
  decisionWhy, DRAFT_EVENT_ID, homeDecision, lifeLineData, LIFELINE_PATHS, niceStep, retirementBreakdown, sweepYears, useLifeLine,
} from './useLifeLine';

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

  it('a plan without "Buy a home" gets the engine default as a draft, in the first year from three years out the plan can pay for it', () => {
    const inputs = renderHook(() => usePlanInputs()).result.current;
    const s = usePlanStore.getState().scenarios[0]!;
    const without: Scenario = { ...s, events: s.events.filter((e) => e.type !== 'buyHome') };
    const d = homeDecision(inputs, without);
    expect(d).toMatchObject({ eventId: DRAFT_EVENT_ID, inPlan: false, event: { type: 'buyHome', year: 2029 } });
    expect(d.scenario.events.at(-1)).toBe(d.event);
    // Whatever the person has saved: the draft sits in the first year from 2029 with no year short of cash,
    // or stays in 2029 when no year before retiring works (the line then says the cash runs out).
    const picked: number[] = [];
    for (const cash of [3_800, 80_000, 160_000, 400_000]) {
      const rich = { ...inputs, accounts: inputs.accounts.map((a) => (a.group === 'cash' ? { ...a, balance: { ...a.balance, value: cash } } : a)) };
      const at = homeDecision(rich, without);
      const shortAt = (year: number) => plan(profileFor(rich, NO_MOVES), rich.accounts, eventAtYear(at.scenario, DRAFT_EVENT_ID, year), rich.area).kpis.shortfallAge;
      picked.push(at.event.year);
      if (shortAt(at.event.year) === null) {
        if (at.event.year > 2029) expect(shortAt(at.event.year - 1)).not.toBeNull();
      } else {
        expect(at.event.year).toBe(2029);
      }
    }
    expect(picked.every((y) => y >= 2029)).toBe(true);
    expect(homeDecision(inputs, s)).toMatchObject({ eventId: 'ev-buy-home', inPlan: true, scenario: s });
  });
});

// A plan of one year (age 67) with the given account rows (end balances); netWorth = assets − debts.
function planAt67(rows: { id: string; end: number; debt?: boolean }[]): PlanResult {
  const year: PlanYear = {
    year: 2061, age: 67,
    netWorth: rows.reduce((s, r) => s + (r.debt ? -r.end : r.end), 0),
    assets: 0, liabilities: 0, shortfall: 0, events: [],
    accounts: rows.map((r) => ({ accountId: r.id, start: 0, growth: 0, deposits: 0, withdrawals: 0, end: r.end })),
    cashFlow: { income: [], expenses: [], withdrawals: 0, net: 0 },
  };
  return { years: [year], kpis: { netWorthEndOfYear: 0, netWorthAtRetirement: year.netWorth, retireAge: 67, netWorthAtEnd: 0, shortfallAge: null }, display: 'today', source: 'rules' };
}

describe('retirementBreakdown: the net worth gap at retirement split into home equity and the rest', () => {
  // Plan: cash $500,000, home $513,000, mortgage $1,000 → net worth $1,012,000, equity $512,000.
  // Picked: cash $525,000, home $466,000, mortgage $15,000 → net worth $976,000, equity $451,000.
  // Equity gap 451,000 − 512,000 = −61,000; net worth gap 976,000 − 1,012,000 = −36,000;
  // the rest (savings) = −36,000 − (−61,000) = +25,000.
  const base = planAt67([{ id: 'cash', end: 500_000 }, { id: 'ev:home', end: 513_000 }, { id: 'ev:mortgage', end: 1_000, debt: true }]);
  const picked = planAt67([{ id: 'cash', end: 525_000 }, { id: 'ev:home', end: 466_000 }, { id: 'ev:mortgage', end: 15_000, debt: true }]);

  it('equity = (home − mortgage) gap of the event rows, savings = the rest of the net worth gap', () => {
    expect(retirementBreakdown(base, picked, 'ev', 67)).toEqual({ equity: -61_000, savings: 25_000 });
  });

  it('a home paid in cash has no mortgage row: equity is the home alone', () => {
    // Plan home 400,000, picked 370,000; cash 100,000 vs 120,000. Equity −30,000; net worth gap
    // (490,000 − 500,000) = −10,000; savings = −10,000 + 30,000 = +20,000.
    const b = planAt67([{ id: 'cash', end: 100_000 }, { id: 'ev:home', end: 400_000 }]);
    const p = planAt67([{ id: 'cash', end: 120_000 }, { id: 'ev:home', end: 370_000 }]);
    expect(retirementBreakdown(b, p, 'ev', 67)).toEqual({ equity: -30_000, savings: 20_000 });
  });

  it('null when the home has no row of its own (it was merged into a real estate account) or the age is missing', () => {
    const b = planAt67([{ id: 'cash', end: 1 }, { id: 'house-1', end: 2 }]);
    expect(retirementBreakdown(b, b, 'ev', 67)).toBeNull();
    expect(retirementBreakdown(base, picked, 'ev', 70)).toBeNull();
  });
});

describe('decisionWhy: the breakdown in words', () => {
  it('waiting 2 years: less equity, more savings (compact amounts)', () => {
    expect(decisionWhy({ equity: -61_300, savings: 25_700 }, { years: 2, later: true, renting: true, age: 67 }))
      .toBe('Why: 2 fewer years of owning leaves $61.3K less home equity at 67; 2 more years of renting leaves $25.7K more in savings.');
  });

  it('buying 1 year sooner without replacing rent: more equity, less savings, "before buying"', () => {
    expect(decisionWhy({ equity: 30_000, savings: -12_000 }, { years: 1, later: false, renting: false, age: 65 }))
      .toBe('Why: 1 more year of owning leaves $30K more home equity at 65; 1 fewer year before buying leaves $12K less in savings.');
  });

  it('drops a part that rounds to $0, and is null when both do', () => {
    expect(decisionWhy({ equity: -20_000, savings: 0.4 }, { years: 1, later: true, renting: true, age: 67 }))
      .toBe('Why: 1 fewer year of owning leaves $20K less home equity at 67.');
    expect(decisionWhy({ equity: 0, savings: 0 }, { years: 1, later: true, renting: true, age: 67 })).toBeNull();
  });
});

describe('lifeLineData (pure) on the demo inputs', () => {
  function args(selectedYear: number, rates: { selected: number; base: number } | null, byYear: ReadonlyMap<number, number> | null = null) {
    const inputs = renderHook(() => usePlanInputs()).result.current;
    const decision = homeDecision(inputs, usePlanStore.getState().scenarios[0]!);
    const p = (y: number) => plan(inputs.profile, inputs.accounts, eventAtYear(decision.scenario, decision.eventId, y), inputs.area);
    const chance = rates ? { selected: { successRate: rates.selected, bands: [] }, base: { successRate: rates.base, bands: [] } } : ('measuring' as const);
    return { decision, inputs, selectedYear, plans: { selected: p(selectedYear), base: p(2032) }, chance, years: sweepYears(2032, 2026, 2061), chanceByYear: byYear };
  }

  it('headline: the gap at retirement as "more/less at retirement", never a signed balance', () => {
    // Same chance both ways (no chance headline), money never runs out at 39 or 38: the payoff is the
    // net worth gap at 67, worded by its size and direction.
    const a = args(2033, { selected: 0.9, base: 0.9 });
    const gap = a.plans.selected.kpis.netWorthAtRetirement - a.plans.base.kpis.netWorthAtRetirement;
    expect(gap).toBeLessThan(0); // buying a year later leaves less at 67 on the demo plan
    const vm = lifeLineData(a);
    expect(vm.headline.payoff).toMatch(/^\$[\d.]+K less at retirement$/);
    expect(vm.headline.payoff).not.toMatch(/[−-]/);
    expect(vm.headline.payoffTone).toBe('bad');
  });

  it('why: the equity and savings parts add up to the net worth gap and are worded for a later purchase', () => {
    const a = args(2034, null);
    const b = retirementBreakdown(a.plans.base, a.plans.selected, 'ev-buy-home', 67)!;
    const gap = a.plans.selected.kpis.netWorthAtRetirement - a.plans.base.kpis.netWorthAtRetirement;
    expect(b.equity + b.savings).toBeCloseTo(gap, 6);
    expect(b.equity).toBeLessThan(0); // two fewer years of the home growing and the loan shrinking
    const vm = lifeLineData(a);
    expect(vm.headline.why).toMatch(/^Why: 2 fewer years of owning leaves \$[\d.]+K less home equity at 67/);
    expect(lifeLineData(args(2032, null)).headline.why).toBeNull(); // nothing moved, nothing to explain
  });

  it('chance unchanged after a move reads "same as your plan"; a change shows the points', () => {
    expect(lifeLineData(args(2034, { selected: 1, base: 1 })).kpis[1]).toMatchObject({ value: '100%', delta: 'same as your plan', tone: 'neutral' });
    expect(lifeLineData(args(2034, { selected: 0.93, base: 0.86 })).kpis[1]!.delta).toBe('▲ +7 pts');
    expect(lifeLineData(args(2032, { selected: 1, base: 1 })).kpis[1]!.delta).toBeNull();
  });

  it('slider: the plan age is marked, and the chance at every slider age when measured (good from 80%)', () => {
    // sweepYears(2032, 2026, 2061) = 2028…2040 = ages 34…46 (born 1994).
    const byYear = new Map(sweepYears(2032, 2026, 2061).map((y) => [y, y < 2030 ? 0 : y === 2030 ? 0.79 : 1]));
    const s = lifeLineData(args(2034, { selected: 1, base: 1 }, byYear)).slider;
    expect(s.baseLabel).toBe('your plan: 38');
    expect(s.origin).toBe('Your plan buys a home');
    expect(s.chances).toHaveLength(13);
    expect(s.chances![0]).toEqual({ age: 34, pct: 0, tone: 'bad', label: 'Buy at 34: 0%' });
    expect(s.chances![2]).toEqual({ age: 36, pct: 79, tone: 'bad', label: 'Buy at 36: 79%' });
    expect(s.chances![3]).toEqual({ age: 37, pct: 100, tone: 'good', label: 'Buy at 37: 100%' });
    expect(lifeLineData(args(2034, null)).slider.chances).toBeNull();
  });

  it('chart: the plan age carries a label where the picked one differs', () => {
    expect(lifeLineData(args(2034, null)).chart.dragged).toEqual({ fromAge: 38, toAge: 40, label: 'your plan: 38' });
    expect(lifeLineData(args(2032, null)).chart.dragged).toBeNull();
  });
});

describe('useLifeLine', { timeout: 30_000 }, () => {
  it('at the plan year: the plan KPIs, no "before" line, then the Chance of success from the sweep', async () => {
    const { result } = renderHook(() => useLifeLine());
    const vm = ready(result.current);
    const inputs = renderHook(() => usePlanInputs()).result.current;
    const scenario = usePlanStore.getState().scenarios[0]!;
    const p = plan(inputs.profile, inputs.accounts, scenario, inputs.area);
    expect(vm.slider).toMatchObject({ value: 38, base: 38, min: 34, max: 46, titleNot: null });
    expect(vm.headline).toEqual({ lead: 'When should you buy a home?', payoff: null, payoffTone: 'neutral', why: null });
    expect(vm.kpis[0]).toMatchObject({ id: 'atRetirement', label: 'Net worth at 67', was: null, delta: null });
    expect(vm.chart.selected).toEqual(p.years.map((y) => ({ age: y.age, netWorth: y.netWorth })));
    expect(vm.chart.before).toBeNull();
    expect(vm.kpis[1]).toMatchObject({ id: 'chance', value: null, note: 'Measuring…' });

    await waitFor(() => expect(measured(result.current)).toBe(true), { timeout: 20_000 });
    const [point] = decisionSweep(inputs.profile, inputs.accounts, scenario, 'ev-buy-home', [scenario.events.find((e) => e.id === 'ev-buy-home')!.year], inputs.area,
      effectiveSettings({ ...DEFAULT_CHANCE_SETTINGS, paths: LIFELINE_PATHS, seed: usePlanStore.getState().fixedSeed }, scenario, inputs.area));
    const done = ready(result.current);
    expect(done.kpis[1]!.gaugePct).toBe(Math.round(point!.chance!.successRate * 100));
    expect(done.chart.band).toHaveLength(p.years.length);
    expect(done.house.art).toBe(point!.chance!.successRate >= 0.8 ? 'home-large' : 'house-build');
    // The per-age strip comes from the same sweep: one entry per slider age.
    expect(done.slider.chances!.map((c) => c.age)).toEqual(done.slider.ticks);
    expect(done.slider.chances!.find((c) => c.age === 38)!.pct).toBe(done.kpis[1]!.gaugePct);
  });

  it('dragging to 35: the plan with the home in 2029 vs 2032, money runs out at 35, house under construction', async () => {
    const { result } = renderHook(() => useLifeLine());
    await waitFor(() => expect(measured(result.current)).toBe(true), { timeout: 20_000 });
    act(() => ready(result.current).setAge(35));
    const vm = ready(result.current);
    const inputs = renderHook(() => usePlanInputs()).result.current;
    const scenario = usePlanStore.getState().scenarios[0]!;
    const moved = plan(inputs.profile, inputs.accounts, eventAtYear(scenario, 'ev-buy-home', 2029), inputs.area);
    expect(moved.kpis.shortfallAge).toBe(35);
    expect(vm.chart.selected).toEqual(moved.years.map((y) => ({ age: y.age, netWorth: y.netWorth })));
    expect(vm.chart.before).not.toBeNull();
    expect(vm.headline.lead).toBe('Buy a home 3 years sooner');
    expect(vm.headline.payoffTone).toBe('bad');
    // Running out of cash is the headline, and the line carries no net worth at retirement to celebrate.
    expect(vm.headline.payoff).toBe('you run out of cash at 35');
    expect(vm.chart.retireCallout).toBeNull();
    expect(vm.chart.beforeCallout).toBeNull();
    expect(vm.headline.why).toBeNull(); // no retirement breakdown for a line that runs out of cash
    expect(vm.kpis[0]!.tone).not.toBe('good');
    expect(vm.kpis[2]).toMatchObject({ id: 'runsOut', value: 'at 35', was: 'Never', delta: 'new', tone: 'bad' });
    expect(vm.chart.runsOut).toMatchObject({ age: 35, line: 'selected' });
    expect(vm.slider.titleNot).toBe(', not 38');
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
