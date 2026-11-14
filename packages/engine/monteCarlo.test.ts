/// <reference types="node" />
// monteCarlo() (MP5, #165): the issue's tests, plus the Performance section's check that the replay
// behind it (see the header of ./monteCarlo.ts) stays on plan(). Expected numbers are worked out in
// the comments.
import { describe, expect, it } from 'vitest';
import type { CostCategory, MonteCarloSettings, PlanAssumptions, Profile, Scenario } from '@lifeguessr/types';
import { COST_CATEGORIES } from '@lifeguessr/types';
import { areaByZip, profileDemo } from '@lifeguessr/data/fixtures';
import { accountsDemo, scenarioDemo } from '@lifeguessr/data/fixtures/plan';
import { returnAnnualNominal } from './assumptions';
import { monteCarlo, sampleYearlyRates } from './monteCarlo';
import { plan } from './plan';

const settings = (o: Partial<MonteCarloSettings> = {}): MonteCarloSettings => ({
  paths: 200, seed: 42, inflation: { mean: 0.03, sd: 0.02 }, growth: {}, endThreshold: 0, ...o,
});

/** The demo household (32, July 2026) with its accounts and the demo scenario (home in 2029, retire 2061). */
const demo = { profile: { ...structuredClone(profileDemo), asOf: '2026-07' } as Profile, area: areaByZip('75206') };
const demoScenario = structuredClone(scenarioDemo) as Scenario;

const assumptions = (o: Partial<PlanAssumptions> = {}): PlanAssumptions => ({
  retireAge: 67, endAge: 90, inflation: 0.03, display: 'today', expenses: { mode: 'budget' }, growth: {},
  withdrawalOrder: ['cash', 'investments', 'retirement'], savingsSplit: [], ...o,
});
const scenario = (a: Partial<PlanAssumptions> = {}): Scenario => ({ id: 's', name: 'Test', assumptions: assumptions(a), events: [] });

/** A 30-year-old in January 2026: no income, only an `other` spending line, all in cash. */
function person(o: { other: number; cash: number }): Profile {
  const spending = Object.fromEntries(COST_CATEGORIES.map((c) => [c, { value: c === 'other' ? o.other : 0, isEstimate: false }])) as
    Record<CostCategory, { value: number; isEstimate: boolean }>;
  return {
    age: { value: 30, isEstimate: false }, takeHomePay: { value: 0, isEstimate: false }, spending,
    cash: { value: o.cash, isEstimate: false }, retirement: { value: 0, isEstimate: false },
    retirementShare: { value: 0, isEstimate: false }, debts: [], doneMoveIds: [], asOf: '2026-01',
  };
}

