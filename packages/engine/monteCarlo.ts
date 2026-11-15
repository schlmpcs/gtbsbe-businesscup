// monteCarlo(): seeded paths of plan(), p5/p10/p50/p90/p95 bands, success rate and histograms.
// Task MP5 (#165). Exact, seeded and deterministic: the same inputs and seed give the same result.
//
// 1. PRNG: mulberry32(seed); normals by Box–Muller (u1 = 1 − U so the log never sees 0; both normals of
//    a pair are used). `settings.seed` null: the caller picks one with Math.random() outside the engine
//    (which has no randomness; MP7's Web Worker) and passes it in; the result returns the seed used, so
//    running again with that seed reproduces the run exactly.
// 2. Draws, for each path and each plan year t (calendar years from asOf, index 0 = the year of asOf),
//    in this order: inflation_t = mean + sd × z, then one per asset group in ASSET_GROUPS order,
//    growth_{g,t} = mean_g + sd_g × z. A rate with sd 0 draws no normal (it is its mean). mean_g: `settings.growth[g].mean`, else the rate plan()
//    uses for the group (Account.growth, assumptions.growth, the area's home appreciation, the engine
//    default); real estate and other assets without one follow that year's inflation draw, as in
//    plan(). sd_g: `settings.growth[g].sd`, else monteCarloGrowthSd (investments and retirement 15%,
//    real estate 5%, the rest 0). Every draw is floored at monteCarloRateFloor (−99%). The scenario's
//    inflation is replaced by `settings.inflation.mean` everywhere; with sd 0 the plan keeps its
//    constant-inflation formula, so all sd = 0 reproduces plan() exactly.
// 3. Replay (the Performance section's fast path): plan() costs about 1.4 ms for 25 → 90 (792 months),
//    so 1,000 calls would take about 1.4 s against the 400 ms budget. The draws only change the asset
//    side of the plan: with shortfallMode 'separate', debts never depend on cash or rates, and income,
//    spending, one-off costs and one-off income are today's-dollar amounts times the price level P(t).
//    So one simulate() run with plan()'s own inputs (plan.ts steps 1–3) at 0% inflation gives those
//    amounts and the debt balances month by month, and each path replays only the asset groups and the
//    shortfall with simulate()'s plan-mode rules, in simulate()'s order of operations: step 1 growth
//    (cash only while positive), new assets, the shortfall growing at monthly inflation; step 4 the
//    surplus split (savingsSplit, else retirementShare) or drawn from cash, then withdrawalOrder, the
//    rest to the shortfall. A path therefore equals plan(…, { yearlyRates: its draws }) (tested).
// 4. Per path: net worth at the end of each plan year in the scenario's display unit ('today' deflates
//    by the path's own price level, like plan()), at retirement (plan()'s retireAge year), at the end,
//    and the first age whose year ends with a shortfall above PAID_OFF_EPSILON (plan()'s rule).
// 5. Success: net worth at the end ≥ endThreshold (display unit) and no shortfall. successRate =
//    successes / paths.
// 6. Bands per plan year, nearest-rank percentiles: the p-th of n sorted values is v[⌈p × n / 100⌉ − 1].
// 7. samplePaths: paths 0, s, 2s, … with s = ⌈paths / 200⌉, net worth per plan year, success flag.
// 8. Histograms: atRetirement and atEnd in 20 equal-width bins from the lowest to the highest value
//    (the last bin includes the highest; one bin when every path has the same value). shortfallAge: one
//    bin per year of age [age, age + 1) from the earliest to the latest first-shortfall age; paths
//    without a shortfall are left out and counted in `pathsWithoutShortfall`.
import {
  ASSET_GROUPS,
  MONTE_CARLO_MAX_PATHS,
  MONTE_CARLO_MAX_SAMPLE_PATHS,
  type Account,
  type AreaData,
  type AssetGroup,
  type Debt,
  type HistogramBin,
  type LifeEvent,
  type Money,
  type MonteCarloResult,
  type MonteCarloSettings,
  type PlanEventContext,
  type Profile,
  type Rate,
  type Scenario,
} from '@lifeguessr/types';
import { accountsToProfile } from './accounts';
import {
  cashYieldAnnual, monteCarloGrowthSd, monteCarloRateFloor, returnAnnualNominal, vehicleDepreciationAnnual,
} from './assumptions';
import { eventStartMonth } from './events';
import { PAID_OFF_EPSILON } from './loan/amortize';
import { homeGrowth, plan } from './plan';
import { expandEvent, orderPlanEvents, planEventMonth } from './planEvents';
import { type ExtraAssetGroup, type SimulateOptions, type YearlyRates, monthlyRate, simulate } from './simulate';

