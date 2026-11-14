// Display formatting. The engine never rounds; rounding happens here, at display time only.
import type { Money, Rate } from '@lifeguessr/types';

export type FormatMoneyOptions = {
  /** Show cents (default: whole dollars). */
  cents?: boolean;
  /** Compact notation for big numbers: $1.2M, $48K. */
  compact?: boolean;
  /** Always show a sign: +$120 / −$120 (for deltas such as effect10y). */
  signed?: boolean;
};

const MINUS = '−'; // typographic minus
const NOT_A_NUMBER = '—'; // em dash for NaN / ±Infinity

const moneyFormatters = new Map<string, Intl.NumberFormat>();
function moneyFormatter(cents: boolean, compact: boolean): Intl.NumberFormat {
  const key = `${cents}-${compact}`;
  let f = moneyFormatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: compact ? 'compact' : 'standard',
      minimumFractionDigits: cents ? 2 : 0,
      maximumFractionDigits: compact ? 1 : cents ? 2 : 0,
    });
    moneyFormatters.set(key, f);
  }
  return f;
}

/** US dollars for display: formatMoney(1234.5) → "$1,235"; { cents: true } → "$1,234.50". */
export function formatMoney(value: Money, opts: FormatMoneyOptions = {}): string {
  if (!Number.isFinite(value)) return NOT_A_NUMBER;
  const f = moneyFormatter(opts.cents ?? false, opts.compact ?? false);
  const abs = f.format(Math.abs(value));
  const roundsToZero = abs === f.format(0);
  if (roundsToZero) return abs; // never "-$0"
  if (value < 0) return `${MINUS}${abs}`;
  return opts.signed ? `+${abs}` : abs;
}

const rateFormatters = new Map<number, Intl.NumberFormat>();

/** A decimal rate as a percent: formatRate(0.228) → "22.8%"; formatRate(0.069) → "6.9%". */
export function formatRate(rate: Rate, digits = 1): string {
  if (!Number.isFinite(rate)) return NOT_A_NUMBER;
  let f = rateFormatters.get(digits);
  if (!f) {
    f = new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 0, maximumFractionDigits: digits });
    rateFormatters.set(digits, f);
  }
  const abs = f.format(Math.abs(rate));
  return rate < 0 && abs !== f.format(0) ? `${MINUS}${abs}` : abs;
}

const monthFormat = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' });
const monthDayFormat = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });

/**
 * A 'YYYY-MM' month by name: formatMonth('2026-11') → "November"; with a day of that month,
 * formatMonth('2026-11', 9) → "November 9". Anything else → "—".
 */
export function formatMonth(month: string, day?: number): string {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!m) return NOT_A_NUMBER;
  const year = Number(m[1]);
  const mon = Number(m[2]) - 1;
  if (day === undefined) return monthFormat.format(new Date(Date.UTC(year, mon, 1)));
  const last = new Date(Date.UTC(year, mon + 1, 0)).getUTCDate();
  if (!Number.isInteger(day) || day < 1 || day > last) return NOT_A_NUMBER;
  return monthDayFormat.format(new Date(Date.UTC(year, mon, day)));
}
