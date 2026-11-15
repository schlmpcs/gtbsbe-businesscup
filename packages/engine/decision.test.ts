// decisionSweep / eventAtYear: the home "Life line" hero's engine (see decision.ts).
import { describe, expect, it } from 'vitest';
import type { MonteCarloSettings, Profile, Scenario } from '@lifeguessr/types';
import { areaByZip, profileDemo } from '@lifeguessr/data/fixtures';
import { accountsDemo, scenarioDemo } from '@lifeguessr/data/fixtures/plan';
import { decisionSweep, DECISION_SWEEP_MAX_YEARS, eventAtYear } from './decision';
import { monteCarlo } from './monteCarlo';
import { plan } from './plan';

/** Demo profile at the accounts' latest month, ZIP 75206 (as in plan.test.ts). */
const demo: Profile = { ...structuredClone(profileDemo), asOf: '2026-11' };
const area = areaByZip('75206');
const scenario = structuredClone(scenarioDemo) as Scenario; // Buy a home in 2033 (`ev-buy-home`)
const settings: MonteCarloSettings = { paths: 200, seed: 7, inflation: { mean: 0.03, sd: 0.02 }, growth: {}, endThreshold: 0 };

describe('eventAtYear', () => {
  it('moves only that event and leaves the scenario as it was', () => {
    const before = structuredClone(scenario);
    const moved = eventAtYear(scenario, 'ev-buy-home', 2030);
    expect(moved.events.find((e) => e.id === 'ev-buy-home')!.year).toBe(2030);
    expect(moved.events.filter((e) => e.id !== 'ev-buy-home')).toEqual(scenario.events.filter((e) => e.id !== 'ev-buy-home'));
    expect(moved.assumptions).toBe(scenario.assumptions);
    expect(scenario).toEqual(before);
  });

  it('moves an end year that would come before the new start', () => {
    const s: Scenario = { ...scenario, events: [{ id: 'brk', type: 'careerBreak', year: 2028, endYear: 2030, enabled: true }] };
    expect(eventAtYear(s, 'brk', 2031).events[0]).toMatchObject({ year: 2031, endYear: 2032 });
    expect(eventAtYear(s, 'brk', 2027).events[0]).toMatchObject({ year: 2027, endYear: 2030 });
  });

  it('refuses a missing event, Retire and a fractional year', () => {
    expect(() => eventAtYear(scenario, 'nope', 2030)).toThrow(RangeError);
    expect(() => eventAtYear(scenario, 'ev-retire', 2050)).toThrow(RangeError);
    expect(() => eventAtYear(scenario, 'ev-buy-home', 2030.5)).toThrow(RangeError);
  });
});

describe('decisionSweep', () => {
  it('each point is plan() of the scenario with the event in that year, ages from the plan', () => {
    const points = decisionSweep(demo, accountsDemo, scenario, 'ev-buy-home', [2029, 2033, 2029]);
    expect(points.map((p) => p.year)).toEqual([2029, 2033]);
    for (const p of points) {
      expect(p.plan).toEqual(plan(demo, accountsDemo, eventAtYear(scenario, 'ev-buy-home', p.year)));
      expect(p.chance).toBeUndefined();
    }
  });

  it('with the area, matches plan() with the area; age = the age in that calendar year', () => {
    const [p] = decisionSweep(demo, accountsDemo, scenario, 'ev-buy-home', [2031], area);
    expect(p!.plan).toEqual(plan(demo, accountsDemo, eventAtYear(scenario, 'ev-buy-home', 2031), area));
    const row = p!.plan.years.find((y) => y.year === 2031)!;
    expect(p!.age).toBe(row.age);
  });

  it('Chance of success is monteCarlo() of the moved scenario with the same seed at every year', () => {
    const points = decisionSweep(demo, accountsDemo, scenario, 'ev-buy-home', [2029, 2035], area, settings);
    for (const p of points) {
      const mc = monteCarlo(demo, accountsDemo, eventAtYear(scenario, 'ev-buy-home', p.year), settings, area);
      expect(p.chance!.successRate).toBe(mc.successRate);
      expect(p.chance!.bands).toEqual(mc.bands.map((b) => ({ year: b.year, p10: b.p10, p90: b.p90 })));
    }
  });

  it('demo story: buying at 35 runs out of money that year; waiting a few years fixes it', () => {
    const [early, later] = decisionSweep(demo, accountsDemo, scenario, 'ev-buy-home', [2029, 2035], area, settings);
    expect(early!.age).toBe(35);
    expect(early!.plan.kpis.shortfallAge).toBe(35);
    expect(later!.plan.kpis.shortfallAge).toBeNull();
    expect(later!.chance!.successRate).toBeGreaterThan(early!.chance!.successRate);
  });

  it('is deterministic and refuses a null seed or too many years', () => {
    const a = decisionSweep(demo, accountsDemo, scenario, 'ev-buy-home', [2030], area, settings);
    expect(decisionSweep(demo, accountsDemo, scenario, 'ev-buy-home', [2030], area, settings)).toEqual(a);
    expect(() => decisionSweep(demo, accountsDemo, scenario, 'ev-buy-home', [2030], area, { ...settings, seed: null })).toThrow(RangeError);
    const many = Array.from({ length: DECISION_SWEEP_MAX_YEARS + 1 }, (_, i) => 2027 + i);
    expect(() => decisionSweep(demo, accountsDemo, scenario, 'ev-buy-home', many, area)).toThrow(RangeError);
  });
});