/**
 * `settings.seed` null = the caller picks a seed outside the pure core (the engine has no randomness;
 * e.g. `Math.floor(Math.random() * 2 ** 32)` in the Web Worker) and passes it in; the result returns the
 * seed used. A null seed here is a RangeError.
 */
export function monteCarlo(
  profile: Profile, accounts: readonly Account[], scenario: Scenario, settings: MonteCarloSettings, area?: AreaData,
): MonteCarloResult {
  if (settings.seed === null) throw new RangeError('monteCarlo() needs a seed: the caller picks one when settings.seed is null');
  return run(prepare(profile, accounts, scenario, settings, area), settings, settings.seed);
}

/**
 * The yearly rates monteCarlo() draws for each path (index = path), in the shape plan()'s
 * `yearlyRates` option takes: plan(profile, accounts, scenario at inflation `settings.inflation.mean`,
 * area, { yearlyRates: draws[k] }) gives path k's net worth. `inflation` is left out when its sd is 0
 * (the plan then keeps its constant-inflation formula). Needs a fixed `settings.seed`.
 */
export function sampleYearlyRates(
  profile: Profile, accounts: readonly Account[], scenario: Scenario, settings: MonteCarloSettings, area?: AreaData,
): YearlyRates[] {
  if (settings.seed === null) throw new RangeError('sampleYearlyRates() needs a fixed seed');
  const prep = prepare(profile, accounts, scenario, settings, area);
  const normal = normals(mulberry32(checkSeed(settings.seed)));
  const d = drawBuffers(prep.yearCount);
  const out: YearlyRates[] = [];
  for (let k = 0; k < settings.paths; k++) {
    drawPath(prep, normal, d);
    const growth = Object.fromEntries(ASSET_GROUPS.map((g, i) => [g, Array.from(d.growth[i]!)])) as Record<AssetGroup, Rate[]>;
    out.push(prep.constantInflation ? { growth } : { inflation: Array.from(d.inflation), growth });
  }
  return out;
}

// ----- Inputs --------------------------------------------------------------------------------

const CASH = 0, INVESTMENTS = 1, RETIREMENT = 2, REAL_ESTATE = 3, VEHICLE = 4, OTHER_ASSET = 5; // ASSET_GROUPS order
const groupIndex = (g: AssetGroup): number => ASSET_GROUPS.indexOf(g);
const EXTRA_GROUPS: readonly ExtraAssetGroup[] = ['investments', 'realEstate', 'vehicle', 'otherAsset'];

type Prepared = {
  yearCount: number;
  months: number;
  years: { year: number; age: number }[];
  retireIndex: number;          // plan year of plan()'s retireAge (clamped to the plan, like plan())
  yearOfMonth: Int32Array;      // plan year of month t
  yearEnd: Int32Array;          // path index of the last month of plan year y
  display: 'today' | 'future';
  // Deterministic per month t (0-based), from one simulate() run at 0% inflation: today's dollars
  // (income, spending, one-off cost, one-off income) or nominal (debt payments); debtBalance by path index.
  income: Float64Array; spending: Float64Array; oneOffCost: Float64Array; oneOffIncome: Float64Array;
  debtPayments: Float64Array; debtBalance: Float64Array;
  newAssets: (readonly [group: number, value: Money][] | undefined)[];
  start: Float64Array;          // opening balance per asset group
  split: (readonly [group: number, share: Rate])[] | null;
  retirementShare: Rate;
  drawOrder: number[];          // asset groups drawn after cash
  // Draws.
  inflation: { mean: Rate; sd: Rate };
  constantInflation: boolean;   // sd 0: P(t) = (1 + mean)^(t/12), plan()'s constant formula
  constantPrice: Float64Array | null;
  groupMean: (Rate | null)[];   // null = that year's inflation
  groupSd: Rate[];
  /**
   * Monthly rates per plan year that no draw changes (sd 0), index 0 = inflation, then the asset
   * groups: an array, 'inflation' (sd 0 and follows inflation: the inflation rates), or null (drawn).
   */
  fixedMonthly: (Float64Array | 'inflation' | null)[];
};

