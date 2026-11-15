// Y2 (Amir): the month-by-month money simulation behind forecast() and, later, canAfford() (Y4)
// and rankMoves() (Y3). Spec: docs/ENGINEERING.md → Forecast.
//
// Conventions (all monthly; t = month index starting at 0, month m = t + 1 ends after step t):
// - The path has one entry per month end, index = month number. Entry 0 is today's balance sheet
//   (its flow fields are 0); entry m is the state at the end of month m.
// - Each month, in order:
//   1. cash grows at cashYield (only while positive), retirement at returnAnnualNominal, using the
//      effective monthly rate (1 + annual)^(1/12) − 1;
//   2. every debt with a balance accrues interest at apr / 12 (the loan engine's convention) and is
//      paid min(required + extraPayment, balance + interest); a paid-off debt's payment stops, so the
//      money it freed flows into the surplus from then on;
//   3. purchases due this month: cash ones are part of this month's outflow, card ones are added to
//      the card balance, loan ones add an amortizing debt whose first payment is next month;
//   4. surplus = income − spending − debt payments − cash purchases. Above 0: it first pays down the
//      card balances of `payOffFromSurplus` purchases (oldest purchase first), then retirementShare
//      of the rest goes to retirement and the rest to cash. Below 0: drawn from cash; once cash
//      would go below 0, the shortfall is added to a card balance (see `cardTarget`; the part a
//      `payOffFromSurplus` purchase caused goes on that purchase's own card balance instead).
// - income = takeHomePay × (1 + incomeGrowth)^(t/12); spending = Σ categories except debtPayments
//   × (1 + inflation)^(t/12). `spending.debtPayments` is informational: payments come from `debts`.
// - Life events (`p.events`, dated from `p.asOf`; ./events.ts), in today's dollars like every amount:
//   from its start month a pay event replaces the take-home in the income formula above and a
//   spending event replaces its category in the spending sum (so both grow from month 0, not from
//   the event); a one-off cost is paid from cash in its month like a cash purchase (in
//   `purchasesCash`), a one-off income is added to cash; both × (1 + inflation)^(t/12). The latest
//   start wins on a field, a tie goes to the later event in the list.
// - Purchases are consumption, not assets: nothing is added to net worth for the thing bought.
// - The home (JF4, #136): a profile with `p.home` (an owner) opens the realEstate group at
//   `home.value` growing at `home.appreciation` (`withHomeAsset`), so its net worth follows the plan
//   options rule below: cash + retirement + home − debts (a 'mortgage' debt's payments build equity).
//   An explicit `balances.realEstate` / `growth.realEstate` wins (plan() passes the accounts', which
//   accountsToProfile keeps in step with `home.value`), so the home is never counted twice. The home
//   value is not shifted by `scenario`. A renter (no `p.home`) gets exactly the rules above.
//
// Plan options (MP3, #163; used by plan() and monteCarlo()). All optional; without any of them the
// simulation is exactly the one above and `SimulationMonth.groups` / `.shortfall` are absent.
// - Asset groups: besides cash and retirement, `balances` opens investments, realEstate, vehicle and
//   otherAsset balances. Each group grows in step 1 at the effective monthly rate of its yearly rate:
//   cash cashYield (only while positive), investments and retirement returnAnnualNominal, realEstate
//   and otherAsset inflation, vehicle vehicleDepreciationAnnual (−15%). `growth[group]` replaces the
//   default (plan() passes AreaData.homeAppreciationAnnual as `growth.realEstate`); a
//   `yearlyRates.growth[group]` array replaces both, year by year. Liability groups are ignored there.
// - `yearlyRates.inflation[y]`: inflation of plan year y. Plan years are calendar years from `p.asOf`
//   (y = 0 is the year of asOf, possibly partial), or 12-month blocks from month 0 without asOf. Prices
//   then follow the compounded path P(0) = 1, P(t + 1) = P(t) × (1 + i_y(t))^(1/12) in place of
//   (1 + inflation)^(t/12): spending, extraMonthly, one-off events and recurring purchases (scale
//   P(t) / P(start)); income too, unless `rates.incomeGrowthAnnual` is set. Every array must cover
//   every plan year simulated (RangeError otherwise).
// - `expenses`: 'budget' (default) = the profile's categories; 'manual' = one `other` line of
//   `monthly` in place of all of them (spending events still replace their category).
// - `savingsSplit`: the positive surplus left after payOffFromSurplus cards is split across asset
//   groups, left × share each (shares ≥ 0 summing to 1 within 1e-9), instead of retirementShare to
//   retirement and the rest to cash.
// - `withdrawalOrder`: once cash would go below 0, the rest is drawn from these asset groups in order
//   (cash is always drawn first, wherever it is listed). Only what they cannot cover goes on, to a
//   card ('card', default) or, with `shortfallMode: 'separate'`, to the `shortfall` balance: unfunded
//   expenses, never paid back, growing each month at the monthly inflation rate before new unfunded
//   outflow is added. In 'separate' mode no card is ever charged for a shortfall (a payOffFromSurplus
//   purchase's uncovered cash part included); card purchases still go on a card.
// - `newDebts` open in step 3 of their month (first payment the month after, like a loan purchase);
//   `newAssets` are added to their group in step 1 of their month, after its growth (a deposit).
// - With any plan option, netWorth = all asset groups − debtBalance − shortfall, and each entry has
//   `debtFlows` (interest charged, amount borrowed, by debt).
// - `granularity: 'year'` returns one entry per plan year (flows summed in month order) instead of one
//   per month; the numbers at those months are the same. plan() and monteCarlo() use it: the monthly
//   loop then allocates nothing.
import {
  ASSET_GROUPS,
  type AccountGroup,
  type AreaData,
  type AssetGroup,
  type Debt,
  type LoanInput,
  type Money,
  type PlanAssumptions,
  type Profile,
  type Purchase,
  type Rate,
} from '@lifeguessr/types';
import {
  cardAprDefault,
  cardMinPayment,
  cashYieldAnnual,
  estimateSpread,
  inflationAnnualFallback,
  minForecastMonths,
  returnAnnualNominal,
  vehicleDepreciationAnnual,
} from './assumptions';
import { eventStartMonth, scheduleEvents } from './events';
import { MAX_SIMULATION_MONTHS, PAID_OFF_EPSILON, amortizedPayment } from './loan/amortize';

