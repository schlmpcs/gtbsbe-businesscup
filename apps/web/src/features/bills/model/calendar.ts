// Bills calendar: the pure date math. Which bill falls on which day of a month, what is due in the
// next 7 days and what is due before the next payday. No clock, no locale, no time zone: `today` is a
// parameter and dates are plain { year, month, day } (month 1-12), compared through UTC day numbers.
//
// A due day the month does not have (31 in February, 31 in April) moves to the month's last day,
// the way banks and billers do it. A bill billed every 3 or 12 months falls only in the months that
// are a whole number of periods from a month it is known to fall in (its `anchorMonth`).
import type { Money } from '@lifeguessr/types';

export type CalDate = { year: number; month: number; day: number };
export type BillCadence = 'monthly' | 'quarterly' | 'yearly';
export type BillKind = 'rent' | 'debt' | 'subscription';

/** One bill as the calendar sees it. Amounts are dollars per charge (per `cadence`). */
export type BillDef = {
  /** Stable: 'rent', 'debt:<debt id>', 'sub:<finding id>'. Keys the user's due day in the store. */
  id: string;
  kind: BillKind;
  label: string;
  amount: Money;
  /** The amount is a value we defaulted (the profile's estimate), not one the user gave or a statement showed. */
  amountIsEstimate: boolean;
  cadence: BillCadence;
  /** 'YYYY-MM' of a month the bill is known to fall in. Needed for quarterly and yearly bills; ignored for monthly. */
  anchorMonth?: string;
  /** Day of the month, 1-31, as set (may be past the end of a short month). */
  dueDay: number;
  /** We assumed the day (nobody told us): shown with an estimate tag. */
  dueDayIsEstimate: boolean;
};

export type BillOccurrence = { bill: BillDef; date: CalDate };

export const MIN_DUE_DAY = 1;
export const MAX_DUE_DAY = 31;

const isLeapYear = (y: number): boolean => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

/** A due day as a whole day from 1 to 31, or null when it is not one. */
export function validDueDay(day: unknown): number | null {
  return typeof day === 'number' && Number.isInteger(day) && day >= MIN_DUE_DAY && day <= MAX_DUE_DAY ? day : null;
}

/** The day a due day falls on in a month: the day itself, or the month's last day when the month is shorter. */
export function dueDateIn(dueDay: number, year: number, month: number): CalDate {
  return { year, month, day: Math.min(Math.max(1, Math.trunc(dueDay)), daysInMonth(year, month)) };
}

/** Whole days since 1970-01-01 (for comparing and adding days). */
export function dayIndex(d: CalDate): number {
  return Math.floor(Date.UTC(d.year, d.month - 1, d.day) / 86_400_000);
}

export function fromDayIndex(n: number): CalDate {
  const t = new Date(n * 86_400_000);
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() };
}

export const addDays = (d: CalDate, n: number): CalDate => fromDayIndex(dayIndex(d) + n);
export const daysBetween = (from: CalDate, to: CalDate): number => dayIndex(to) - dayIndex(from);

/** 0 = Sunday … 6 = Saturday. */
export const weekday = (d: CalDate): number => new Date(dayIndex(d) * 86_400_000).getUTCDay();

/** The month `offset` months after (or before) year/month. */
export function shiftMonth(year: number, month: number, offset: number): { year: number; month: number } {
  const i = year * 12 + (month - 1) + offset;
  return { year: Math.floor(i / 12), month: (((i % 12) + 12) % 12) + 1 };
}

export const monthKey = (year: number, month: number): string => `${year}-${String(month).padStart(2, '0')}`;

function parseMonthKey(key: string | undefined): { year: number; month: number } | null {
  const m = key ? /^(\d{4})-(0[1-9]|1[0-2])$/.exec(key) : null;
  return m ? { year: Number(m[1]), month: Number(m[2]) } : null;
}

const STEP: Record<BillCadence, number> = { monthly: 1, quarterly: 3, yearly: 12 };

/** Whether the bill is charged in this month. A quarterly or yearly bill with no usable anchor is never placed. */
export function occursInMonth(bill: BillDef, year: number, month: number): boolean {
  const step = STEP[bill.cadence];
  if (step === undefined) return false;
  if (step === 1) return true;
  const anchor = parseMonthKey(bill.anchorMonth);
  if (!anchor) return false;
  const diff = year * 12 + month - (anchor.year * 12 + anchor.month);
  return ((diff % step) + step) % step === 0;
}

const byDateThenLabel = (a: BillOccurrence, b: BillOccurrence): number =>
  dayIndex(a.date) - dayIndex(b.date) || a.bill.label.localeCompare(b.bill.label) || a.bill.id.localeCompare(b.bill.id);

