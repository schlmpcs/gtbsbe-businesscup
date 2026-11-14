/// <reference types="node" />
// monteCarlo() (MP5, #165): the tests of docs/ENGINEERING.md → Monte Carlo.
import { describe, expect, it } from 'vitest';
import type { CostCategory, MonteCarloSettings, PlanAssumptions, Profile, Scenario } from '@lifeguessr/types';
import { COST_CATEGORIES, MonteCarloResultSchema } from '@lifeguessr/types';
import { areaByZip, profileDemo } from '@lifeguessr/data/fixtures';
import { accountsDemo, scenarioDemo } from '@lifeguessr/data/fixtures/plan';
import { returnAnnualNominal } from './assumptions';
import { monteCarlo, monteCarloPercentiles, mulberry32, nearestRank } from './monteCarlo';
import { plan } from './plan';

const area = areaByZip('75206');
const demo: Profile = { ...structuredClone(profileDemo), asOf: '2026-11' };
const r = returnAnnualNominal.value;
const homes = area?.homeAppreciationAnnual?.value ?? 0.03; // what plan() grows the home at

/** The documented defaults (ENGINEERING.md → assumptions) around the plan's own rates: inflation sd 0.02, markets sd 0.15, homes 0.05. */
const settings = (o: Partial<MonteCarloSettings> = {}): MonteCarloSettings => ({
  paths: 300, seed: 42, inflation: { mean: 0.03, sd: 0.02 },
  growth: { investments: { mean: r, sd: 0.15 }, retirement: { mean: r, sd: 0.15 }, realEstate: { mean: homes, sd: 0.05 } },
  endThreshold: 0, ...o,
});

const assumptions = (o: Partial<PlanAssumptions> = {}): PlanAssumptions => ({
  retireAge: 67, endAge: 90, inflation: 0.03, display: 'today', expenses: { mode: 'budget' }, growth: {},
  withdrawalOrder: ['cash', 'investments', 'retirement'], savingsSplit: [{ group: 'investments', share: 1 }], ...o,
});
const scenario = (a: Partial<PlanAssumptions> = {}): Scenario => ({ id: 's', name: 'Test', assumptions: assumptions(a), events: [] });

/** A 30-year-old in January 2026 with only an `other` spending line. */
function person(o: { pay: number; other: number; cash?: number }): Profile {
  const spending = Object.fromEntries(COST_CATEGORIES.map((c) => [c, { value: c === 'other' ? o.other : 0, isEstimate: false }])) as
    Record<CostCategory, { value: number; isEstimate: boolean }>;
  return {
    age: { value: 30, isEstimate: false }, takeHomePay: { value: o.pay, isEstimate: false }, spending,
    cash: { value: o.cash ?? 0, isEstimate: false }, retirement: { value: 0, isEstimate: false },
    retirementShare: { value: 0, isEstimate: false }, debts: [], doneMoveIds: [], asOf: '2026-01',
  };
}

