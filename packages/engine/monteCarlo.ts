// monteCarlo(): seeded paths of plan(), p10/p50/p90 bands, success rate and histograms.
// Task MP5 (#165); spec in docs/ENGINEERING.md → Monte Carlo.
//
// 1. PRNG: mulberry32(seed), normals by Box–Muller. `settings.seed` null → monteCarlo() picks one with
//    Math.random() OUTSIDE the pure core (runMonteCarlo) and returns it, so a fixed seed reproduces the
//    exact run.
// 2. Draws, per path k and plan year t (year 0 = the year of asOf), in this order: inflation_t ~
//    N(inflation.mean, inflation.sd), then growth_{g,t} ~ N(mean_g, sd_g) for every asset group of
//    `settings.growth` in ASSET_GROUPS order (liability groups are ignored). A group missing from
//    `settings.growth` keeps the scenario's growth (or simulate()'s default, which tracks each year's
//    drawn inflation for real estate and other assets). A draw is floored at −0.99 (a rate ≤ −100% is
//    meaningless; with sd 0.15 around 7% that is a > 7-sigma event).
// 3. Per path: plan() of those rates. The plan is prepared once (preparePlan: accounts, events) and
//    simulate() runs per path with the draws as `yearlyRates`, exactly as plan(…, { yearlyRates })
//    does, so every path IS plan() of its rates (test). Net worth per year in the scenario's display
//    unit: today's dollars deflate each path by its own inflation draws.
// 4. Success: net worth at the end ≥ endThreshold AND no year ends with a shortfall (above
//    PAID_OFF_EPSILON, as plan()'s shortfallAge); successRate = successes / paths.
// 5. Bands: per year p10 / p50 / p90, nearest rank (the value at rank ceil(p/100 × N), rank ≥ 1).
//    monteCarloPercentiles() gives any other percentiles of the same run (the AI line's p5–p95).
// 6. Samples: every ceil(paths / 200)-th path (0, step, 2·step, …), with its success flag.
// 7. Histograms: 20 equal-width bins from min to max (the last bin includes max; one bin when every
//    value is equal) for atRetirement (the year at the KPI retireAge, clamped to the plan like plan())
//    and atEnd; shortfallAge: one bin per year of age [age, age + 1) from the first to the last age
//    seen, paths without a shortfall left out (their count is paths − Σ counts).
import {
  ASSET_GROUPS, MONTE_CARLO_MAX_PATHS, MONTE_CARLO_MAX_SAMPLE_PATHS,
  type Account, type AreaData, type AssetGroup, type HistogramBin, type Money, type MonteCarloResult,
  type MonteCarloSettings, type Profile, type Rate, type Scenario,
} from '@lifeguessr/types';
import { PAID_OFF_EPSILON } from './loan/amortize';
import { type PreparedPlan, preparePlan, yearEndDeflators } from './plan';
import { simulate } from './simulate';

const HISTOGRAM_BINS = 20;
const MIN_RATE = -0.99;

/** `settings.seed` null = the caller picks a seed outside the pure core; the result returns the seed used. */
export function monteCarlo(
  profile: Profile, accounts: readonly Account[], scenario: Scenario, settings: MonteCarloSettings, area?: AreaData,
): MonteCarloResult {
  return summarize(runMonteCarlo(profile, accounts, scenario, settings, settings.seed ?? newSeed(), area));
}

/**
 * Per year percentiles (nearest rank) of the same run monteCarlo() makes with these settings, e.g.
 * [5, 95] for the AI line's band. `values[i]` is the `percentiles[i]`-th percentile.
 */
export function monteCarloPercentiles(
  profile: Profile, accounts: readonly Account[], scenario: Scenario, settings: MonteCarloSettings,
  percentiles: readonly number[], area?: AreaData,
): { seed: number; years: { year: number; values: Money[] }[] } {
  for (const p of percentiles) {
    if (!Number.isFinite(p) || p <= 0 || p > 100) throw new RangeError(`Invalid percentile: ${p}`);
  }
  const run = runMonteCarlo(profile, accounts, scenario, settings, settings.seed ?? newSeed(), area);
  return {
    seed: run.seed,
    years: yearColumns(run).map(({ year, sorted }) => ({ year, values: percentiles.map((p) => nearestRank(sorted, p)) })),
  };
}

