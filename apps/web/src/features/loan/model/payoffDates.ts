// Calendar months for the payoff planner. The model never reads the clock: `today` is injected as a
// 'YYYY-MM' month (lib/dates → localMonthDay().month), and month 0 of a plan is that month.

/** A calendar month: `month` is 'YYYY-MM', `year` is its year (so the screen can print both). */
export type PayoffDate = { month: string; year: number };

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

function parse(month: string): number | null {
  const m = MONTH.exec(month);
  return m ? Number(m[1]) * 12 + Number(m[2]) - 1 : null;
}

/** `month` ('YYYY-MM') plus a whole number of months ≥ 0; null for anything else. */
export function addMonths(month: string, count: number): PayoffDate | null {
  const base = parse(month);
  if (base === null || !Number.isInteger(count) || count < 0) return null;
  const total = base + count;
  const year = Math.floor(total / 12);
  return { month: `${String(year).padStart(4, '0')}-${String((total % 12) + 1).padStart(2, '0')}`, year };
}

/** Calendar months from `from` to `to` (negative when `to` is earlier); null unless both are 'YYYY-MM'. */
export function monthsBetween(from: string, to: string): number | null {
  const a = parse(from);
  const b = parse(to);
  return a === null || b === null ? null : b - a;
}
