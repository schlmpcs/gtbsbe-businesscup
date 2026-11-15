// plan(): the yearly plan to the end age, with shortfall, withdrawal order and savings split.
// Task MP3 (#163). Built on simulate() (./simulate.ts, "Plan options"), never a fork of it.
//
// 1. Inputs: accountsToProfile (MP8) gives cash, retirement and debts. Investments are kept out of
//    the profile's retirement (accountsToProfile folds them in) and carried, with real estate,
//    vehicles and other assets, as their own group balances. With no accounts at all, the profile's
//    own cash, retirement and debts are used.
// 2. Events: the enabled ones are expanded (MP4 expandEvent) in `orderPlanEvents` order (date order,
//    same year: Retire first, otherwise list order; every Social Security event after all the others,
//    so its benefit adds on top of work pay and of each later pay change), each on the profile with
//    the life events of those before it, as expandEvent's stacking rule asks. Their debts open in the event's start month and
//    their assets (the home) are added in theirs.
// 3. simulate() runs monthly from `asOf` through December of the year the person turns `endAge`
//    (age in calendar year Y = Y − (asOf year − round(age))), with shortfallMode 'separate', the
//    scenario's inflation, withdrawalOrder, savingsSplit (empty = profile.retirementShare), expenses
//    and growth. Growth per group: Account.growth, then assumptions.growth, then the engine default
//    (real estate: AreaData.homeAppreciationAnnual when there is one). Several accounts of one group
//    with their own growth make the group grow at their balance-weighted average. The profile's home
//    (JF4) is real estate: accountsToProfile sets its value from the real estate accounts, and with
//    none it enters through simulate()'s withHomeAsset at its own appreciation (`homeGrowth`).
// 4. One PlanYear per calendar year: balances at the year's last month, flows summed over its months
//    (the first year starts at asOf). Account rows: an asset group's values are split across its
//    accounts by today's balance shares (equal shares when the group is 0 today); a group with a
//    balance but no account gets one row per event that added to it, by share of the value added
//    (`<eventId>:home` for the home of Buy a home), else `group:<group>`. A debt row (id =
//    account id, or the event's debt id) has growth = interest charged, deposits = the amount borrowed
//    when it opens, withdrawals = payments; end = start + growth + deposits − withdrawals.
//    cashFlow: income takeHomePay + windfalls (one-off income), expenses spending + debtPayments +
//    oneOffCosts (one-off costs and down payments), withdrawals = Σ drawn from non-cash groups,
//    net = income − expenses.
// 5. display 'today' divides every money value of a year by the forecast's deflator at the year's last
//    month m: (1 + inflation)^(m/12), m counted from asOf (with yearly inflation draws, the compounded
//    price level of that path). 'future' leaves nominal dollars.
// 6. KPIs: netWorthEndOfYear = the first (current) year; retireAge = the earliest enabled Retire
//    event's age, else assumptions.retireAge; netWorthAtRetirement = the year at that age (clamped to
//    the plan); netWorthAtEnd = the last year; shortfallAge = the first age whose year ends with a
//    shortfall above PAID_OFF_EPSILON, else null.
import {
  ASSET_GROUPS,
  type Account,
  type AreaData,
  type AssetGroup,
  type Debt,
  type LifeEvent,
  type Money,
  type PlanAccountRow,
  type PlanEvent,
  type PlanEventContext,
  type PlanResult,
  type PlanYear,
  type Profile,
  type Rate,
  type Scenario,
} from '@lifeguessr/types';
import { accountsToProfile } from './accounts';
import { cashYieldAnnual, returnAnnualNominal, vehicleDepreciationAnnual } from './assumptions';
import { eventStartMonth } from './events';
import { MAX_SIMULATION_MONTHS, PAID_OFF_EPSILON } from './loan/amortize';
import { expandEvent, orderPlanEvents, planEventMonth } from './planEvents';
import { type ExtraAssetGroup, type SimulateOptions, type YearlyRates, monthlyRate, simulate } from './simulate';

/** Internal inputs for monteCarlo() (MP5): per plan year rate draws, index 0 = the year of asOf. */
export type PlanOptions = { yearlyRates?: YearlyRates };

const EXTRA_GROUPS: readonly ExtraAssetGroup[] = ['investments', 'realEstate', 'vehicle', 'otherAsset'];
/** Module-level copy of ASSET_GROUPS for the per-year loops (one binding lookup at load). */
const GROUPS: readonly AssetGroup[] = [...ASSET_GROUPS];

