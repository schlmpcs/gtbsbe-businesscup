// plan(): the yearly plan to the end age, with shortfall, withdrawal order and savings split.
// Task MP3 (#163). Built on simulate() (./simulate.ts, "Plan options"), never a fork of it.
//
// 1. Inputs: accountsToProfile (MP8) gives cash, retirement and debts. Investments are kept out of
//    the profile's retirement (accountsToProfile folds them in) and carried, with real estate,
//    vehicles and other assets, as their own group balances. With no accounts at all, the profile's
//    own cash, retirement and debts are used.
// 2. Events: the enabled ones are expanded (MP4 expandEvent) in date order (same year: Retire first,
//    Social Security last, otherwise list order), each on the profile with the life events of those
//    before it, as expandEvent's stacking rule asks. Their debts open in the event's start month and
//    their assets (the home) are added in theirs.
// 3. simulate() runs monthly from `asOf` through December of the year the person turns `endAge`
//    (age in calendar year Y = Y − (asOf year − round(age))), with shortfallMode 'separate', the
//    scenario's inflation, withdrawalOrder, savingsSplit (empty = profile.retirementShare), expenses
//    and growth. Growth per group: Account.growth, then assumptions.growth, then the engine default
//    (real estate: AreaData.homeAppreciationAnnual when there is one). Several accounts of one group
//    with their own growth make the group grow at their balance-weighted average.
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
import { expandEvent, planEventMonth } from './planEvents';
import { type ExtraAssetGroup, type SimulateOptions, type YearlyRates, monthlyRate, simulate } from './simulate';

/** Internal inputs for monteCarlo() (MP5): per plan year rate draws, index 0 = the year of asOf. */
export type PlanOptions = { yearlyRates?: YearlyRates };

const EXTRA_GROUPS: readonly ExtraAssetGroup[] = ['investments', 'realEstate', 'vehicle', 'otherAsset'];

/** Same year: Retire before everything, Social Security after (see planEvents.ts → socialSecurity). */
const sameYearRank = (e: PlanEvent) => (e.type === 'retire' ? 0 : e.type === 'socialSecurity' ? 2 : 1);