/** The p-th percentile (0 < p ≤ 100) of ascending values: the value at rank ceil(p/100 × N), rank ≥ 1. */
export function nearestRank(sorted: ArrayLike<number>, p: number): number {
  const n = sorted.length;
  if (n === 0) throw new RangeError('nearestRank of no values');
  const rank = Math.min(n, Math.max(1, Math.ceil((p / 100) * n)));
  return sorted[rank - 1]!;
}

/** mulberry32: a small seeded generator of numbers in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/**
 * Outside the pure core: a fresh unsigned 32-bit seed for `seed: null` (ENGINEERING.md → Monte Carlo,
 * step 1). The only unseeded call in the engine; the run itself is a pure function of this seed.
 */
function newSeed(): number {
  // eslint-disable-next-line no-restricted-properties -- seed: null asks for a new seed; it is returned in the result
  return Math.floor(Math.random() * 4_294_967_296) >>> 0;
}

/** Standard normals by Box–Muller (both values of each pair are used). */
function normals(random: () => number): () => number {
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const z = spare;
      spare = null;
      return z;
    }
    const u1 = 1 - random(); // (0, 1]: log stays finite
    const u2 = random();
    const r = Math.sqrt(-2 * Math.log(u1));
    spare = r * Math.sin(2 * Math.PI * u2);
    return r * Math.cos(2 * Math.PI * u2);
  };
}

type Run = {
  seed: number;
  paths: number;
  prep: PreparedPlan;
  /** Net worth, display unit: path k, plan year y at [k × yearCount + y]. */
  netWorth: Float64Array;
  atRetirement: Float64Array;
  atEnd: Float64Array;
  /** First age whose year ends with a shortfall; NaN = none. */
  shortfallAge: Float64Array;
  success: Uint8Array;
};

function checkMeanSd(name: string, x: { mean: Rate; sd: Rate }): void {
  if (!Number.isFinite(x.mean) || x.mean <= -1) throw new RangeError(`Invalid ${name} mean: ${x.mean}`);
  if (!Number.isFinite(x.sd) || x.sd < 0) throw new RangeError(`Invalid ${name} sd: ${x.sd}`);
}

/** The pure core: every path of one run with a concrete seed. */
function runMonteCarlo(
  profile: Profile, accounts: readonly Account[], scenario: Scenario, settings: MonteCarloSettings,
  seed: number, area?: AreaData,
): Run {
  const n = settings.paths;
  if (!Number.isInteger(n) || n < 1 || n > MONTE_CARLO_MAX_PATHS) throw new RangeError(`Invalid paths: ${n}`);
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError(`Invalid seed: ${seed}`);
  checkMeanSd('inflation', settings.inflation);
  if (!Number.isFinite(settings.endThreshold)) throw new RangeError(`Invalid endThreshold: ${settings.endThreshold}`);
  const drawn: { group: AssetGroup; mean: Rate; sd: Rate }[] = [];
  for (const g of ASSET_GROUPS) {
    const x = settings.growth[g];
    if (!x) continue;
    checkMeanSd(`${g} growth`, x);
    drawn.push({ group: g, mean: x.mean, sd: x.sd });
  }

  const prep = preparePlan(profile, accounts, scenario, area);
  const { yearCount, asOfYear, birthYear } = prep;
  const firstAge = asOfYear - birthYear;
  const retireIndex = Math.min(yearCount - 1, Math.max(0, prep.retireAge - firstAge));
  const gauss = normals(mulberry32(seed));
  const draw = (mean: Rate, sd: Rate) => (sd === 0 ? mean : Math.max(MIN_RATE, mean + sd * gauss()));

  const netWorth = new Float64Array(n * yearCount);
  const atRetirement = new Float64Array(n);
  const atEnd = new Float64Array(n);
  const shortfallAge = new Float64Array(n).fill(Number.NaN);
  const success = new Uint8Array(n);
  const inflation: Rate[] = new Array<Rate>(yearCount);
  const growth = drawn.map(() => new Array<Rate>(yearCount));
  const yearlyGrowth: Partial<Record<AssetGroup, readonly Rate[]>> = {};
  drawn.forEach((d, i) => { yearlyGrowth[d.group] = growth[i]!; });
  const yearlyRates = { inflation, growth: yearlyGrowth };

  for (let k = 0; k < n; k++) {
    for (let y = 0; y < yearCount; y++) {
      inflation[y] = draw(settings.inflation.mean, settings.inflation.sd);
      for (let i = 0; i < drawn.length; i++) growth[i]![y] = draw(drawn[i]!.mean, drawn[i]!.sd);
    }
    const path = simulate(prep.simProfile, prep.months, { ...prep.simOptions, yearlyRates }).path;
    const deflators = yearEndDeflators(prep, inflation);
    const row = k * yearCount;
    let shortAt = -1;
    for (let y = 0; y < yearCount; y++) {
      const e = path[y + 1]!;
      netWorth[row + y] = e.netWorth / deflators[y]!;
      if (shortAt < 0 && (e.shortfall ?? 0) > PAID_OFF_EPSILON) shortAt = y;
    }
    atRetirement[k] = netWorth[row + retireIndex]!;
    const end = netWorth[row + yearCount - 1]!;
    atEnd[k] = end;
    if (shortAt >= 0) shortfallAge[k] = firstAge + shortAt;
    success[k] = shortAt < 0 && end >= settings.endThreshold ? 1 : 0;
  }
  return { seed, paths: n, prep, netWorth, atRetirement, atEnd, shortfallAge, success };
}