function checkSeed(seed: number): number {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffff_ffff) throw new RangeError(`Invalid seed: ${seed}`);
  return seed;
}

/** Means below monteCarloRateFloor are rejected, so a rate with sd 0 is exactly its mean. */
function checkMeanSd(name: string, x: { mean: Rate; sd: Rate }): void {
  if (!Number.isFinite(x.mean) || x.mean < monteCarloRateFloor.value) throw new RangeError(`Invalid ${name} mean: ${x.mean}`);
  if (!Number.isFinite(x.sd) || x.sd < 0) throw new RangeError(`Invalid ${name} sd: ${x.sd}`);
}

function prepare(
  profile: Profile, accounts: readonly Account[], scenario: Scenario, settings: MonteCarloSettings, area?: AreaData,
): Prepared {
  if (!Number.isInteger(settings.paths) || settings.paths < 1 || settings.paths > MONTE_CARLO_MAX_PATHS) {
    throw new RangeError(`Invalid paths: ${settings.paths}`);
  }
  if (settings.seed !== null) checkSeed(settings.seed);
  checkMeanSd('inflation', settings.inflation);
  for (const g of ASSET_GROUPS) {
    const x = settings.growth[g];
    if (x) checkMeanSd(`${g} growth`, x);
  }
  if (!Number.isFinite(settings.endThreshold)) throw new RangeError(`Invalid endThreshold: ${settings.endThreshold}`);

  const a = { ...scenario.assumptions, inflation: settings.inflation.mean };
  // plan() validates the inputs and gives the plan years, ages and retireAge.
  const ref = plan(profile, accounts, { ...scenario, assumptions: a }, area);
  const asOf = profile.asOf!;
  const offset = eventStartMonth(`${asOf.slice(0, 4)}-01`, asOf);
  const yearCount = ref.years.length;
  const months = 12 * yearCount - offset;

  // plan.ts step 1: accounts → profile + group balances (investments kept out of retirement).
  const live = accounts.filter((x) => !x.excluded);
  const base: Profile = accounts.length > 0
    ? accountsToProfile(accounts.filter((x) => x.group !== 'investments'), profile)
    : profile;
  const balances: Partial<Record<ExtraAssetGroup, Money>> = {};
  for (const g of EXTRA_GROUPS) {
    const sum = live.filter((x) => x.group === g).reduce((s, x) => s + x.balance.value, 0);
    if (sum !== 0) balances[g] = sum;
  }
  const growth = homeGrowth(groupGrowth(live, a.growth, a.inflation, area), base, live);

  // plan.ts step 2: events in date order, each expanded on the profile with the ones before it.
  const ordered = orderPlanEvents(scenario.events);
  let lifeEvents: LifeEvent[] = [...(base.events ?? [])];
  const newDebts: { month: number; debt: Debt }[] = [];
  const newAssets: NonNullable<SimulateOptions['newAssets']>[number][] = [];
  for (const e of ordered) {
    const ctx: PlanEventContext = { profile: { ...base, events: lifeEvents }, assumptions: a, asOf, ...(area && { area }) };
    const x = expandEvent(e, ctx);
    lifeEvents = [...lifeEvents, ...x.lifeEvents];
    const start = eventStartMonth(asOf, planEventMonth(e.year, asOf));
    for (const debt of x.debts) newDebts.push({ month: start, debt });
    newAssets.push(...x.assets);
  }

  // plan.ts step 3 at 0% inflation: P(t) = 1, so the flows come out in today's dollars.
  const sim = simulate({ ...base, events: lifeEvents }, months, {
    rates: { inflationAnnual: a.inflation },
    shortfallMode: 'separate',
    withdrawalOrder: a.withdrawalOrder,
    ...(a.savingsSplit.length > 0 && { savingsSplit: a.savingsSplit }),
    balances,
    growth,
    expenses: a.expenses,
    newDebts,
    newAssets,
    yearlyRates: { inflation: new Array<Rate>(yearCount).fill(0) },
  });
  const income = new Float64Array(months);
  const spending = new Float64Array(months);
  const oneOffCost = new Float64Array(months);
  const oneOffIncome = new Float64Array(months);
  const debtPayments = new Float64Array(months);
  const debtBalance = new Float64Array(months + 1);
  const yearOfMonth = new Int32Array(months);
  for (let t = 0; t < months; t++) {
    const m = sim.path[t + 1]!;
    income[t] = m.income;
    spending[t] = m.spending;
    oneOffCost[t] = m.purchasesCash;
    oneOffIncome[t] = m.oneOffIncome ?? 0;
    debtPayments[t] = m.debtPayments;
    yearOfMonth[t] = Math.floor((offset + t) / 12);
  }
  for (let m = 0; m <= months; m++) debtBalance[m] = sim.path[m]!.debtBalance;
  const yearEnd = new Int32Array(yearCount);
  for (let y = 0; y < yearCount; y++) yearEnd[y] = 12 * (y + 1) - offset;
  const assetsAt: [number, Money][][] = [];
  for (const x of newAssets) (assetsAt[x.month] ??= []).push([groupIndex(x.group as AssetGroup), x.value]);
  const start = new Float64Array(ASSET_GROUPS.length);
  ASSET_GROUPS.forEach((g, i) => { start[i] = sim.path[0]!.groups![g].balance; });

  const retireAge = ref.kpis.retireAge;
  const at = ref.years.findIndex((y) => y.age === retireAge);
  const retireIndex = at >= 0 ? at : retireAge < ref.years[0]!.age ? 0 : yearCount - 1;

  const constantInflation = settings.inflation.sd === 0;
  let constantPrice: Float64Array | null = null;
  if (constantInflation) {
    constantPrice = new Float64Array(months + 1);
    for (let m = 0; m <= months; m++) constantPrice[m] = (1 + a.inflation) ** (m / 12);
  }
  const defaults: Record<AssetGroup, Rate | null> = {
    cash: cashYieldAnnual.value,
    investments: returnAnnualNominal.value,
    retirement: returnAnnualNominal.value,
    realEstate: null,
    vehicle: vehicleDepreciationAnnual.value,
    otherAsset: null,
  };
  const groupMean = ASSET_GROUPS.map((g) => settings.growth[g]?.mean ?? growth[g] ?? defaults[g]);
  const groupSd = ASSET_GROUPS.map((g) => settings.growth[g]?.sd ?? monteCarloGrowthSd.value[g]);
  // The same value drawPath() gives a rate with sd 0, as monthly rates for every plan year.
  const floor = monteCarloRateFloor.value;
  const fixedRate = (annual: Rate) => new Float64Array(yearCount).fill(monthlyRate(Math.max(floor, annual)));
  const fixedMonthly: Prepared['fixedMonthly'] = [constantInflation ? fixedRate(a.inflation) : null];
  ASSET_GROUPS.forEach((_, g) => {
    const mean = groupMean[g]!;
    fixedMonthly.push(groupSd[g]! > 0 ? null : mean === null ? 'inflation' : fixedRate(mean));
  });

  return {
    yearCount,
    months,
    years: ref.years.map((y) => ({ year: y.year, age: y.age })),
    retireIndex,
    yearOfMonth,
    yearEnd,
    display: a.display,
    income, spending, oneOffCost, oneOffIncome, debtPayments, debtBalance,
    newAssets: assetsAt,
    start,
    split: a.savingsSplit.length > 0 ? a.savingsSplit.map((s) => [groupIndex(s.group as AssetGroup), s.share] as const) : null,
    retirementShare: Math.min(1, Math.max(0, base.retirementShare.value)),
    drawOrder: a.withdrawalOrder.filter((g) => g !== 'cash').map((g) => groupIndex(g as AssetGroup)),
    inflation: settings.inflation,
    constantInflation,
    constantPrice,
    groupMean,
    groupSd,
    fixedMonthly,
  };
}