/** Id of the card debt the simulation opens when it needs a card and the profile has none. */
export const SYNTHETIC_CARD_ID = 'card-synthetic';

/** Yearly rates the simulation uses. Defaults come from `assumptions.ts`. */
export type ForecastRates = {
  inflationAnnual: Rate;     // prices (spending) and the today's-dollars deflator
  incomeGrowthAnnual: Rate;  // take-home pay growth; defaults to inflationAnnual (real income flat)
  cashYieldAnnual: Rate;
  returnAnnualNominal: Rate; // retirement
  cardApr: Rate;             // APR of the synthetic card opened for shortfalls / card purchases
};

/**
 * A purchase plus when it first happens. `startMonth` is the 0-based month index of the first
 * occurrence (default 0 = this month); recurring purchases repeat every month / every 12 months from
 * there. A plain `Purchase` is a valid `ScheduledPurchase`.
 *
 * `payOffFromSurplus` (default false) models paying off what the purchase puts on a card instead of
 * letting it revolve at the minimum payment (Can I Afford It?, rule 3). Every card balance the
 * purchase creates (its card charges, and the part of its cash payment or loan down payment that
 * cash could not cover) goes on a card balance of its own, at the APR of the profile's first card
 * (`cardApr` without one). That balance needs the card minimum like any card, and each month's
 * positive surplus pays it down before anything goes to cash or retirement. Its id is in
 * `Simulation.payoffCardIds`. Without the flag a purchase follows the forecast's default rules.
 */
export type ScheduledPurchase = Purchase & { startMonth?: number; payOffFromSurplus?: boolean };

/** Which inputs to use: point values (`mid`) or every estimate shifted against / in the user's favor. */
export type Scenario = 'low' | 'mid' | 'high';

/** Asset groups other than cash and retirement (the profile has its own fields for those two). */
export type ExtraAssetGroup = Exclude<AssetGroup, 'cash' | 'retirement'>;

/**
 * Per plan year rates (MP5 feeds one sampled draw per year). Index y = plan year (see the header).
 * Liability groups in `growth` are ignored.
 */
export type YearlyRates = {
  inflation?: readonly Rate[];
  growth?: Partial<Record<AccountGroup, readonly Rate[]>>;
};

export type SimulateOptions = {
  /** Additional monthly saving in today's dollars; inflated with prices, never income growth. */
  extraMonthly?: Money;
  extra?: readonly ScheduledPurchase[];
  rates?: Partial<ForecastRates>;
  scenario?: Scenario;
  // ----- Plan options (MP3); see the header. -----
  /** Where the outflow nothing can cover goes: a card (default) or the `shortfall` balance. */
  shortfallMode?: 'card' | 'separate';
  /** Asset groups drawn in order once cash is empty (cash is always first). Liabilities: RangeError. */
  withdrawalOrder?: readonly AccountGroup[];
  /** Split of the positive surplus by asset group; shares ≥ 0 summing to 1. Liabilities: RangeError. */
  savingsSplit?: PlanAssumptions['savingsSplit'];
  /** Opening BALANCES (≥ 0) of the asset groups the profile has no field for. */
  balances?: Partial<Record<ExtraAssetGroup, Money>>;
  /** Yearly growth per asset group, replacing the group default. */
  growth?: PlanAssumptions['growth'];
  /** Spending base: the profile's categories ('budget', default) or one manual monthly amount. */
  expenses?: PlanAssumptions['expenses'];
  yearlyRates?: YearlyRates;
  /**
   * Debts that open in a later month (expandEvent's mortgage or financed purchase): added in step 3 of
   * month `month` (0-based), like a loan purchase, so the first payment is the month after. The id is
   * made unique if it is taken. The required payment is `minPayment` (the card formula for an
   * estimated card minimum), shifted by `scenario` like a profile debt.
   */
  newDebts?: readonly { month: number; debt: Debt }[];
  /** BALANCES added to an asset group in month `month` after its growth (expandEvent's home value). */
  newAssets?: readonly { group: AccountGroup; month: number; value: Money }[];
  /**
   * 'month' (default): one path entry per month. 'year': entry 0 is still today, then one entry per
   * plan year (see the header) at the year's last simulated month, with every flow summed over the
   * year's months in month order (debtLoad = summed required payments / summed income). Balances are
   * the same as the monthly path's at those months. For plan() and monteCarlo(): no per-month
   * objects are built.
   */
  granularity?: 'month' | 'year';
};

/** One debt over one path entry (plan options only): interest charged and amount borrowed. */
export type DebtFlow = { interest: Money; borrowed: Money };

/** One asset group over one month: flows for the month, the balance at its end. */
export type GroupMonth = { balance: Money; growth: Money; deposits: Money; withdrawals: Money };