describe('monteCarlo', () => {
  it('same seed → identical result; different seed → different sample paths', () => {
    const run = (seed: number) => monteCarlo(demo.profile, accountsDemo, demoScenario, settings({ seed }), demo.area);
    const a = run(42);
    expect(run(42)).toEqual(a);
    expect(a.seed).toBe(42);
    expect(run(43).samplePaths).not.toEqual(a.samplePaths);
  });

  it('all sd = 0 → every path equals plan(); p5 = p10 = p50 = p90 = p95 = the plan line; success 0% or 100%', () => {
    // Inflation sd 0 at the scenario's 3%. Investments, retirement and real estate are the groups with a
    // default sd above 0, so they get sd 0 at the rate plan() uses for them: returnAnnualNominal (6%),
    // and the area's home appreciation (4.87%, Dallas). Cash, vehicle and otherAsset are left to the
    // defaults (sd 0, mean = plan()'s own rate: cash yield, the vehicle account's −15%, inflation).
    const s = settings({
      inflation: { mean: 0.03, sd: 0 },
      growth: {
        investments: { mean: returnAnnualNominal.value, sd: 0 },
        retirement: { mean: returnAnnualNominal.value, sd: 0 },
        realEstate: { mean: demo.area.homeAppreciationAnnual!.value, sd: 0 },
      },
    });
    const r = monteCarlo(demo.profile, accountsDemo, demoScenario, s, demo.area);
    const ref = plan(demo.profile, accountsDemo, demoScenario, demo.area);
    // asOf July 2026, age 32 → 90: calendar years 2026 … 2084 = 59 plan years.
    expect(ref.years).toHaveLength(59);
    expect(r.bands).toHaveLength(59);
    expect(r.samplePaths).toHaveLength(200); // every ceil(200 / 200) = 1st path
    for (const p of r.samplePaths) {
      ref.years.forEach((y, i) => expect(p.netWorth[i]).toBeCloseTo(y.netWorth, 6));
    }
    r.bands.forEach((b, i) => {
      const line = ref.years[i]!.netWorth;
      expect(b.year).toBe(ref.years[i]!.year);
      for (const v of [b.p5, b.p10, b.p50, b.p90, b.p95]) expect(v).toBeCloseTo(line, 6);
    });
    const works = ref.kpis.shortfallAge === null && ref.kpis.netWorthAtEnd >= 0;
    expect(r.successRate).toBe(works ? 1 : 0);
    expect(r.samplePaths.every((p) => p.success === works)).toBe(true);
  });

  it('zero income → success 0%, and every path runs short in the first year (age 30)', () => {
    // $10,000 cash at the 3% cash yield is at most 10,000 × 1.03 = 10,300 by December. Spending is
    // 2,000 × P(t) a month; even at a −50% inflation draw (z = −26.5 at sd 2%, never drawn) P(t) ≥
    // 0.5^(11/12) > 0.5, so 2026 costs more than 12 × 2,000 × 0.5 = 12,000 > 10,300: every path has a
    // shortfall at the end of 2026, age 30. Success 0; the histogram is one bin, age 30 to 31.
    const r = monteCarlo(person({ other: 2000, cash: 10_000 }), [], scenario(), settings());
    expect(r.successRate).toBe(0);
    expect(r.histograms.shortfallAge).toEqual([{ from: 30, to: 31, count: 200 }]);
    expect(r.pathsWithoutShortfall).toBe(0);
    expect(r.samplePaths.every((p) => !p.success)).toBe(true);
  });

  it('rich profile (huge cash, tiny spend) → success 100%', () => {
    // $1B cash, $1,000 a month, 2026 … 2086 (61 years). Cash only grows (3% yield). Even if every year
    // drew a 6-sd inflation (0.03 + 6 × 0.02 = 15%), the spending would total at most
    // 12,000 × Σ_{t<61} 1.15^t = 12,000 × (1.15^61 − 1) / 0.15 ≈ 12,000 × 33,800 ≈ $406M < $1B: no
    // shortfall, and net worth at the end stays > 0 = endThreshold.
    const r = monteCarlo(person({ other: 1000, cash: 1e9 }), [], scenario(), settings());
    expect(r.successRate).toBe(1);
    expect(r.histograms.shortfallAge).toEqual([]);
    expect(r.pathsWithoutShortfall).toBe(200);
  });

  it('p5 ≤ p10 ≤ p50 ≤ p90 ≤ p95 every year; histogram bins sum to `paths`', () => {
    const r = monteCarlo(demo.profile, accountsDemo, demoScenario, settings({ paths: 300 }), demo.area);
    expect(r.paths).toBe(300);
    expect(r.samplePaths).toHaveLength(150); // every ceil(300 / 200) = 2nd path
    for (const b of r.bands) {
      expect(b.p5).toBeLessThanOrEqual(b.p10);
      expect(b.p10).toBeLessThanOrEqual(b.p50);
      expect(b.p50).toBeLessThanOrEqual(b.p90);
      expect(b.p90).toBeLessThanOrEqual(b.p95!);
    }
    const sum = (bins: { count: number }[]) => bins.reduce((s, b) => s + b.count, 0);
    expect(r.histograms.atEnd).toHaveLength(20);
    expect(sum(r.histograms.atEnd)).toBe(300);
    expect(sum(r.histograms.atRetirement)).toBe(300);
    expect(sum(r.histograms.shortfallAge) + r.pathsWithoutShortfall!).toBe(300);
  });

  it('fast path: each path equals plan() fed the same yearly draws', () => {
    // The replay must give what plan(…, { yearlyRates }) gives for the path's own draws (the issue
    // asks for ≤ 1% off; it is the same arithmetic, so 1e-6 dollars). Default sds, so investments,
    // retirement and real estate vary by year; asOf July makes the first plan year 6 months long.
    const s = settings({ paths: 3, seed: 7 });
    const r = monteCarlo(demo.profile, accountsDemo, demoScenario, s, demo.area);
    const draws = sampleYearlyRates(demo.profile, accountsDemo, demoScenario, s, demo.area);
    expect(draws).toHaveLength(3);
    draws.forEach((yearlyRates, k) => {
      const ref = plan(demo.profile, accountsDemo, demoScenario, demo.area, { yearlyRates });
      ref.years.forEach((y, i) => expect(r.samplePaths[k]!.netWorth[i]).toBeCloseTo(y.netWorth, 6));
    });
  });

  it.skipIf(process.env.CI_SLOW === '1')('1,000 paths, age 25 → 90 (66 years, 792 months each) in under 400 ms', () => {
    // The issue's bound: < 400 ms in Node on CI. The fastest of 3 runs is timed, so one noisy run on a
    // shared runner does not fail the test; the PR reports the local time.
    const p = { ...demo.profile, age: { value: 25, isEstimate: false }, asOf: '2026-01' } as Profile;
    const s = settings({ paths: 1000 });
    monteCarlo(p, accountsDemo, demoScenario, { ...s, paths: 50 }, demo.area); // warm up the JIT
    let best = Infinity;
    let years = 0;
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      years = monteCarlo(p, accountsDemo, demoScenario, s, demo.area).bands.length;
      best = Math.min(best, performance.now() - t0);
    }
    console.info(`monteCarlo: 1,000 paths × ${years} years, best of 3: ${best.toFixed(1)} ms`);
    expect(years).toBe(66);
    expect(best).toBeLessThan(400);
  });
});
