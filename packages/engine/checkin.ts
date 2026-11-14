// S14 Monthly check-in. Spec: docs/ENGINEERING.md → Monthly check-in.
//
// The check-in shows one month against the plan and where it leaves the user's number. Until a bank
// connection exists the month is simulated ("Fast-forward 1 month (simulated)"):
//
//   simulateMonth(p, i, seed)   per category: planned × (1 + u × noise[category]), u ∈ [−1, 1] drawn
//                               from a seeded PRNG (mulberry32 over seed and i, categories in
//                               COST_CATEGORIES order), so the same inputs always give the same month.
//                               noise = checkinMonthNoise (assumptions.ts). Typed `simulated: true`.
//   checkinRecord(start, m)     runs that month through simulate() twice, with the simulated spending
//                               and with the plan: the end balances, net worth, debt paid down and
//                               vsForecast (actual − planned end-of-month net worth) come from there;
//                               number10y = forecast(profile at the end of the month, 10 years,
//                               today's dollars).in10y.mid (the rules forecast, never the AI one).
//   checkinStart(p, history)    the profile at the start of the next check-in: today's profile with the
//                               last saved month's end balances (the plan's spending is kept).
//   checkinSummary(...)         forecast vs actual rows, the number now and 10 years on with the change
//                               since the last saved check-in, goal status (goalStatus), progress of the
//                               committed move and the value check summed over the saved check-ins.
//
// Each check-in starts at month 0 of the simulation, so spending is not inflated from one check-in to
// the next (a few months of inflation is well inside the noise). No model call, no clock: the caller
// passes the calendar month.
import {
  COST_CATEGORIES,
  type CheckinBalances,
  type CheckinMoveProgress,
  type CheckinRecord,
  type CheckinRow,
  type CheckinSummary,
  type CostCategory,
  type Goal,
  type Money,
  type Move,
  type Profile,
  type SimulatedMonth,
} from '@lifeguessr/types';
import { checkinMonthNoise } from './assumptions';
import { forecast } from './forecast';
import { goalStatus } from './goal';
import {
  SYNTHETIC_CARD_ID, cardMinPaymentFor, forecastMonths, resolveRates, simulate, type ForecastRates, type SimulationMonth,
} from './simulate';

/** Categories a check-in compares (debtPayments is informational: payments come from the debts). */
export const CHECKIN_CATEGORIES: readonly CostCategory[] = COST_CATEGORIES.filter((c) => c !== 'debtPayments');

export type CheckinOptions = { rates?: Partial<ForecastRates> };