/** State at the end of one month. Flows are for that month; balances are at its end. */
export type SimulationMonth = {
  month: number;
  income: Money;
  spending: Money;              // profile categories (not purchases)
  debtPayments: Money;          // everything paid on debts, extra payments included
  requiredDebtPayments: Money;  // minimum payments only (what debt load is measured on)
  purchasesCash: Money;         // cash paid for purchases (a loan purchase's unfinanced part)
  cardCharges: Money;           // purchases put on a card
  surplus: Money;               // income − spending − debtPayments − purchasesCash
  shortfallToCard: Money;       // the part of a negative surplus that cash could not cover
  payoffCardCharges: Money;     // added to `payOffFromSurplus` card balances (charges + their shortfall)
  surplusToPayoffCards: Money;  // the part of a positive surplus that paid those balances down
                                // (not in debtPayments, which are paid before the surplus)
  cash: Money;
  retirement: Money;
  debtBalance: Money;           // Σ all debt balances
  cardBalance: Money;           // Σ balances of kind 'card' (the synthetic card included)
  debts: Record<string, Money>; // balance by debt id
  netWorth: Money;              // cash + retirement − debtBalance (a home or plan options: Σ groups − debtBalance − shortfall)
  debtLoad: Rate;               // requiredDebtPayments / income (∞ when income is 0 and payments > 0)
  // Present only with a plan option (MP3):
  groups?: Record<AssetGroup, GroupMonth>; // cash and retirement included (same balances as above)
  shortfall?: Money;            // unfunded expenses so far (a BALANCE, ≥ 0)
  shortfallAdded?: Money;       // unfunded outflow of this month (in `shortfall`, after its growth)
  oneOffIncome?: Money;         // one-off income events this month, paid into cash (not in `income`)
  debtFlows?: Record<string, DebtFlow>; // by debt id: interest charged, amount borrowed (opened or charged)
};

export type Simulation = {
  rates: ForecastRates;
  /** Index m = end of month m; index 0 = today. Length = months + 1. */
  path: SimulationMonth[];
  /** First month each debt's balance reached 0 (0 = already paid off; null = not within the horizon). */
  payoffMonth: Record<string, number | null>;
  /**
   * Per `opts.extra` entry, in the same order: the id of the card balance its `payOffFromSurplus`
   * opened, or null (no flag, or nothing was ever put on a card within the horizon).
   */
  payoffCardIds: (string | null)[];
  /** With a plan option: the APR of every debt by id (opened ones included), for interest by debt. */
  debtApr?: Record<string, Rate>;
};

/** Effective monthly rate for a yearly rate: (1 + annual)^(1/12) − 1. */
export function monthlyRate(annual: Rate): Rate {
  return (1 + annual) ** (1 / 12) - 1;
}

/** Inflation for an area: BLS CPI-U YoY from AreaData when there is one, else the fallback. */
export function inflationAnnualOf(area?: Pick<AreaData, 'cpiYoY'> | null): Rate {
  return area?.cpiYoY.value ?? inflationAnnualFallback.value;
}

/** Fills in the default rates; incomeGrowthAnnual defaults to the (possibly overridden) inflation. */
export function resolveRates(rates?: Partial<ForecastRates>): ForecastRates {
  const inflationAnnual = rates?.inflationAnnual ?? inflationAnnualFallback.value;
  const resolved: ForecastRates = {
    inflationAnnual,
    incomeGrowthAnnual: rates?.incomeGrowthAnnual ?? inflationAnnual,
    cashYieldAnnual: rates?.cashYieldAnnual ?? cashYieldAnnual.value,
    returnAnnualNominal: rates?.returnAnnualNominal ?? returnAnnualNominal.value,
    cardApr: rates?.cardApr ?? cardAprDefault.value,
  };
  for (const [name, value] of Object.entries(resolved)) {
    if (!Number.isFinite(value) || value <= -1) throw new RangeError(`Invalid ${name}: ${value}`);
  }
  return resolved;
}

/** Months a forecast of `years` simulates: max(minForecastMonths, ⌈years × 12⌉), capped at 100 years. */
export function forecastMonths(years: number): number {
  if (!Number.isFinite(years) || years < 0) throw new RangeError(`Invalid forecast years: ${years}`);
  const months = Math.max(minForecastMonths.value, Math.ceil(years * 12));
  if (months > MAX_SIMULATION_MONTHS) throw new RangeError(`Forecast too long: ${months} months`);
  return months;
}

/** Card minimum payment (cardMinPayment): this month's interest + 1% of the balance, floor $25. */
export function cardMinPaymentFor(balance: Money, apr: Rate): Money {
  if (balance <= 0) return 0;
  const f = cardMinPayment.value;
  const interest = f.includesInterest ? balance * (apr / 12) : 0;
  return Math.max(f.floor, interest + f.balanceShare * balance);
}

/**
 * Required monthly payment rule for a debt. A card whose minimum payment is an estimate (the user
 * skipped it) follows `cardMinPaymentFor` every month, so it shrinks with the balance like a real
 * issuer minimum; the stored value is only today's output of that formula. Every other debt pays
 * its stated `minPayment.value` until it is paid off.
 */
export function usesCardFormula(d: Pick<Debt, 'kind' | 'minPayment'>): boolean {
  return d.kind === 'card' && d.minPayment.isEstimate;
}

/**
 * `opts` with the profile's home as the realEstate group (JF4): opening balance `home.value`, yearly
 * growth `home.appreciation`, unless `opts` already sets them. A profile without a home gets `opts` back
 * unchanged (the same object). simulate() applies it to every run; plan() / monteCarlo() use it to read
 * the realEstate growth the run will use.
 */
export function withHomeAsset<T extends Pick<SimulateOptions, 'balances' | 'growth'>>(p: Pick<Profile, 'home'>, opts: T): T {
  const home = p.home;
  if (!home) return opts;
  return {
    ...opts,
    balances: { ...opts.balances, realEstate: opts.balances?.realEstate ?? home.value.value },
    growth: { ...opts.growth, realEstate: opts.growth?.realEstate ?? home.appreciation.value },
  };
}

/** True when any input the simulation reads is an estimate (so the range band is not zero). */
export function hasEstimates(p: Profile): boolean {
  return (
    p.takeHomePay.isEstimate ||
    p.cash.isEstimate ||
    p.retirement.isEstimate ||
    p.retirementShare.isEstimate ||
    Object.entries(p.spending).some(([c, e]) => c !== 'debtPayments' && e.isEstimate) ||
    p.debts.some((d) => d.minPayment.isEstimate) ||
    (p.events ?? []).some((e) =>
      (e.kind === 'pay' && e.takeHomePay.isEstimate) || (e.kind === 'spending' && e.monthly.isEstimate))
  );
}

