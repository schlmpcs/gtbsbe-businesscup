// Price in work hours: a dollar amount as the time it takes to earn it from take-home pay.
//
//   hours per month = hoursPerWeek × 52 / 12        (52/12 weeks per month, exact, not 4.33)
//   pay per hour    = takeHomePay / hours per month (monthly, after tax: what the user can spend)
//   hours           = amount / pay per hour
//   days            = hours / (hoursPerWeek / 5)    (an 8-hour day at the default 40 h week)
//   weeks           = hours / hoursPerWeek          (a 40-hour week at the default)
//
// `best` picks the unit a sentence should use ("14 min", "3 days", "2.5 weeks") and rounds it:
// whole minutes under an hour; then hours, days, weeks in steps of 0.5 below 10 and whole numbers
// from 10 up. Each unit is used while its rounded value is below one of the next unit (under 60
// min, under one day of hours, under 5 days), so rounding never prints "60 min" or "8 hours".
// The unrounded values are returned too. The result is an estimate when take-home pay is.
import type { Estimate, Money } from '@lifeguessr/types';
import { workHoursPerWeek } from './assumptions';

export type WorkTimeUnit = 'minutes' | 'hours' | 'days' | 'weeks';

export type WorkTime = {
  /** Unrounded time to earn the amount, in each unit. */
  minutes: number;
  hours: number;
  /** Work days of hoursPerWeek / 5 hours. */
  days: number;
  /** Work weeks of hoursPerWeek hours. */
  weeks: number;
  /** The unit to phrase it in and the rounded amount (minutes whole; others in 0.5 steps below 10). */
  best: { unit: WorkTimeUnit; amount: number };
  /** Take-home pay per hour worked (US dollars). */
  hourlyPay: Money;
  hoursPerWeek: number;
  /** True when take-home pay is an estimate. */
  isEstimate: boolean;
};

export type WorkTimeOptions = { hoursPerWeek?: number };

/** Rounds to 0.5 below 10 and to whole numbers from 10 up. */
export function roundWorkAmount(x: number): number {
  return x < 10 ? Math.round(x * 2) / 2 : Math.round(x);
}

/**
 * The time it takes to earn `amount` from monthly take-home pay. Null when there is no positive
 * pay or hours to measure against, or the amount is negative or not a finite number.
 */
export function workTime(
  amount: Money,
  takeHomePay: Estimate<Money>,
  opts: WorkTimeOptions = {},
): WorkTime | null {
  const hoursPerWeek = opts.hoursPerWeek ?? workHoursPerWeek.value;
  if (!Number.isFinite(amount) || amount < 0) return null;
  if (!Number.isFinite(takeHomePay.value) || takeHomePay.value <= 0) return null;
  if (!Number.isFinite(hoursPerWeek) || hoursPerWeek <= 0) return null;

  const hoursPerMonth = (hoursPerWeek * 52) / 12;
  const hourlyPay = takeHomePay.value / hoursPerMonth;
  const hours = amount / hourlyPay;
  const hoursPerDay = hoursPerWeek / 5;
  const minutes = hours * 60;
  const days = hours / hoursPerDay;
  const weeks = hours / hoursPerWeek;

  return {
    minutes,
    hours,
    days,
    weeks,
    best: bestUnit(minutes, hours, days, weeks, hoursPerDay),
    hourlyPay,
    hoursPerWeek,
    isEstimate: takeHomePay.isEstimate,
  };
}

function bestUnit(minutes: number, hours: number, days: number, weeks: number, hoursPerDay: number): WorkTime['best'] {
  const m = Math.round(minutes);
  if (m < 60) return { unit: 'minutes', amount: m };
  const h = roundWorkAmount(hours);
  if (h < hoursPerDay) return { unit: 'hours', amount: h };
  const d = roundWorkAmount(days);
  if (d < 5) return { unit: 'days', amount: d };
  return { unit: 'weeks', amount: roundWorkAmount(weeks) };
}