/**
 * plan.ts groupGrowth(), the same rules: yearly growth overrides per asset group for simulate():
 * Account.growth, then assumptions.growth, then (real estate only) the area's home appreciation. A
 * group whose accounts carry their own growth grows at the balance-weighted average of each account's
 * rate (the group's rate for the others; a plain average when the group is 0 today).
 */
function groupGrowth(
  live: readonly Account[], scenarioGrowth: Partial<Record<string, Rate>>, inflation: Rate, area?: AreaData,
): Partial<Record<AssetGroup, Rate>> {
  const out: Partial<Record<AssetGroup, Rate>> = {};
  const defaults: Record<AssetGroup, Rate> = {
    cash: cashYieldAnnual.value,
    investments: returnAnnualNominal.value,
    retirement: returnAnnualNominal.value,
    realEstate: area?.homeAppreciationAnnual?.value ?? inflation,
    vehicle: vehicleDepreciationAnnual.value,
    otherAsset: inflation,
  };
  for (const g of ASSET_GROUPS) {
    const groupRate = scenarioGrowth[g] ?? (g === 'realEstate' ? area?.homeAppreciationAnnual?.value : undefined);
    const own = live.filter((x) => x.group === g);
    if (own.some((x) => x.growth !== undefined)) {
      const fallback = groupRate ?? defaults[g];
      const total = own.reduce((s, x) => s + x.balance.value, 0);
      out[g] = total > 0
        ? own.reduce((s, x) => s + (x.growth ?? fallback) * x.balance.value, 0) / total
        : own.reduce((s, x) => s + (x.growth ?? fallback), 0) / own.length;
    } else if (groupRate !== undefined) {
      out[g] = groupRate;
    }
  }
  return out;
}