/** Each plan year's net worth over all paths, ascending. */
function yearColumns(run: Run): { year: number; sorted: Float64Array }[] {
  const { prep: { yearCount, asOfYear }, paths, netWorth } = run;
  const out: { year: number; sorted: Float64Array }[] = [];
  for (let y = 0; y < yearCount; y++) {
    const col = new Float64Array(paths);
    for (let k = 0; k < paths; k++) col[k] = netWorth[k * yearCount + y]!;
    out.push({ year: asOfYear + y, sorted: col.sort() });
  }
  return out;
}

function summarize(run: Run): MonteCarloResult {
  const { paths, prep: { yearCount }, netWorth, success } = run;
  let successes = 0;
  for (let k = 0; k < paths; k++) successes += success[k]!;

  const bands = yearColumns(run).map(({ year, sorted }) => ({
    year, p10: nearestRank(sorted, 10), p50: nearestRank(sorted, 50), p90: nearestRank(sorted, 90),
  }));

  const step = Math.ceil(paths / MONTE_CARLO_MAX_SAMPLE_PATHS);
  const samplePaths: MonteCarloResult['samplePaths'] = [];
  for (let k = 0; k < paths; k += step) {
    samplePaths.push({ success: success[k] === 1, netWorth: Array.from(netWorth.subarray(k * yearCount, (k + 1) * yearCount)) });
  }

  return {
    paths,
    seed: run.seed,
    successRate: successes / paths,
    bands,
    samplePaths,
    histograms: {
      atRetirement: equalWidthBins(run.atRetirement),
      atEnd: equalWidthBins(run.atEnd),
      shortfallAge: ageBins(run.shortfallAge),
    },
  };
}

/** 20 equal-width bins from min to max; the last includes max. One bin when every value is equal. */
function equalWidthBins(values: Float64Array): HistogramBin[] {
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!(max > min)) return [{ from: min, to: max, count: values.length }];
  const width = (max - min) / HISTOGRAM_BINS;
  const counts = new Array<number>(HISTOGRAM_BINS).fill(0);
  for (const v of values) counts[Math.min(HISTOGRAM_BINS - 1, Math.floor((v - min) / width))]! += 1;
  return counts.map((count, i) => ({
    from: min + i * width,
    to: i === HISTOGRAM_BINS - 1 ? max : min + (i + 1) * width,
    count,
  }));
}

/** One bin per year of age [age, age + 1), first to last age seen; NaN (no shortfall) left out. */
function ageBins(ages: Float64Array): HistogramBin[] {
  let min = Infinity;
  let max = -Infinity;
  for (const a of ages) {
    if (Number.isNaN(a)) continue;
    if (a < min) min = a;
    if (a > max) max = a;
  }
  if (min > max) return [];
  const counts = new Array<number>(max - min + 1).fill(0);
  for (const a of ages) if (!Number.isNaN(a)) counts[a - min]! += 1;
  return counts.map((count, i) => ({ from: min + i, to: min + i + 1, count }));
}
