// Daily spending log → the month so far, and "safe to spend today". Spec: docs/ENGINEERING.md →
// Daily log.
//
//   monthToDate (per category) = Σ entries dated in `month`, on day 1..`day` (later days ignored)
//   → the `current` argument of monthEnd (day = today: the log is complete up to today)
//
//   planned   = usual month (usualMonthSpend: mean of the last 3 full months, else the profile)
//   spent     = Σ month-to-date over every category but debtPayments (as monthEnd)
//   billsDue  = Σ over bill categories (monthEndBillCategories) of max(0, usual − spent so far):
//               rent, childcare, subscriptions and car are paid in a lump, so what has not been
//               paid yet this month is still owed and is not spendable
//   remaining = planned − spent − billsDue   (negative = over the usual month)
//   daysLeft  = days in month − day + 1      (today counts)
//   perDay    = max(0, remaining) / daysLeft
//
// Invalid input (bad month, a day outside the month, an entry with a bad date or a non-positive
// or non-finite amount) throws a RangeError.
import { COST_CATEGORIES, type CategoryTotals, type CostCategory, type DailyEntry, type Money, type Profile } from '@lifeguessr/types';
import { monthEndBillCategories } from './assumptions';
import { daysInMonth, usualMonthSpend, type CurrentMonth } from './month';

function checkDay(month: string, day: number): number {
  const days = daysInMonth(month);
  if (!Number.isInteger(day) || day < 1 || day > days) throw new RangeError(`Invalid day ${day} for ${month} (1..${days})`);
  return days;
}

/** The month so far from the daily log: spent per category on days 1..`day` of `month`. */
export function dailyMonthToDate(entries: readonly DailyEntry[], month: string, day: number): CurrentMonth {
  checkDay(month, day);
  const totals = Object.fromEntries(COST_CATEGORIES.map((c) => [c, 0])) as Record<CostCategory, Money>;
  for (const e of entries) {
    const m = /^(\d{4}-\d{2})-(\d{2})$/.exec(e.date);
    if (!m) throw new RangeError(`Invalid entry date: ${e.date} (expected YYYY-MM-DD)`);
    if (!Number.isFinite(e.amount) || e.amount <= 0) throw new RangeError(`Invalid entry amount: ${e.amount}`);
    if (m[1] !== month) continue;
    const d = Number(m[2]);
    checkDay(month, d);
    if (d > day) continue;
    totals[e.category] += e.amount;
  }
  return { month, day, totals };
}

/** Spent per day of `month` ('YYYY-MM-DD' → Σ amounts), days with entries only, newest first. */
export function dailyTotalsByDay(entries: readonly DailyEntry[], month: string): { date: string; total: Money }[] {
  daysInMonth(month);
  const byDay = new Map<string, Money>();
  for (const e of entries) {
    if (!e.date.startsWith(`${month}-`)) continue;
    if (!Number.isFinite(e.amount) || e.amount <= 0) throw new RangeError(`Invalid entry amount: ${e.amount}`);
    byDay.set(e.date, (byDay.get(e.date) ?? 0) + e.amount);
  }
  return [...byDay.entries()].sort(([a], [b]) => (a < b ? 1 : -1)).map(([date, total]) => ({ date, total }));
}

export type SafeToSpend = {
  /** The usual month's spend (planned). */
  planned: Money;
  /** Spent so far this month (debtPayments excluded). */
  spent: Money;
  /** Usual bills not paid yet this month (still owed, so not spendable). */
  billsDue: Money;
  /** planned − spent − billsDue; negative when the month is already over the usual. */
  remaining: Money;
  /** Days left in the month, today included. */
  daysLeft: number;
  /** max(0, remaining) / daysLeft. */
  perDay: Money;
  /** The usual month comes from 3 full months of statements (else from the profile). */
  usualFromHistory: boolean;
};

/** How much can go out per day for the rest of the month and still end at the usual month. */
export function safeToSpendToday(p: Profile, history: CategoryTotals[], current: CurrentMonth): SafeToSpend {
  const days = checkDay(current.month, current.day);
  const usual = usualMonthSpend(p, history, current.month);
  const soFar = (c: CostCategory) => {
    const v = current.totals[c] ?? 0;
    if (!Number.isFinite(v)) throw new RangeError(`Invalid ${c} total for ${current.month}: ${v}`);
    return Math.max(0, v);
  };
  let spent = 0;
  for (const c of COST_CATEGORIES) if (c !== 'debtPayments') spent += soFar(c);
  let billsDue = 0;
  for (const c of monthEndBillCategories.value) billsDue += Math.max(0, usual.byCategory[c] - soFar(c));
  const remaining = usual.total - spent - billsDue;
  const daysLeft = days - current.day + 1;
  return {
    planned: usual.total,
    spent,
    billsDue,
    remaining,
    daysLeft,
    perDay: Math.max(0, remaining) / daysLeft,
    usualFromHistory: usual.fromHistory,
  };
}