// ----- Draws ---------------------------------------------------------------------------------

/** mulberry32: a 32-bit seeded PRNG, uniform on [0, 1). */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}

/** Standard normals by Box–Muller; the second normal of each pair is returned by the next call. */
function normals(uniform: () => number): () => number {
  let spare = 0;
  let hasSpare = false;
  return () => {
    if (hasSpare) {
      hasSpare = false;
      return spare;
    }
    const r = Math.sqrt(-2 * Math.log(1 - uniform())); // 1 − U ∈ (0, 1]
    const theta = 2 * Math.PI * uniform();
    spare = r * Math.sin(theta);
    hasSpare = true;
    return r * Math.cos(theta);
  };
}

type DrawBuffers = { inflation: Float64Array; growth: Float64Array[] };
const drawBuffers = (years: number): DrawBuffers =>
  ({ inflation: new Float64Array(years), growth: ASSET_GROUPS.map(() => new Float64Array(years)) });

/** One path's yearly draws into `d` (see the header, step 2). A rate with sd 0 draws no normal. */
function drawPath(prep: Prepared, normal: () => number, d: DrawBuffers): void {
  const floor = monteCarloRateFloor.value;
  const { mean, sd } = prep.inflation;
  for (let y = 0; y < prep.yearCount; y++) {
    const inflation = Math.max(floor, sd > 0 ? mean + sd * normal() : mean);
    d.inflation[y] = inflation;
    for (let g = 0; g < ASSET_GROUPS.length; g++) {
      const m = prep.groupMean[g] ?? inflation;
      const s = prep.groupSd[g]!;
      d.growth[g]![y] = Math.max(floor, s > 0 ? m + s * normal() : m);
    }
  }
}

// ----- Paths ---------------------------------------------------------------------------------