describe('monteCarlo', () => {
  it('is a valid MonteCarloResult with the documented shape', () => {
    const mc = monteCarlo(demo, accountsDemo, scenarioDemo, settings(), area);
    expect(MonteCarloResultSchema.safeParse(mc).success).toBe(true);
    const p = plan(demo, accountsDemo, scenarioDemo, area);
    expect(mc.bands.map((b) => b.year)).toEqual(p.years.map((y) => y.year));
    expect(mc).toMatchObject({ paths: 300, seed: 42 });
    // Every ceil(300 / 200) = 2nd path: 150 samples, one value per plan year.
    expect(mc.samplePaths).toHaveLength(150);
    for (const s of mc.samplePaths) expect(s.netWorth).toHaveLength(p.years.length);
  });

  it('same seed → identical result; another seed → other sample paths', () => {
    const a = monteCarlo(demo, accountsDemo, scenarioDemo, settings(), area);
    const b = monteCarlo(demo, accountsDemo, scenarioDemo, settings(), area);
    expect(b).toEqual(a);
    const c = monteCarlo(demo, accountsDemo, scenarioDemo, settings({ seed: 7 }), area);
    expect(c.seed).toBe(7);
    expect(c.samplePaths).not.toEqual(a.samplePaths);
  });

  it('seed null → a seed is picked and returned; rerunning with it reproduces the run', () => {
    const a = monteCarlo(demo, accountsDemo, scenarioDemo, settings({ seed: null, paths: 50 }), area);
    expect(Number.isInteger(a.seed)).toBe(true);
    expect(a.seed).toBeGreaterThanOrEqual(0);
    expect(a.seed).toBeLessThanOrEqual(0xffffffff);
    expect(monteCarlo(demo, accountsDemo, scenarioDemo, settings({ seed: a.seed, paths: 50 }), area)).toEqual(a);
  });

  it('every sd = 0 → every path equals plan(); p10 = p50 = p90 = the plan line; success 0% or 100%', () => {
    const zero = settings({
      paths: 20,
      inflation: { mean: scenarioDemo.assumptions.inflation, sd: 0 },
      growth: { investments: { mean: r, sd: 0 }, retirement: { mean: r, sd: 0 } },
    });
    const mc = monteCarlo(demo, accountsDemo, scenarioDemo, zero, area);
    const line = plan(demo, accountsDemo, scenarioDemo, area).years.map((y) => y.netWorth);
    // Compounded monthly price steps vs (1 + i)^(t/12): equal up to float rounding.
    const close = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1e-6 * Math.max(1, Math.abs(b)));
    for (const s of mc.samplePaths) s.netWorth.forEach((v, y) => close(v, line[y]!));
    mc.bands.forEach((b, y) => {
      close(b.p10, line[y]!);
      close(b.p50, line[y]!);
      close(b.p90, line[y]!);
    });
    expect([0, 1]).toContain(mc.successRate);
    // Degenerate histograms: one bin holding every path.
    expect(mc.histograms.atEnd).toEqual([{ from: mc.bands.at(-1)!.p50, to: mc.bands.at(-1)!.p50, count: 20 }]);
  });

  it('with spreads, the median path stays close to plan()', () => {
    const mc = monteCarlo(demo, accountsDemo, scenarioDemo, settings({ paths: 1000 }), area);
    const p = plan(demo, accountsDemo, scenarioDemo, area);
    // Means = the plan's rates: ten years out the median is within 3% of the rules line.
    const y = 10;
    expect(Math.abs(mc.bands[y]!.p50 - p.years[y]!.netWorth)).toBeLessThan(0.03 * Math.abs(p.years[y]!.netWorth));
    expect(mc.bands[y]!.p10).toBeLessThan(p.years[y]!.netWorth);
    expect(mc.bands[y]!.p90).toBeGreaterThan(p.years[y]!.netWorth);
  });

  it('p10 ≤ p50 ≤ p90 every year; histogram counts sum to paths', () => {
    const mc = monteCarlo(demo, accountsDemo, scenarioDemo, settings(), area);
    for (const b of mc.bands) {
      expect(b.p10).toBeLessThanOrEqual(b.p50);
      expect(b.p50).toBeLessThanOrEqual(b.p90);
    }
    const sum = (bins: { count: number }[]) => bins.reduce((s, b) => s + b.count, 0);
    expect(mc.histograms.atEnd).toHaveLength(20);
    expect(sum(mc.histograms.atEnd)).toBe(300);
    expect(sum(mc.histograms.atRetirement)).toBe(300);
    expect(sum(mc.histograms.shortfallAge)).toBeLessThanOrEqual(300);
    for (const bins of Object.values(mc.histograms)) {
      for (let i = 1; i < bins.length; i++) expect(bins[i]!.from).toBeCloseTo(bins[i - 1]!.to, 6);
    }
    expect(mc.successRate).toBeGreaterThanOrEqual(0);
    expect(mc.successRate).toBeLessThanOrEqual(1);
  });

  it('a zero-income profile → success 0%, every path has a shortfall age', () => {
    const mc = monteCarlo(person({ pay: 0, other: 2000, cash: 10_000 }), [], scenario(), settings({ paths: 100 }));
    expect(mc.successRate).toBe(0);
    // $10k of cash at $2k a month runs out in the first year, at age 30, on every path.
    expect(mc.histograms.shortfallAge).toEqual([{ from: 30, to: 31, count: 100 }]);
  });

  it('a rich profile (huge cash, tiny spend) → success 100%', () => {
    const mc = monteCarlo(person({ pay: 0, other: 100, cash: 5_000_000 }), [], scenario(), settings({ paths: 100 }));
    expect(mc.successRate).toBe(1);
    expect(mc.histograms.shortfallAge).toEqual([]);
  });

  it('more savings → success not lower (same seed, same draws)', () => {
    const s = settings({ paths: 400, endThreshold: 500_000 });
    const rates = [3000, 2800, 2500, 2000].map((other) =>
      monteCarlo(person({ pay: 4000, other }), [], scenario(), s).successRate);
    for (let i = 1; i < rates.length; i++) expect(rates[i]).toBeGreaterThanOrEqual(rates[i - 1]!);
    expect(rates.at(-1)).toBeGreaterThan(rates[0]!);
  });

  it('success needs net worth at the end ≥ endThreshold', () => {
    const low = monteCarlo(demo, accountsDemo, scenarioDemo, settings({ endThreshold: -1e12 }), area);
    const high = monteCarlo(demo, accountsDemo, scenarioDemo, settings({ endThreshold: 1e12 }), area);
    expect(high.successRate).toBe(0);
    expect(low.successRate).toBeGreaterThanOrEqual(high.successRate);
  });

  it('monteCarloPercentiles: the same run, any percentiles (the AI line p5–p95)', () => {
    const s = settings();
    const mc = monteCarlo(demo, accountsDemo, scenarioDemo, s, area);
    const pct = monteCarloPercentiles(demo, accountsDemo, scenarioDemo, s, [5, 10, 50, 90, 95], area);
    expect(pct.seed).toBe(42);
    pct.years.forEach((y, i) => {
      const [p5, p10, p50, p90, p95] = y.values as [number, number, number, number, number];
      expect({ year: y.year, p10, p50, p90 }).toEqual(mc.bands[i]);
      expect(p5).toBeLessThanOrEqual(p10);
      expect(p95).toBeGreaterThanOrEqual(p90);
    });
    expect(() => monteCarloPercentiles(demo, accountsDemo, scenarioDemo, s, [0], area)).toThrow(RangeError);
  });

  it('nearestRank: the value at rank ceil(p/100 × N)', () => {
    const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(nearestRank(v, 10)).toBe(1);
    expect(nearestRank(v, 50)).toBe(5);
    expect(nearestRank(v, 90)).toBe(9);
    expect(nearestRank(v, 95)).toBe(10);
    expect(nearestRank([4], 5)).toBe(4);
  });

  it('mulberry32 is deterministic and in [0, 1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 1000; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('invalid settings → RangeError', () => {
    const run = (o: Partial<MonteCarloSettings>) => () => monteCarlo(demo, accountsDemo, scenarioDemo, settings(o), area);
    expect(run({ paths: 0 })).toThrow(RangeError);
    expect(run({ paths: 5001 })).toThrow(RangeError);
    expect(run({ paths: 1.5 })).toThrow(RangeError);
    expect(run({ seed: -1 })).toThrow(RangeError);
    expect(run({ inflation: { mean: 0.03, sd: -0.1 } })).toThrow(RangeError);
    expect(run({ growth: { investments: { mean: Number.NaN, sd: 0.1 } } })).toThrow(RangeError);
  });

  it.skipIf(process.env.CI_SLOW === '1')('performance: 1,000 paths for a 25-year-old to 90', () => {
    const p: Profile = { ...demo, age: { value: 25, isEstimate: false } };
    const s = settings({ paths: 1000 });
    monteCarlo(p, accountsDemo, scenarioDemo, settings({ paths: 200 }), area); // warm-up (JIT)
    // Median of per-run times: one GC pause or a busy CI core does not decide the result.
    const times: number[] = [];
    for (let k = 0; k < 5; k++) {
      const t0 = performance.now();
      monteCarlo(p, accountsDemo, scenarioDemo, s, area);
      times.push(performance.now() - t0);
    }
    times.sort((x, y) => x - y);
    expect(times[2]).toBeLessThan(1000); // ~320 ms on a dev machine; the doc targets < 400 ms
  });
});