/**
 * Steps 1–3 of plan() up to the simulation: the inputs simulate() takes, prepared once. monteCarlo()
 * (MP5) prepares a plan once and runs simulate() per path with that path's `yearlyRates`, so every
 * path is exactly the plan() of those rates.
 */
export type PreparedPlan = {
  scenario: Scenario;
  asOfYear: number;
  /** asOf's month of the year (0 = January). */
  offset: number;
  birthYear: number;
  yearCount: number;
  months: number;
  /** Excluded accounts dropped. */
  live: readonly Account[];
  enabled: readonly PlanEvent[];
  eventAssets: readonly { eventId: string; group: string; value: Money }[];
  /** The profile simulate() runs (accounts folded in, the events' life events added). */
  simProfile: Profile;
  /** simulate()'s options without `yearlyRates`. */
  simOptions: SimulateOptions;
  /** KPI retireAge: the earliest enabled Retire event's age, else assumptions.retireAge. */
  retireAge: number;
};

export function preparePlan(
  profile: Profile, accounts: readonly Account[], scenario: Scenario, area?: AreaData,
): PreparedPlan {
  const a = scenario.assumptions;
  const asOf = profile.asOf;
  if (asOf === undefined) throw new RangeError('plan() needs Profile.asOf');
  const asOfYear = Number(asOf.slice(0, 4));
  const offset = eventStartMonth(`${asOf.slice(0, 4)}-01`, asOf); // asOf's month of the year; validates asOf
  const birthYear = asOfYear - Math.round(profile.age.value);
  const lastYear = birthYear + a.endAge;
  if (!Number.isInteger(a.endAge) || lastYear < asOfYear) throw new RangeError(`Invalid endAge: ${a.endAge}`);
  const yearCount = lastYear - asOfYear + 1;
  const months = 12 * yearCount - offset;
  if (months > MAX_SIMULATION_MONTHS) throw new RangeError(`Plan too long: ${months} months`);
  if (!Number.isFinite(a.inflation) || a.inflation <= -1) throw new RangeError(`Invalid inflation: ${a.inflation}`);

  // 1. Accounts → profile + group balances.
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

  // 2. Events, in date order, each expanded on the profile with the ones before it.
  const enabled = scenario.events.filter((e) => e.enabled);
  const ordered = orderPlanEvents(scenario.events);
  let lifeEvents: LifeEvent[] = [...(base.events ?? [])];
  const newDebts: { month: number; debt: Debt }[] = [];
  const newAssets: NonNullable<SimulateOptions['newAssets']>[number][] = [];
  const eventAssets: { eventId: string; group: string; value: Money }[] = [];
  for (const e of ordered) {
    const ctx: PlanEventContext = { profile: { ...base, events: lifeEvents }, assumptions: a, asOf, ...(area && { area }) };
    const x = expandEvent(e, ctx);
    lifeEvents = [...lifeEvents, ...x.lifeEvents];
    const start = eventStartMonth(asOf, planEventMonth(e.year, asOf));
    for (const debt of x.debts) newDebts.push({ month: start, debt });
    newAssets.push(...x.assets);
    for (const asset of x.assets) eventAssets.push({ eventId: e.id, group: asset.group, value: asset.value });
  }

  // 3. The monthly simulation's inputs.
  const simOptions: SimulateOptions = {
    rates: { inflationAnnual: a.inflation },
    shortfallMode: 'separate',
    withdrawalOrder: a.withdrawalOrder,
    ...(a.savingsSplit.length > 0 && { savingsSplit: a.savingsSplit }),
    balances,
    growth,
    expenses: a.expenses,
    newDebts,
    newAssets,
    granularity: 'year',
  };

  // 6. KPI retireAge.
  const retireYears = enabled.filter((ev) => ev.type === 'retire').map((ev) => Math.max(ev.year, asOfYear));
  const retireAge = retireYears.length > 0 ? Math.min(...retireYears) - birthYear : a.retireAge;

  return {
    scenario, asOfYear, offset, birthYear, yearCount, months, live, enabled, eventAssets,
    simProfile: { ...base, events: lifeEvents }, simOptions, retireAge,
  };
}

/**
 * Step 5: the display deflator at the end of each plan year (index y = path[y + 1]), for 'today'
 * (1 for 'future'). With yearly inflation draws, the compounded price level of that path.
 */