/** One PlanYear per calendar year from `profile.asOf` to `scenario.assumptions.endAge`, plus the four KPIs. */
export function plan(
  profile: Profile, accounts: readonly Account[], scenario: Scenario, area?: AreaData, opts: PlanOptions = {},
): PlanResult {
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
  const growth = groupGrowth(live, a.growth, a.inflation, area);

  // 2. Events, in date order, each expanded on the profile with the ones before it.
  const enabled = scenario.events.filter((e) => e.enabled);
  const ordered = enabled
    .map((e, i) => ({ e, i }))
    .sort((x, y) => x.e.year - y.e.year || sameYearRank(x.e) - sameYearRank(y.e) || x.i - y.i)
    .map(({ e }) => e);
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

  // 3. The monthly simulation.
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
    ...(opts.yearlyRates && { yearlyRates: opts.yearlyRates }),
  });
  const path = sim.path;
  const debtApr = sim.debtApr ?? {};

  // 5. Deflator at path index m.
  let priceAt: number[] | null = null;
  const inflationDraws = opts.yearlyRates?.inflation;
  if (inflationDraws) {
    priceAt = [1];
    for (let t = 0; t < months; t++) {
      priceAt.push(priceAt[t]! * (1 + monthlyRate(inflationDraws[Math.floor((offset + t) / 12)]!)));
    }
  }
  const deflatorAt = (m: number) =>
    a.display === 'future' ? 1 : priceAt ? priceAt[m]! : (1 + a.inflation) ** (m / 12);

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
    for (const g of ASSET_GROUPS) {
      const f = m.groups![g];
      if (f.balance !== 0 || f.deposits !== 0) groupUsed.add(g);
    }
  }
  const liabilityIds = new Set(live.filter((x) => !(ASSET_GROUPS as readonly string[]).includes(x.group)).map((x) => x.id));

  // 4. One PlanYear per calendar year.
  const years: PlanYear[] = [];
  for (let y = 0; y < yearCount; y++) {
    const year = asOfYear + y;
    const from = y === 0 ? 0 : 12 * y - offset;
    const to = 12 * (y + 1) - offset;
    const s = path[from]!;
    const e = path[to]!;
    const d = deflatorAt(to);
    const $ = (v: Money) => v / d;

    let income = 0, windfalls = 0, spending = 0, debtPayments = 0, oneOffCosts = 0, drawn = 0;
    const flows = Object.fromEntries(ASSET_GROUPS.map((g) => [g, { growth: 0, deposits: 0, withdrawals: 0 }])) as
      Record<AssetGroup, { growth: Money; deposits: Money; withdrawals: Money }>;
    const debtIds = Object.keys(e.debts);
    const interest: Record<string, Money> = {};
    const borrowed: Record<string, Money> = {};
    for (const id of debtIds) { interest[id] = 0; borrowed[id] = 0; }
    for (let m = from + 1; m <= to; m++) {
      const pm = path[m]!;
      const prev = path[m - 1]!;
      income += pm.income;
      windfalls += pm.oneOffIncome ?? 0;
      spending += pm.spending;
      debtPayments += pm.debtPayments;
      oneOffCosts += pm.purchasesCash;
      for (const g of ASSET_GROUPS) {
        const f = pm.groups![g];
        flows[g].growth += f.growth;
        flows[g].deposits += f.deposits;
        flows[g].withdrawals += f.withdrawals;
        if (g !== 'cash') drawn += f.withdrawals;
      }
      for (const id of debtIds) {
        const before = prev.debts[id];
        if (before === undefined) {
          if (pm.debts[id] !== undefined) borrowed[id]! += pm.debts[id]!; // opened this month
        } else if (before > PAID_OFF_EPSILON) {
          interest[id]! += before * ((debtApr[id] ?? 0) / 12);
        }
      }
    }

    const rows: PlanAccountRow[] = [];
    const groupRow = (accountId: string, g: AssetGroup, share: number): PlanAccountRow => ({
      accountId,
      start: $(s.groups![g].balance * share),
      growth: $(flows[g].growth * share),
      deposits: $(flows[g].deposits * share),
      withdrawals: $(flows[g].withdrawals * share),
      end: $(e.groups![g].balance * share),
    });
    const debtRow = (id: string): PlanAccountRow => {
      const start = s.debts[id] ?? 0;
      const end = e.debts[id] ?? 0;
      const g = interest[id] ?? 0;
      const dep = borrowed[id] ?? 0;
      return { accountId: id, start: $(start), growth: $(g), deposits: $(dep), withdrawals: $(start + g + dep - end), end: $(end) };
    };
    for (const acc of live) {
      if (liabilityIds.has(acc.id)) {
        rows.push(debtRow(acc.id));
      } else {
        const g = acc.group as AssetGroup;
        rows.push(groupRow(acc.id, g, groupAccounts.get(g)!.find((x) => x.id === acc.id)!.share));
      }
    }
    for (const g of ASSET_GROUPS) {
      if (!groupUsed.has(g)) continue;
      for (const r of ownRows.get(g) ?? []) rows.push(groupRow(r.id, g, r.share));
    }
    for (const id of debtIds) if (!liabilityIds.has(id)) rows.push(debtRow(id));

    let assets = 0;
    for (const g of ASSET_GROUPS) assets += e.groups![g].balance;
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
      events: enabled.filter((ev) => Math.max(ev.year, asOfYear) === year).map((ev) => ev.id),
    });
  }

  // 6. KPIs.
  const retireYears = enabled.filter((ev) => ev.type === 'retire').map((ev) => Math.max(ev.year, asOfYear));
  const retireAge = retireYears.length > 0 ? Math.min(...retireYears) - birthYear : a.retireAge;
  const first = years[0]!;
  const last = years[years.length - 1]!;
  const atRetirement = years.find((py) => py.age === retireAge) ?? (retireAge < first.age ? first : last);
  const short = years.find((py, i) => (path[12 * (i + 1) - offset]!.shortfall ?? 0) > PAID_OFF_EPSILON);
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