/**
 * Shifts an estimated value by ±estimateSpread × |value|: in the user's favor for 'high', against
 * it for 'low'. Point values ('mid') and measured values pass through unchanged.
 */
function shift(value: number, isEstimate: boolean, scenario: Scenario, higherIsBetter: boolean): number {
  if (!isEstimate || scenario === 'mid') return value;
  const up = (scenario === 'high') === higherIsBetter;
  const delta = estimateSpread.value * Math.abs(value);
  return up ? value + delta : value - delta;
}

type DebtState = {
  id: string;
  kind: Debt['kind'];
  apr: Rate;
  balance: Money;
  fixedPayment: Money | null; // null = card formula
  paymentFactor: number;      // scenario shift of the required payment
  extra: Money;
  payoffMonth: number | null;
  interestAcc: Money;         // since the last path entry (plan options: debtFlows)
  borrowedAcc: Money;
};

/** The loan a `{ loan }` purchase opens, the cash it costs at purchase, both scaled by `scale`. */
function financePurchase(amount: Money, l: LoanInput, scale: number): { cashOut: Money; principal: Money; payment: Money } {
  const loanAmount = l.amount * scale;
  const downPayment = (l.downPayment ?? 0) * scale;
  const fees = (l.fees ?? 0) * scale;
  const advanced = Math.max(0, loanAmount - downPayment); // what the lender pays toward the price
  const principal = advanced + fees;                       // fees are rolled into the loan
  return {
    cashOut: amount * scale - advanced, // < 0 only if the loan is larger than the price
    principal,
    payment: amortizedPayment(principal, l.apr, l.termMonths),
  };
}

const EXTRA_ASSET_GROUPS = ['investments', 'realEstate', 'vehicle', 'otherAsset'] as const satisfies readonly ExtraAssetGroup[];

function isAssetGroup(g: AccountGroup): g is AssetGroup {
  return (ASSET_GROUPS as readonly AccountGroup[]).includes(g);
}

function checkRate(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= -1) throw new RangeError(`Invalid ${name}: ${value}`);
}

function hasPlanOptions(opts: SimulateOptions): boolean {
  return opts.shortfallMode !== undefined || opts.withdrawalOrder !== undefined || opts.savingsSplit !== undefined
    || opts.balances !== undefined || opts.growth !== undefined || opts.expenses !== undefined
    || opts.yearlyRates !== undefined || opts.newDebts !== undefined || opts.newAssets !== undefined;
}

/**
 * Index of each asset group (ASSET_GROUPS order) in the Float64Arrays of the monthly loop: indexed
 * typed arrays instead of string-keyed records keep the hot loop free of keyed lookups.
 */
const GROUP_INDEX: Record<AssetGroup, number> = { cash: 0, investments: 1, retirement: 2, realEstate: 3, vehicle: 4, otherAsset: 5 };
const CASH = 0;
const RETIREMENT = 2;
const EXTRA_INDICES = EXTRA_ASSET_GROUPS.map((g) => GROUP_INDEX[g]);
// Module-level copies of imported values the monthly loop reads: one binding lookup at load instead
// of one per month (bundlers and test runners may compile an imported binding to a property read).
const GROUPS: readonly AssetGroup[] = [...ASSET_GROUPS];
const N_GROUPS = GROUPS.length;
const EPS = PAID_OFF_EPSILON;

function occursAt(x: ScheduledPurchase, t: number): boolean {
  const start = x.startMonth ?? 0;
  if (t < start) return false;
  if (x.recurring === false) return t === start;
  if (x.recurring === 'monthly') return true;
  return (t - start) % 12 === 0;
}

/**
 * Month-by-month simulation of a profile's cash, retirement and debts (see the header for the
 * rules). Pure: the profile and purchases are not mutated. `scenario` shifts every `isEstimate`
 * input by ±estimateSpread (income, cash, retirement up = favorable; spending down = favorable;
 * retirementShare up when retirement returns beat cash; an estimated debt payment up when the
 * debt's APR beats the cash yield), event values included. RangeError when the profile has events
 * but no `asOf`, or a plan option is invalid.
 */