export function yearEndDeflators(prep: PreparedPlan, inflationDraws?: readonly Rate[]): Float64Array {
  const { scenario: { assumptions: a }, offset, yearCount, months } = prep;
  const out = new Float64Array(yearCount);
  if (a.display === 'future') return out.fill(1);
  if (!inflationDraws) {
    for (let y = 0; y < yearCount; y++) out[y] = (1 + a.inflation) ** (Math.min(12 * (y + 1) - offset, months) / 12);
    return out;
  }
  // Same product, in the same order, as simulate()'s price path P(t), read at each year's last month.
  let price = 1;
  let t = 0;
  for (let y = 0; y < yearCount; y++) {
    const end = Math.min(12 * (y + 1) - offset, months);
    const r = 1 + monthlyRate(inflationDraws[y]!);
    for (; t < end; t++) price *= r;
    out[y] = price;
  }
  return out;
}

/** One PlanYear per calendar year from `profile.asOf` to `scenario.assumptions.endAge`, plus the four KPIs. */
export function plan(
  profile: Profile, accounts: readonly Account[], scenario: Scenario, area?: AreaData, opts: PlanOptions = {},
): PlanResult {
  const prep = preparePlan(profile, accounts, scenario, area);
  const a = scenario.assumptions;
  const { asOfYear, birthYear, yearCount, live, enabled, eventAssets, retireAge } = prep;

  // 3. The monthly simulation.
  const sim = simulate(prep.simProfile, prep.months, {
    ...prep.simOptions,
    ...(opts.yearlyRates && { yearlyRates: opts.yearlyRates }),
  });
  // path[0] = today, path[y + 1] = the end of plan year y (flows summed over that year).
  const path = sim.path;

  // 5. Deflator at the end of each plan year.
  const deflators = yearEndDeflators(prep, opts.yearlyRates?.inflation);

  // Account rows: shares of each asset group, and groups that need a row of their own.
  const groupAccounts = new Map<AssetGroup, { id: string; share: number }[]>();
  for (const g of ASSET_GROUPS) {
    const own = live.filter((x) => x.group === g);
    if (own.length === 0) continue;
    const total = own.reduce((s, x) => s + x.balance.value, 0);
    groupAccounts.set(g, own.map((x) => ({ id: x.id, share: total > 0 ? x.balance.value / total : 1 / own.length })));
  }
  // A group with no account: one row per event that added to it (`<eventId>:home` for real estate,
  // `<eventId>:<group>` otherwise), by share of the value added; else `group:<group>`.
  const ownRows = new Map<AssetGroup, { id: string; share: number }[]>();
  for (const g of ASSET_GROUPS) {
    if (groupAccounts.has(g)) continue;
    const added = eventAssets.filter((x) => x.group === g);
    const total = added.reduce((s, x) => s + x.value, 0);
    const byEvent = new Map<string, number>();
    for (const x of added) byEvent.set(x.eventId, (byEvent.get(x.eventId) ?? 0) + x.value);
    const part = g === 'realEstate' ? 'home' : g;
    ownRows.set(g, byEvent.size > 0
      ? [...byEvent].map(([id, v]) => ({ id: `${id}:${part}`, share: total > 0 ? v / total : 1 / byEvent.size }))
      : [{ id: `group:${g}`, share: 1 }]);
  }
  const groupUsed = new Set<AssetGroup>();
  for (const m of path) {
    for (const g of GROUPS) {
      const f = m.groups![g];
      if (f.balance !== 0 || f.deposits !== 0) groupUsed.add(g);
    }
  }
  const liabilityIds = new Set(live.filter((x) => !(GROUPS as readonly string[]).includes(x.group)).map((x) => x.id));
  // The rows every year has, in order: one per included account (its group's share, or its debt),
  // then the groups' own rows.
  const accountShare = new Map<string, number>();
  for (const list of groupAccounts.values()) for (const x of list) accountShare.set(x.id, x.share);
  const fixedRows: ({ id: string; debt: true } | { id: string; debt: false; group: AssetGroup; share: number })[] = [];
  for (const acc of live) {
    if (liabilityIds.has(acc.id)) fixedRows.push({ id: acc.id, debt: true });
    else fixedRows.push({ id: acc.id, debt: false, group: acc.group as AssetGroup, share: accountShare.get(acc.id)! });
  }
  for (const g of GROUPS) {
    if (!groupUsed.has(g)) continue;
    for (const r of ownRows.get(g) ?? []) fixedRows.push({ id: r.id, debt: false, group: g, share: r.share });
  }
  const eventsByYear = new Map<number, string[]>();
  for (const ev of enabled) {
    const y = Math.max(ev.year, asOfYear);
    const list = eventsByYear.get(y);
    if (list) list.push(ev.id);
    else eventsByYear.set(y, [ev.id]);
  }

  // 4. One PlanYear per calendar year.
  const years: PlanYear[] = [];
  for (let y = 0; y < yearCount; y++) {
    const year = asOfYear + y;
    const s = path[y]!;
    const e = path[y + 1]!;
    const d = deflators[y]!;
    const $ = (v: Money) => v / d;
    const groups = e.groups!;
    const debtFlows = e.debtFlows!;

    const income = e.income;
    const windfalls = e.oneOffIncome!;
    const spending = e.spending;
    const debtPayments = e.debtPayments;
    const oneOffCosts = e.purchasesCash;
    let drawn = 0;
    for (const g of GROUPS) if (g !== 'cash') drawn += groups[g].withdrawals;
    const debtIds = Object.keys(e.debts);

    const rows: PlanAccountRow[] = [];
    const groupRow = (accountId: string, g: AssetGroup, share: number): PlanAccountRow => ({
      accountId,
      start: $(s.groups![g].balance * share),
      growth: $(groups[g].growth * share),
      deposits: $(groups[g].deposits * share),
      withdrawals: $(groups[g].withdrawals * share),
      end: $(groups[g].balance * share),
    });
    const debtRow = (id: string): PlanAccountRow => {
      const start = s.debts[id] ?? 0;
      const end = e.debts[id] ?? 0;
      const g = debtFlows[id]?.interest ?? 0;
      const dep = debtFlows[id]?.borrowed ?? 0;
      return { accountId: id, start: $(start), growth: $(g), deposits: $(dep), withdrawals: $(start + g + dep - end), end: $(end) };
    };
    for (const r of fixedRows) rows.push(r.debt ? debtRow(r.id) : groupRow(r.id, r.group, r.share));
    for (const id of debtIds) if (!liabilityIds.has(id)) rows.push(debtRow(id));

    let assets = 0;
    for (const g of GROUPS) assets += groups[g].balance;
    const expenses = spending + debtPayments + oneOffCosts;
    years.push({
      year,
      age: year - birthYear,
      netWorth: $(e.netWorth),
      assets: $(assets),
      liabilities: $(e.debtBalance),
      shortfall: $(e.shortfall ?? 0),
      accounts: rows,
      cashFlow: {
        income: [{ key: 'takeHomePay', amount: $(income) }, { key: 'windfalls', amount: $(windfalls) }],
        expenses: [
          { key: 'spending', amount: $(spending) },
          { key: 'debtPayments', amount: $(debtPayments) },
          { key: 'oneOffCosts', amount: $(oneOffCosts) },
        ],
        withdrawals: $(drawn),
        net: $(income + windfalls - expenses),
      },
      events: [...(eventsByYear.get(year) ?? [])],
    });
  }

  // 6. KPIs.
  const first = years[0]!;
  const last = years[years.length - 1]!;
  const atRetirement = years.find((py) => py.age === retireAge) ?? (retireAge < first.age ? first : last);
  const short = years.find((_py, i) => (path[i + 1]!.shortfall ?? 0) > PAID_OFF_EPSILON);
  return {
    years,
    kpis: {
      netWorthEndOfYear: first.netWorth,
      netWorthAtRetirement: atRetirement.netWorth,
      retireAge,
      netWorthAtEnd: last.netWorth,
      shortfallAge: short ? short.age : null,
    },
    display: a.display,
    source: 'rules',
  };
}

/**
 * JF4: a profile home with no real estate account (no accounts at all, or none of that group) is in
 * the run through simulate()'s `withHomeAsset`; its growth is the home's own appreciation, which ranks
 * like an Account.growth (above assumptions.growth and the area's rate), so the plan is the same with
 * or without the Home account profileToAccounts makes. With real estate accounts, theirs decide.
 * Shared with monteCarlo(). Mutates and returns `growth`.
 */
export function homeGrowth(
  growth: Partial<Record<AssetGroup, Rate>>, base: Profile, live: readonly Account[],
): Partial<Record<AssetGroup, Rate>> {
  if (base.home && !live.some((x) => x.group === 'realEstate')) growth.realEstate = base.home.appreciation.value;
  return growth;
}

/**
 * Yearly growth overrides per asset group for simulate(): Account.growth, then assumptions.growth,
 * then (real estate only) the area's home appreciation. A group whose accounts carry their own growth
 * grows at the balance-weighted average of each account's rate (the group's rate for the others; a
 * plain average when the group is 0 today). Groups left out follow simulate()'s defaults, which track
 * the inflation of each year.
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