/**
 * Replays one path's asset groups month by month (see the header, step 3), writing net worth at the
 * end of each plan year (display unit) into `out`. Returns the plan year of the first shortfall, or −1.
 */
function replay(
  prep: Prepared, d: DrawBuffers, monthly: Float64Array[], price: Float64Array, balances: Float64Array, out: Float64Array,
): number {
  const { months, yearOfMonth, yearEnd, income, spending, oneOffCost, oneOffIncome, debtPayments, debtBalance } = prep;
  // Monthly rates per plan year: inflation, then the asset groups. Rates that are the same on every
  // path come from `prep.fixedMonthly`; a group with sd 0 that follows inflation shares its rates.
  const rates: Float64Array[] = [];
  for (let i = 0; i <= ASSET_GROUPS.length; i++) {
    const fixed = prep.fixedMonthly[i]!;
    if (fixed === 'inflation') {
      rates.push(rates[0]!);
    } else if (fixed) {
      rates.push(fixed);
    } else {
      const src = i === 0 ? d.inflation : d.growth[i - 1]!;
      const dst = monthly[i]!;
      for (let y = 0; y < prep.yearCount; y++) dst[y] = monthlyRate(src[y]!);
      rates.push(dst);
    }
  }
  let P = price;
  if (prep.constantPrice) {
    P = prep.constantPrice;
  } else {
    P[0] = 1;
    for (let t = 0; t < months; t++) P[t + 1] = P[t]! * (1 + rates[0]![yearOfMonth[t]!]!);
  }
  const rInf = rates[0]!, rCash = rates[CASH + 1]!, rInv = rates[INVESTMENTS + 1]!, rRet = rates[RETIREMENT + 1]!;
  const rRe = rates[REAL_ESTATE + 1]!, rVeh = rates[VEHICLE + 1]!, rOth = rates[OTHER_ASSET + 1]!;
  const split = prep.split;
  const share = prep.retirementShare;
  const drawOrder = prep.drawOrder;
  const future = prep.display === 'future';

  const b = balances; // by asset group index (ASSET_GROUPS order)
  b.set(prep.start);
  let shortfall = 0;
  let firstShort = -1;
  let yi = 0;

  for (let t = 0; t < months; t++) {
    const y = yearOfMonth[t]!;
    const p = P[t]!;
    const inc = income[t]! * p;
    const spend = spending[t]! * p;
    // 1. Growth, then new assets.
    if (b[CASH]! > 0) b[CASH]! *= 1 + rCash[y]!;
    b[RETIREMENT]! *= 1 + rRet[y]!;
    b[INVESTMENTS]! *= 1 + rInv[y]!;
    b[REAL_ESTATE]! *= 1 + rRe[y]!;
    b[VEHICLE]! *= 1 + rVeh[y]!;
    b[OTHER_ASSET]! *= 1 + rOth[y]!;
    shortfall *= 1 + rInf[y]!;
    const assets = prep.newAssets[t];
    if (assets) for (const [g, v] of assets) b[g]! += v;
    // 4. Surplus: split, or drawn from cash, then the withdrawal order, then the shortfall.
    const surplus = inc - spend - debtPayments[t]! - oneOffCost[t]! * p;
    if (surplus > 0) {
      if (split) {
        for (const [g, s] of split) b[g]! += surplus * s;
      } else {
        const toRetirement = surplus * share;
        b[RETIREMENT]! += toRetirement;
        b[CASH]! += surplus - toRetirement;
      }
    } else {
      b[CASH]! += surplus;
    }
    b[CASH]! += oneOffIncome[t]! * p;
    if (b[CASH]! < 0) {
      let need = -b[CASH]!;
      b[CASH] = 0;
      for (const g of drawOrder) {
        if (need <= 0) break;
        const have = b[g]!;
        if (have <= 0) continue;
        const take = Math.min(need, have);
        b[g]! += -take;
        need -= take;
      }
      shortfall += need;
    }
    if (t + 1 === yearEnd[yi]) {
      // simulate()'s order: cash + retirement + investments + realEstate + vehicle + otherAsset − debts − shortfall.
      const netWorth = b[CASH]! + b[RETIREMENT]! + b[INVESTMENTS]! + b[REAL_ESTATE]! + b[VEHICLE]! + b[OTHER_ASSET]!
        - debtBalance[t + 1]! - shortfall;
      out[yi] = future ? netWorth : netWorth / P[t + 1]!;
      if (firstShort < 0 && shortfall > PAID_OFF_EPSILON) firstShort = yi;
      yi++;
    }
  }
  return firstShort;
}