/** The bills charged in a month, by date (then label). */
export function billsInMonth(bills: readonly BillDef[], year: number, month: number): BillOccurrence[] {
  return bills
    .filter((b) => occursInMonth(b, year, month))
    .map((bill) => ({ bill, date: dueDateIn(bill.dueDay, year, month) }))
    .sort(byDateThenLabel);
}

/** Every charge on a day from `from` (included) to `until` (excluded), by date. */
export function billsBetween(bills: readonly BillDef[], from: CalDate, until: CalDate): BillOccurrence[] {
  const start = dayIndex(from);
  const end = dayIndex(until);
  if (end <= start) return [];
  const out: BillOccurrence[] = [];
  let ym = { year: from.year, month: from.month };
  while (ym.year * 12 + ym.month <= until.year * 12 + until.month) {
    for (const o of billsInMonth(bills, ym.year, ym.month)) {
      const i = dayIndex(o.date);
      if (i >= start && i < end) out.push(o);
    }
    ym = shiftMonth(ym.year, ym.month, 1);
  }
  return out.sort(byDateThenLabel);
}

export const UPCOMING_DAYS = 7;

/** "Due in the next 7 days": today and the six days after it. */
export function dueSoon(bills: readonly BillDef[], today: CalDate, days = UPCOMING_DAYS): BillOccurrence[] {
  return billsBetween(bills, today, addDays(today, days));
}

/** The first bill due today or later (looks at most 13 months ahead), or null. */
export function nextBill(bills: readonly BillDef[], today: CalDate): BillOccurrence | null {
  const until = (() => {
    const m = shiftMonth(today.year, today.month, 13);
    return { year: m.year, month: m.month, day: 1 };
  })();
  return billsBetween(bills, today, until)[0] ?? null;
}

/** The first charge of a bill on `today` or later, or null when it never falls (no usable anchor). */
export function nextOccurrence(bill: BillDef, today: CalDate): CalDate | null {
  for (let i = 0; i <= 12; i++) {
    const ym = shiftMonth(today.year, today.month, i);
    if (!occursInMonth(bill, ym.year, ym.month)) continue;
    const date = dueDateIn(bill.dueDay, ym.year, ym.month);
    if (dayIndex(date) >= dayIndex(today)) return date;
  }
  return null;
}

/** The first payday after today (a payday on today does not count: that pay is already in). Null with no paydays. */
export function nextPayday(today: CalDate, paydays: readonly number[]): CalDate | null {
  const days = paydays.filter((d) => validDueDay(d) !== null);
  if (days.length === 0) return null;
  const candidates = [0, 1, 2].flatMap((offset) => {
    const ym = shiftMonth(today.year, today.month, offset);
    return days.map((d) => dueDateIn(d, ym.year, ym.month));
  });
  const after = candidates.filter((d) => dayIndex(d) > dayIndex(today)).sort((a, b) => dayIndex(a) - dayIndex(b));
  return after[0] ?? null;
}

export type BeforePayday = {
  payday: CalDate;
  /** Bills due from today up to the day before payday (a bill due on payday is paid from that pay). */
  bills: BillOccurrence[];
  total: Money;
  totalIsEstimate: boolean;
};

export function dueBeforePayday(bills: readonly BillDef[], today: CalDate, paydays: readonly number[]): BeforePayday | null {
  const payday = nextPayday(today, paydays);
  if (!payday) return null;
  const due = billsBetween(bills, today, payday);
  return { payday, bills: due, total: sumOf(due), totalIsEstimate: due.some((o) => o.bill.amountIsEstimate) };
}

export const sumOf = (occurrences: readonly BillOccurrence[]): Money =>
  occurrences.reduce((s, o) => s + o.bill.amount, 0);

/**
 * The month as calendar weeks, Sunday first (US): each week is 7 cells, a day of the month or null
 * for the padding before the 1st and after the last day.
 */
export function monthWeeks(year: number, month: number): (number | null)[][] {
  const lead = weekday({ year, month, day: 1 });
  const total = daysInMonth(year, month);
  const cells: (number | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export type PaidSplit = { paid: BillOccurrence[]; toPay: BillOccurrence[] };

/**
 * A month's charges split by their due date against today: due before today = gone out ("paid", by due
 * date: we do not see the payment itself), today or later = still to pay. A past month is all paid, a
 * future one all to pay.
 */
export function splitByToday(occurrences: readonly BillOccurrence[], today: CalDate): PaidSplit {
  const t = dayIndex(today);
  return {
    paid: occurrences.filter((o) => dayIndex(o.date) < t),
    toPay: occurrences.filter((o) => dayIndex(o.date) >= t),
  };
}