/** FNV-1a: a stable 32-bit seed from a string (e.g. the 'YYYY-MM' month being simulated). */
export function seedOf(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: a small, fast, seeded PRNG returning [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cents = (x: Money): Money => Math.round(x * 100) / 100;

/** One simulated month of spending around the profile's monthly values (seeded, bounded noise). */
export function simulateMonth(p: Profile, monthIndex: number, seed: number): SimulatedMonth {
  if (!Number.isInteger(monthIndex) || monthIndex < 1) throw new RangeError(`Invalid month index: ${monthIndex}`);
  if (!Number.isInteger(seed)) throw new RangeError(`Invalid seed: ${seed}`);
  const rng = mulberry32(seedOf(`${seed >>> 0}:${monthIndex}`));
  const planned = {} as Record<CostCategory, Money>;
  const totals = {} as Record<CostCategory, Money>;
  for (const c of COST_CATEGORIES) {
    const value = p.spending[c].value;
    if (!Number.isFinite(value)) throw new RangeError(`Invalid ${c} spending: ${value}`);
    const plan = Math.max(0, value);
    const u = rng() * 2 - 1; // drawn for every category, so one category's plan never shifts another's draw
    planned[c] = plan;
    totals[c] = cents(plan * (1 + u * checkinMonthNoise.value[c]));
  }
  return { monthIndex, simulated: true, planned, totals };
}

function withSpending(p: Profile, spending: Record<CostCategory, Money>): Profile {
  const next = {} as Profile['spending'];
  for (const c of COST_CATEGORIES) next[c] = { ...p.spending[c], value: spending[c] };
  return { ...p, spending: next };
}

function balancesOf(m: SimulationMonth): CheckinBalances {
  return { cash: m.cash, retirement: m.retirement, debts: { ...m.debts } };
}

/**
 * The profile with balances from a check-in. Debts are matched by id (one the profile no longer has
 * is dropped); the card the simulation opens for a shortfall is added as an estimated card.
 */
export function profileWithBalances(p: Profile, b: CheckinBalances, opts: CheckinOptions = {}): Profile {
  const debts = p.debts.map((d) => (d.id in b.debts ? { ...d, balance: b.debts[d.id]! } : d));
  const synthetic = b.debts[SYNTHETIC_CARD_ID];
  if (synthetic !== undefined && synthetic > 0 && !p.debts.some((d) => d.id === SYNTHETIC_CARD_ID)) {
    const apr = resolveRates(opts.rates).cardApr;
    debts.push({ id: SYNTHETIC_CARD_ID, kind: 'card', balance: synthetic, apr, minPayment: { value: cardMinPaymentFor(synthetic, apr), isEstimate: true } });
  }
  return { ...p, cash: { ...p.cash, value: b.cash }, retirement: { ...p.retirement, value: b.retirement }, debts };
}

/** Where the next check-in starts: the profile with the last saved month's end balances. */
export function checkinStart(p: Profile, history: readonly CheckinRecord[], opts: CheckinOptions = {}): Profile {
  const last = history[history.length - 1];
  return last ? profileWithBalances(p, last.balances, opts) : p;
}

function number10yOf(p: Profile, opts: CheckinOptions) {
  return forecast(p, 10, { todaysDollars: true, rates: opts.rates }).in10y;
}

/** Run a simulated month from `start`: end balances, net worth, the number and how it compares to the plan. */
export function checkinRecord(start: Profile, month: string, sim: SimulatedMonth, opts: CheckinOptions = {}): CheckinRecord {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new RangeError(`Invalid month: ${month} (expected YYYY-MM)`);
  const actual = simulate(withSpending(start, sim.totals), 1, { rates: opts.rates }).path;
  const planned = simulate(withSpending(start, sim.planned), 1, { rates: opts.rates }).path;
  const end = actual[1]!;
  const balances = balancesOf(end);
  return {
    month,
    monthIndex: sim.monthIndex,
    simulated: true,
    planned: { ...sim.planned },
    totals: { ...sim.totals },
    balances,
    netWorth: end.netWorth,
    number10y: number10yOf(profileWithBalances(start, balances, opts), opts).mid,
    vsForecast: end.netWorth - planned[1]!.netWorth,
    debtPaidDown: actual[0]!.debtBalance - end.debtBalance,
  };
}

function rowsOf(r: CheckinRecord): CheckinRow[] {
  return CHECKIN_CATEGORIES.filter((c) => r.planned[c] > 0 || r.totals[c] > 0).map((c) => ({
    category: c,
    forecast: r.planned[c],
    actual: r.totals[c],
  }));
}

function moveProgress(
  plan: Profile,
  end: Profile,
  latest: CheckinRecord | null,
  move: Move,
  opts: CheckinOptions,
): CheckinMoveProgress | null {
  const debtPatch = move.patch.debts?.find((d) => d.extraPayment !== undefined);
  if (debtPatch) {
    const debt = plan.debts.find((d) => d.id === debtPatch.id);
    if (!debt) return null;
    const startBalance = debt.balance;
    const balance = latest ? (latest.balances.debts[debt.id] ?? 0) : startBalance;
    const paid = Math.max(0, startBalance - balance);
    const payoff = simulate(end, forecastMonths(10), { rates: opts.rates }).payoffMonth[debt.id];
    return {
      kind: 'debtPayoff',
      debtId: debt.id,
      startBalance,
      balance,
      paid,
      share: startBalance > 0 ? Math.min(1, paid / startBalance) : 1,
      payoffMonths: payoff ?? null,
    };
  }
  const spending = move.patch.spending ?? {};
  const category =
    move.category && spending[move.category] !== undefined ? move.category : (Object.keys(spending) as CostCategory[])[0];
  const target = category === undefined ? undefined : spending[category];
  if (category === undefined || target === undefined || !latest) return null;
  const actual = latest.totals[category];
  return { kind: 'spendingTarget', category, target, actual, onTrack: actual <= target };
}

/**
 * The check-in screen's numbers. `plan` = the profile the check-ins run on (today's balances, the
 * committed move's patch applied); `history` = saved check-ins, oldest first; `current` = the month
 * on screen when it is not saved yet.
 */
export function checkinSummary(
  plan: Profile,
  history: readonly CheckinRecord[],
  current: CheckinRecord | null,
  opts: CheckinOptions & { goal?: Goal | null; committedMove?: Move | null } = {},
): CheckinSummary {
  const latest = current ?? history[history.length - 1] ?? null;
  const before = current ? (history[history.length - 1] ?? null) : (history[history.length - 2] ?? null);
  const end = latest ? profileWithBalances(plan, latest.balances, opts) : plan;
  const base10y = number10yOf(plan, opts).mid;
  const in10y = number10yOf(end, opts);
  const previous10y = before?.number10y ?? base10y;
  const today = latest ? latest.netWorth : simulate(plan, 0, { rates: opts.rates }).path[0]!.netWorth;
  const rows = latest ? rowsOf(latest) : [];
  const last = history[history.length - 1];
  return {
    rows,
    forecastTotal: rows.reduce((s, r) => s + r.forecast, 0),
    actualTotal: rows.reduce((s, r) => s + r.actual, 0),
    number: { today, in10y, previous10y, change10y: in10y.mid - previous10y },
    goal: opts.goal ? goalStatus(end, opts.goal, { rates: opts.rates }) : null,
    move: opts.committedMove ? moveProgress(plan, end, latest, opts.committedMove, opts) : null,
    value: last
      ? {
          checkins: history.length,
          debtPaidDown: history.reduce((s, r) => s + r.debtPaidDown, 0),
          vsForecast: history.reduce((s, r) => s + r.vsForecast, 0),
          numberChange: last.number10y - base10y,
        }
      : null,
  };
}