/** Nearest-rank percentile of ascending `sorted`: v[⌈p × n / 100⌉ − 1]. */
function percentile(sorted: Float64Array, p: number): number {
  return sorted[Math.max(0, Math.ceil((p * sorted.length) / 100) - 1)]!;
}

/** 20 equal-width bins from the lowest to the highest value; one bin when they are all equal. */
function histogram(values: Float64Array): HistogramBin[] {
  let lo = Infinity, hi = -Infinity;
  for (const v of values) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (lo === hi) return [{ from: lo, to: hi, count: values.length }];
  const BINS = 20;
  const width = (hi - lo) / BINS;
  const counts = new Array<number>(BINS).fill(0);
  for (const v of values) counts[Math.min(BINS - 1, Math.floor((v - lo) / width))]!++;
  return counts.map((count, i) => ({ from: lo + i * width, to: i === BINS - 1 ? hi : lo + (i + 1) * width, count }));
}

function run(prep: Prepared, settings: MonteCarloSettings, seed: number): MonteCarloResult {
  const { paths, endThreshold } = settings;
  const Y = prep.yearCount;
  const normal = normals(mulberry32(checkSeed(seed)));
  const d = drawBuffers(Y);
  const monthly = Array.from({ length: ASSET_GROUPS.length + 1 }, () => new Float64Array(Y));
  const price = new Float64Array(prep.months + 1);
  const balances = new Float64Array(ASSET_GROUPS.length);
  const netWorth = new Float64Array(paths * Y);   // path k, plan year y at k × Y + y
  const atRetirement = new Float64Array(paths);
  const atEnd = new Float64Array(paths);
  const step = Math.ceil(paths / MONTE_CARLO_MAX_SAMPLE_PATHS);
  const samplePaths: MonteCarloResult['samplePaths'] = [];
  const shortAges: number[] = [];
  let successes = 0;

  for (let k = 0; k < paths; k++) {
    drawPath(prep, normal, d);
    const row = netWorth.subarray(k * Y, (k + 1) * Y);
    const firstShort = replay(prep, d, monthly, price, balances, row);
    atRetirement[k] = row[prep.retireIndex]!;
    atEnd[k] = row[Y - 1]!;
    const success = atEnd[k]! >= endThreshold && firstShort < 0;
    if (success) successes++;
    if (firstShort >= 0) shortAges.push(prep.years[firstShort]!.age);
    if (k % step === 0) samplePaths.push({ success, netWorth: Array.from(row) });
  }

  const column = new Float64Array(paths);
  const bands: MonteCarloResult['bands'] = prep.years.map(({ year }, y) => {
    for (let k = 0; k < paths; k++) column[k] = netWorth[k * Y + y]!;
    column.sort();
    return {
      year,
      p5: percentile(column, 5),
      p10: percentile(column, 10),
      p50: percentile(column, 50),
      p90: percentile(column, 90),
      p95: percentile(column, 95),
    };
  });

  const shortfallAge: HistogramBin[] = [];
  if (shortAges.length > 0) {
    const first = Math.min(...shortAges);
    const last = Math.max(...shortAges);
    for (let age = first; age <= last; age++) shortfallAge.push({ from: age, to: age + 1, count: 0 });
    for (const age of shortAges) shortfallAge[age - first]!.count++;
  }

  return {
    paths,
    seed,
    successRate: successes / paths,
    bands,
    samplePaths,
    histograms: { atRetirement: histogram(atRetirement), atEnd: histogram(atEnd), shortfallAge },
    pathsWithoutShortfall: paths - shortAges.length,
  };
}