export function simulate(p: Profile, months: number, options: SimulateOptions = {}): Simulation {
  const opts = withHomeAsset(p, options);
  if (!Number.isInteger(months) || months < 0 || months > MAX_SIMULATION_MONTHS) {
    throw new RangeError(`Invalid simulation length: ${months} months`);
  }
  const extraMonthly = opts.extraMonthly ?? 0;
  if (!Number.isFinite(extraMonthly) || extraMonthly < 0) throw new RangeError('Invalid extraMonthly');
  const rates = resolveRates(opts.rates);
  const scenario = opts.scenario ?? 'mid';
  const extra = opts.extra ?? [];
  for (const x of extra) {
    const start = x.startMonth ?? 0;
    if (!Number.isInteger(start) || start < 0) throw new RangeError(`Invalid purchase startMonth: ${start}`);
  }

  // Plan options (MP3).
  const planMode = hasPlanOptions(opts);
  if (opts.shortfallMode !== undefined && opts.shortfallMode !== 'card' && opts.shortfallMode !== 'separate') {
    throw new RangeError(`Invalid shortfallMode: ${String(opts.shortfallMode)}`);
  }
  const separate = opts.shortfallMode === 'separate';
  const drawOrder: number[] = []; // group indices
  for (const g of opts.withdrawalOrder ?? []) {
    if (!isAssetGroup(g)) throw new RangeError(`Invalid withdrawalOrder group: ${g}`);
    if (g !== 'cash') drawOrder.push(GROUP_INDEX[g]);
  }
  let split: { gi: number; share: Rate }[] | null = null;
  if (opts.savingsSplit) {
    split = [];
    let sum = 0;
    for (const { group, share } of opts.savingsSplit) {
      if (!isAssetGroup(group)) throw new RangeError(`Invalid savingsSplit group: ${group}`);
      if (!Number.isFinite(share) || share < 0) throw new RangeError(`Invalid savingsSplit share: ${share}`);
      split.push({ gi: GROUP_INDEX[group], share });
      sum += share;
    }
    if (Math.abs(sum - 1) > 1e-9) throw new RangeError(`savingsSplit shares must sum to 1, got ${sum}`);
  }
  // Balances of the extra groups by group index (cash and retirement live in their own variables).
  const bal = new Float64Array(ASSET_GROUPS.length);
  for (const g of EXTRA_ASSET_GROUPS) {
    const v = opts.balances?.[g];
    if (v === undefined) continue;
    if (!Number.isFinite(v) || v < 0) throw new RangeError(`Invalid ${g} balance: ${v}`);
    bal[GROUP_INDEX[g]] = v;
  }
  for (const g of ASSET_GROUPS) {
    const r = opts.growth?.[g];
    if (r !== undefined) checkRate(`${g} growth`, r);
  }
  const yearly = opts.yearlyRates;
  if (opts.granularity !== undefined && opts.granularity !== 'month' && opts.granularity !== 'year') {
    throw new RangeError(`Invalid granularity: ${String(opts.granularity)}`);
  }
  const byYear = opts.granularity === 'year';
  // Plan year of month t: calendar years from asOf (asOf's month of the year is the offset), else
  // 12-month blocks.
  const monthOffset = (yearly || byYear) && p.asOf !== undefined
    ? eventStartMonth(`${p.asOf.slice(0, 4)}-01`, p.asOf)
    : 0;
  const yearOf = (t: number) => Math.floor((monthOffset + t) / 12);
  const yearCount = months > 0 ? yearOf(months - 1) + 1 : 0;
  const checkYearly = (name: string, arr: readonly Rate[]) => {
    if (arr.length < yearCount) throw new RangeError(`${name} covers ${arr.length} plan years, needs ${yearCount}`);
    for (const r of arr) checkRate(name, r);
  };
  if (yearly?.inflation) checkYearly('yearlyRates.inflation', yearly.inflation);
  for (const g of ASSET_GROUPS) {
    const arr = yearly?.growth?.[g];
    if (arr) checkYearly(`yearlyRates.growth.${g}`, arr);
  }
  // Price level path P(t) when inflation varies by year; null = (1 + inflation)^(t/12).
  let priceAt: number[] | null = null;
  if (yearly?.inflation) {
    const inflation = yearly.inflation;
    priceAt = [1];
    for (let t = 0; t < months; t++) priceAt.push(priceAt[t]! * (1 + monthlyRate(inflation[yearOf(t)]!)));
  }
  const incomeFollowsPrices = priceAt !== null && opts.rates?.incomeGrowthAnnual === undefined;
  const newDebts = opts.newDebts ?? [];
  for (const { month, debt } of newDebts) {
    if (!Number.isInteger(month) || month < 0) throw new RangeError(`Invalid new debt month: ${month}`);
    if (!Number.isFinite(debt.balance) || debt.balance < 0) throw new RangeError(`Invalid new debt balance: ${debt.balance}`);
    checkRate('new debt apr', debt.apr);
  }
  const newAssets: { gi: number; month: number; value: Money }[] = [];
  for (const { group, month, value } of opts.newAssets ?? []) {
    if (!isAssetGroup(group)) throw new RangeError(`Invalid new asset group: ${group}`);
    if (!Number.isInteger(month) || month < 0) throw new RangeError(`Invalid new asset month: ${month}`);
    if (!Number.isFinite(value) || value < 0) throw new RangeError(`Invalid new asset value: ${value}`);
    newAssets.push({ gi: GROUP_INDEX[group], month, value });
  }
  const cashYield0 = opts.growth?.cash ?? rates.cashYieldAnnual;
  const retirementReturn0 = opts.growth?.retirement ?? rates.returnAnnualNominal;

  const events = scheduleEvents(p);
  let nextEvent = 0;

  // Base amounts in today's dollars; events replace them from their start month.
  let takeHome = shift(p.takeHomePay.value, p.takeHomePay.isEstimate, scenario, true);
  const categorySpending = new Map<string, Money>(); // insertion order = the order summed
  let monthlySpending = 0;
  if (opts.expenses?.mode === 'manual') {
    const monthly = opts.expenses.monthly;
    if (!Number.isFinite(monthly) || monthly < 0) throw new RangeError(`Invalid manual expenses: ${monthly}`);
    categorySpending.set('other', monthly);
    monthlySpending = monthly;
  } else {
    for (const [category, e] of Object.entries(p.spending)) {
      if (category === 'debtPayments') continue;
      const value = shift(e.value, e.isEstimate, scenario, false);
      categorySpending.set(category, value);
      monthlySpending += value;
    }
  }
  const retirementBeatsCash = retirementReturn0 > cashYield0;
  const retirementShare = Math.min(
    1,
    Math.max(0, shift(p.retirementShare.value, p.retirementShare.isEstimate, scenario, retirementBeatsCash)),
  );
  let cash = shift(p.cash.value, p.cash.isEstimate, scenario, true);
  let retirement = shift(p.retirement.value, p.retirement.isEstimate, scenario, true);

  const debts: DebtState[] = p.debts.map((d) => ({
    id: d.id,
    kind: d.kind,
    apr: d.apr,
    balance: d.balance,
    fixedPayment: usesCardFormula(d) ? null : d.minPayment.value,
    paymentFactor: shift(1, d.minPayment.isEstimate, scenario, d.apr > cashYield0),
    extra: d.extraPayment ?? 0,
    payoffMonth: d.balance <= PAID_OFF_EPSILON ? 0 : null,
    interestAcc: 0,
    borrowedAcc: 0,
  }));
  const usedIds = new Set(debts.map((d) => d.id));
  const uniqueId = (base: string) => {
    let id = base;
    for (let i = 2; usedIds.has(id); i++) id = `${base}-${i}`;
    usedIds.add(id);
    return id;
  };

  // Shortfalls and card purchases go onto the first card in the profile; without one, a card at
  // the default APR is opened the first time it is needed (minimum payment by the card formula).
  let cardTarget: DebtState | undefined = debts.find((d) => d.kind === 'card');
  const chargeCard = (amount: Money) => {
    if (amount <= 0) return;
    if (!cardTarget) {
      cardTarget = {
        id: uniqueId(SYNTHETIC_CARD_ID),
        kind: 'card',
        apr: rates.cardApr,
        balance: 0,
        fixedPayment: null,
        paymentFactor: 1,
        extra: 0,
        payoffMonth: null,
        interestAcc: 0,
        borrowedAcc: 0,
      };
      debts.push(cardTarget);
    }
    cardTarget.balance += amount;
    cardTarget.borrowedAcc += amount;
  };

  // `payOffFromSurplus` purchases: one card balance per purchase, opened at its first charge.
  const payoffCardApr = debts.find((d) => d.kind === 'card')?.apr ?? rates.cardApr;
  const payoffCards: (DebtState | null)[] = extra.map(() => null);
  const chargePayoffCard = (i: number, amount: Money) => {
    let d = payoffCards[i];
    if (!d) {
      d = {
        id: uniqueId(`purchase-card-${i + 1}`),
        kind: 'card',
        apr: payoffCardApr,
        balance: 0,
        fixedPayment: null,
        paymentFactor: 1,
        extra: 0,
        payoffMonth: null,
        interestAcc: 0,
        borrowedAcc: 0,
      };
      payoffCards[i] = d;
      debts.push(d);
    }
    d.balance += amount;
    d.borrowedAcc += amount;
  };

  // Monthly growth rates; with yearly arrays they are reset at the start of each plan year.
  const inflationOf = (y: number): Rate => yearly?.inflation?.[y] ?? rates.inflationAnnual;
  const annualGrowth = (g: AssetGroup, y: number): Rate => {
    const arr = yearly?.growth?.[g];
    if (arr) return arr[y]!;
    const fixed = opts.growth?.[g];
    if (fixed !== undefined) return fixed;
    switch (g) {
      case 'cash': return rates.cashYieldAnnual;
      case 'investments':
      case 'retirement': return rates.returnAnnualNominal;
      case 'vehicle': return vehicleDepreciationAnnual.value;
      case 'realEstate':
      case 'otherAsset': return inflationOf(y);
    }
  };
  let rCash = monthlyRate(annualGrowth('cash', 0));
  let rRetirement = monthlyRate(annualGrowth('retirement', 0));
  const rGroup = new Float64Array(ASSET_GROUPS.length); // monthly rates of the extra groups, by index
  let rInflation = 0;
  let ratesYear = 0;
  const setGroupRates = (y: number) => {
    for (const g of EXTRA_ASSET_GROUPS) rGroup[GROUP_INDEX[g]] = monthlyRate(annualGrowth(g, y));
    rInflation = monthlyRate(inflationOf(y));
  };
  setGroupRates(0);

  // Plan-mode state: the shortfall balance and this month's flows per asset group (by group index).
  let shortfall = 0;
  const balanceOf = (gi: number): Money => (gi === CASH ? cash : gi === RETIREMENT ? retirement : bal[gi]!);
  const addTo = (gi: number, amount: Money) => {
    if (gi === CASH) cash += amount;
    else if (gi === RETIREMENT) retirement += amount;
    else bal[gi] += amount;
  };
  type PlanFlows = { growth: Float64Array; deposits: Float64Array; withdrawals: Float64Array;
    shortfallAdded: Money; oneOffIncome: Money };

  const snapshot = (
    month: number,
    flows: Omit<SimulationMonth, 'month' | 'cash' | 'retirement' | 'debtBalance' | 'cardBalance' | 'debts' | 'netWorth'>,
    plan?: PlanFlows,
  ): SimulationMonth => {
    let debtBalance = 0;
    let cardBalance = 0;
    const byId: Record<string, Money> = {};
    for (const d of debts) {
      byId[d.id] = d.balance;
      debtBalance += d.balance;
      if (d.kind === 'card') cardBalance += d.balance;
    }
    if (!plan) {
      return {
        month, ...flows, cash, retirement, debtBalance, cardBalance, debts: byId,
        netWorth: cash + retirement - debtBalance,
      };
    }
    const groups = {} as Record<AssetGroup, GroupMonth>;
    for (let i = 0; i < N_GROUPS; i++) {
      groups[GROUPS[i]!] = { balance: balanceOf(i), growth: plan.growth[i]!, deposits: plan.deposits[i]!, withdrawals: plan.withdrawals[i]! };
    }
    const debtFlows: Record<string, DebtFlow> = {};
    for (const d of debts) {
      debtFlows[d.id] = { interest: d.interestAcc, borrowed: d.borrowedAcc };
      d.interestAcc = 0;
      d.borrowedAcc = 0;
    }
    return {
      month, ...flows, cash, retirement, debtBalance, cardBalance, debts: byId,
      // investments + realEstate + vehicle + otherAsset, in that order
      netWorth: cash + retirement + bal[1]! + bal[3]! + bal[4]! + bal[5]! - debtBalance - shortfall,
      groups, shortfall, shortfallAdded: plan.shortfallAdded, oneOffIncome: plan.oneOffIncome, debtFlows,
    };
  };

  // Scratch records, reused (no allocation per month): this month's plan flows, and the sums since
  // the last path entry for granularity 'year'.
  const newPlanFlows = (): PlanFlows => ({
    growth: new Float64Array(N_GROUPS), deposits: new Float64Array(N_GROUPS),
    withdrawals: new Float64Array(N_GROUPS), shortfallAdded: 0, oneOffIncome: 0,
  });
  const resetPlanFlows = (f: PlanFlows) => {
    for (let i = 0; i < N_GROUPS; i++) {
      f.growth[i] = 0;
      f.deposits[i] = 0;
      f.withdrawals[i] = 0;
    }
    f.shortfallAdded = 0;
    f.oneOffIncome = 0;
  };
  const flow = newPlanFlows();
  const yearFlow = newPlanFlows();
  type Flows = Omit<SimulationMonth, 'month' | 'cash' | 'retirement' | 'debtBalance' | 'cardBalance' | 'debts' | 'netWorth'>;
  const zeroFlows = (): Flows => ({
    income: 0, spending: 0, debtPayments: 0, requiredDebtPayments: 0, purchasesCash: 0,
    cardCharges: 0, surplus: 0, shortfallToCard: 0, payoffCardCharges: 0, surplusToPayoffCards: 0,
    debtLoad: 0,
  });
  const yearSum = zeroFlows();

  const path: SimulationMonth[] = [snapshot(0, zeroFlows(), planMode ? flow : undefined)];

  for (let t = 0; t < months; t++) {
    const month = t + 1;
    if (planMode) resetPlanFlows(flow);
    if (yearly && yearOf(t) !== ratesYear) {
      ratesYear = yearOf(t);
      rCash = monthlyRate(annualGrowth('cash', ratesYear));
      rRetirement = monthlyRate(annualGrowth('retirement', ratesYear));
      setGroupRates(ratesYear);
    }

    // 0. Life events starting this month (earliest first, so the latest start wins).
    let oneOffCost = 0;
    let oneOffIncome = 0;
    let spendingChanged = false;
    for (; nextEvent < events.length && events[nextEvent]!.start <= t; nextEvent++) {
      const e = events[nextEvent]!.event;
      if (e.kind === 'pay') {
        takeHome = shift(e.takeHomePay.value, e.takeHomePay.isEstimate, scenario, true);
      } else if (e.kind === 'spending') {
        categorySpending.set(e.category, shift(e.monthly.value, e.monthly.isEstimate, scenario, false));
        spendingChanged = true;
      } else if (e.direction === 'cost') {
        oneOffCost += e.amount;
      } else {
        oneOffIncome += e.amount;
      }
    }
    if (spendingChanged) {
      monthlySpending = 0;
      for (const value of categorySpending.values()) monthlySpending += value;
    }

    const priceFactor = priceAt ? priceAt[t]! : (1 + rates.inflationAnnual) ** (t / 12);
    const income = takeHome * (incomeFollowsPrices ? priceFactor : (1 + rates.incomeGrowthAnnual) ** (t / 12));
    const spending = monthlySpending * priceFactor;

    // 1. Growth on the opening balances (and, in plan mode, the other groups and the shortfall).
    const cash0 = cash;
    const retirement0 = retirement;
    if (cash > 0) cash *= 1 + rCash;
    retirement *= 1 + rRetirement;
    if (planMode) {
      flow.growth[CASH] = cash - cash0;
      flow.growth[RETIREMENT] = retirement - retirement0;
      for (const i of EXTRA_INDICES) {
        const before = bal[i]!;
        bal[i] = before * (1 + rGroup[i]!);
        flow.growth[i] = bal[i]! - before;
      }
      shortfall *= 1 + rInflation;
      for (const x of newAssets) {
        if (x.month !== t) continue;
        addTo(x.gi, x.value);
        flow.deposits[x.gi] += x.value;
      }
    }

    // 2. Debts: interest, then the payment (never more than what is owed).
    let debtPayments = 0;
    let requiredDebtPayments = 0;
    for (const d of debts) {
      if (d.balance <= EPS) continue;
      const interest = d.balance * (d.apr / 12);
      d.interestAcc += interest;
      const required = (d.fixedPayment ?? cardMinPaymentFor(d.balance, d.apr)) * d.paymentFactor;
      const owed = d.balance + interest;
      const payment = Math.min(required + d.extra, owed);
      debtPayments += payment;
      requiredDebtPayments += Math.min(required, owed);
      d.balance = owed - payment;
      if (d.balance <= EPS) {
        d.balance = 0;
        d.payoffMonth ??= month;
      }
    }

    // 3. Purchases due this month. Recurring prices rise with inflation from their first occurrence;
    //    a one-off cost event is paid from cash like one, at today's price inflated from month 0.
    let purchasesCash = oneOffCost * priceFactor;
    let cardCharges = 0;
    let toCard = 0;                                // card charges without payOffFromSurplus
    let payoffCardCharges = 0;
    const payoffCash: [index: number, amount: Money][] = []; // cash paid by payOffFromSurplus purchases
    const newLoans: DebtState[] = [];
    for (let i = 0; i < extra.length; i++) {
      const x = extra[i]!;
      if (!occursAt(x, t)) continue;
      const scale = priceAt
        ? priceAt[t]! / priceAt[x.startMonth ?? 0]!
        : (1 + rates.inflationAnnual) ** ((t - (x.startMonth ?? 0)) / 12);
      const payOff = x.payOffFromSurplus === true;
      if (x.payWith === 'cash') {
        const amount = x.amount * scale;
        purchasesCash += amount;
        if (payOff) payoffCash.push([i, amount]);
      } else if (x.payWith === 'card') {
        const amount = x.amount * scale;
        cardCharges += amount;
        if (payOff) {
          chargePayoffCard(i, amount);
          payoffCardCharges += amount;
        } else {
          toCard += amount;
        }
      } else {
        const f = financePurchase(x.amount, x.payWith.loan, scale);
        purchasesCash += f.cashOut;
        if (payOff && f.cashOut > 0) payoffCash.push([i, f.cashOut]);
        if (f.principal > PAID_OFF_EPSILON) {
          newLoans.push({
            id: uniqueId(`purchase-m${month}`),
            kind: 'personal',
            apr: x.payWith.loan.apr,
            balance: f.principal,
            fixedPayment: f.payment,
            paymentFactor: 1,
            extra: x.payWith.loan.extraPayment ?? 0,
            payoffMonth: null,
            interestAcc: 0,
            borrowedAcc: f.principal,
          });
        }
      }
    }
    debts.push(...newLoans);
    for (const { month: at, debt: d } of newDebts) {
      if (at !== t) continue;
      debts.push({
        id: uniqueId(d.id),
        kind: d.kind,
        apr: d.apr,
        balance: d.balance,
        fixedPayment: usesCardFormula(d) ? null : d.minPayment.value,
        paymentFactor: shift(1, d.minPayment.isEstimate, scenario, d.apr > cashYield0),
        extra: d.extraPayment ?? 0,
        payoffMonth: d.balance <= PAID_OFF_EPSILON ? month : null,
        interestAcc: 0,
        borrowedAcc: d.balance,
      });
    }
    chargeCard(toCard);

    // 4. Surplus: pays off payOffFromSurplus cards, then is split between retirement and cash (or by
    //    savingsSplit); or drawn from cash, then the withdrawalOrder groups, then a card (or shortfall).
    const surplus = income - spending - debtPayments - purchasesCash + extraMonthly * priceFactor;
    let surplusToPayoffCards = 0;
    if (surplus > 0) {
      let left = surplus;
      for (const d of payoffCards) {
        if (!d || d.balance <= 0 || left <= 0) continue;
        const pay = Math.min(left, d.balance);
        d.balance -= pay;
        left -= pay;
        surplusToPayoffCards += pay;
        if (d.balance <= PAID_OFF_EPSILON) {
          d.balance = 0;
          d.payoffMonth ??= month;
        }
      }
      if (split) {
        for (const s of split) {
          const amount = left * s.share;
          addTo(s.gi, amount);
          flow.deposits[s.gi] += amount;
        }
      } else {
        const toRetirement = left * retirementShare;
        retirement += toRetirement;
        cash += left - toRetirement;
        if (planMode) {
          flow.deposits[RETIREMENT] += toRetirement;
          flow.deposits[CASH] += left - toRetirement;
        }
      }
    } else {
      cash += surplus;
    }
    cash += oneOffIncome * priceFactor;
    if (planMode) {
      flow.deposits[CASH] += oneOffIncome * priceFactor;
      flow.oneOffIncome = oneOffIncome * priceFactor;
    }
    let shortfallToCard = 0;
    if (cash < 0) {
      let need = -cash;
      cash = 0;
      // Cash covered the part of the drawn surplus it could: max(0, −surplus) − what is still needed.
      if (planMode) flow.withdrawals[CASH] = Math.max(0, Math.max(0, -surplus) - need);
      for (const gi of drawOrder) {
        if (need <= 0) break;
        const have = balanceOf(gi);
        if (have <= 0) continue;
        const take = Math.min(need, have);
        addTo(gi, -take);
        flow.withdrawals[gi] += take;
        need -= take;
      }
      if (separate) {
        shortfall += need;
        flow.shortfallAdded = need;
      } else {
        shortfallToCard = need;
        // The purchase caused min(shortfall, its cash payment) of it: without the purchase the
        // shortfall would be max(0, shortfall − payment).
        let rest = shortfallToCard;
        for (const [i, amount] of payoffCash) {
          const part = Math.min(rest, amount);
          if (part <= 0) break;
          chargePayoffCard(i, part);
          payoffCardCharges += part;
          rest -= part;
        }
        chargeCard(rest);
      }
    } else if (planMode && surplus < 0) {
      flow.withdrawals[CASH] = -surplus;
    }

    if (!byYear) {
      const debtLoad = income > 0 ? requiredDebtPayments / income : requiredDebtPayments > 0 ? Infinity : 0;
      path.push(snapshot(month, {
        income, spending, debtPayments, requiredDebtPayments, purchasesCash, cardCharges, surplus,
        shortfallToCard, payoffCardCharges, surplusToPayoffCards, debtLoad,
      }, planMode ? flow : undefined));
      continue;
    }
    // granularity 'year': add the month to the year's sums; an entry at the year's last month.
    yearSum.income += income;
    yearSum.spending += spending;
    yearSum.debtPayments += debtPayments;
    yearSum.requiredDebtPayments += requiredDebtPayments;
    yearSum.purchasesCash += purchasesCash;
    yearSum.cardCharges += cardCharges;
    yearSum.surplus += surplus;
    yearSum.shortfallToCard += shortfallToCard;
    yearSum.payoffCardCharges += payoffCardCharges;
    yearSum.surplusToPayoffCards += surplusToPayoffCards;
    if (planMode) {
      for (let i = 0; i < N_GROUPS; i++) {
        yearFlow.growth[i] += flow.growth[i]!;
        yearFlow.deposits[i] += flow.deposits[i]!;
        yearFlow.withdrawals[i] += flow.withdrawals[i]!;
      }
      yearFlow.shortfallAdded += flow.shortfallAdded;
      yearFlow.oneOffIncome += flow.oneOffIncome;
    }
    if (t === months - 1 || yearOf(t + 1) !== yearOf(t)) {
      const inc = yearSum.income;
      const req = yearSum.requiredDebtPayments;
      yearSum.debtLoad = inc > 0 ? req / inc : req > 0 ? Infinity : 0;
      path.push(snapshot(month, { ...yearSum }, planMode ? yearFlow : undefined));
      Object.assign(yearSum, zeroFlows());
      resetPlanFlows(yearFlow);
    }
  }

  const payoffMonth: Record<string, number | null> = {};
  for (const d of debts) payoffMonth[d.id] = d.payoffMonth;
  const result: Simulation = { rates, path, payoffMonth, payoffCardIds: payoffCards.map((d) => d?.id ?? null) };
  if (planMode) result.debtApr = Object.fromEntries(debts.map((d) => [d.id, d.apr]));
  return result;
}
