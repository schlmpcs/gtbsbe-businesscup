// T3: the amortization math shared by the loan engine (./index.ts) and the forecast simulation
// (../simulate.ts). A leaf module (it imports nothing from the engine) so that the loan engine can
// run forecasts for `effect10y` without an import cycle. Spec: docs/ENGINEERING.md → Loan amortization.
import type { LoanResult, Money, Rate } from '@lifeguessr/types';

/** Balances below this many dollars count as paid off (absorbs floating-point dust). */
export const PAID_OFF_EPSILON: Money = 1e-6;
/** Safety cap for month-by-month simulations (100 years). */
export const MAX_SIMULATION_MONTHS = 1200;

/** Throws a RangeError unless `value` is a finite number ≥ 0. */
export function assertNonNegative(name: string, value: number): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new RangeError(`Invalid ${name}: ${value} (expected a finite number ≥ 0)`);
  }
}

/** Throws a RangeError unless `termMonths` is a whole number of months in 1..MAX_SIMULATION_MONTHS. */
export function assertTermMonths(termMonths: number): void {
  if (!Number.isInteger(termMonths) || termMonths < 1 || termMonths > MAX_SIMULATION_MONTHS) {
    throw new RangeError(`Invalid termMonths: ${termMonths} (expected a whole number in 1..${MAX_SIMULATION_MONTHS})`);
  }
}

/**
 * The part of the level payment above the first month's interest: P·r / ((1 + r)^n − 1), or P / n
 * at 0% APR. Computed with expm1/log1p so it stays accurate when it is tiny (high APR, long term),
 * where P·r/(1 − (1 + r)^−n) − P·r would cancel to 0.
 */
export function firstPrincipal(principal: Money, r: Rate, termMonths: number): Money {
  return r === 0 ? principal / termMonths : (principal * r) / Math.expm1(termMonths * Math.log1p(r));
}

/**
 * Monthly payment for a fully amortizing loan: P·r / (1 − (1 + r)^−n), or P / n at 0% APR
 * (r = apr / 12). 0 when there is nothing to finance. Throws a RangeError on invalid input.
 */
export function amortizedPayment(principal: Money, apr: Rate, termMonths: number): Money {
  assertNonNegative('principal', principal);
  assertNonNegative('apr', apr);
  assertTermMonths(termMonths);
  if (principal === 0) return 0;
  const r = apr / 12;
  return principal * r + firstPrincipal(principal, r, termMonths);
}

export type Amortization = {
  /** One row per month paid, month 1 first. Empty when nothing is owed or it never pays off. */
  schedule: LoanResult['schedule'];
  totalInterest: Money;
  /** Σ payments (interest + principal). */
  totalPaid: Money;
  /** First month the balance is 0 (0 = nothing owed); null = the payment never covers the interest. */
  payoffMonth: number | null;
};

/**
 * Month-by-month amortization at a fixed monthly payment plus an extra payment:
 *   interest  = balance × apr / 12
 *   principal = min(payment + extra − interest, balance)   (the last payment only clears what is left)
 * If payment + extra ≤ the first month's interest the balance never falls: payoffMonth = null and
 * the schedule is empty (there is no finite schedule to show). A loan that would take longer than
 * MAX_SIMULATION_MONTHS also returns null.
 *
 * Numerics: with a level payment the principal part grows by (1 + r) each month (principal_{k+1} =
 * payment − r·(balance_k − principal_k) = principal_k·(1 + r)), so it is carried forward that way
 * instead of as `payment − interest`. That is the same schedule, without the cancellation that
 * otherwise loses the principal entirely when the payment barely exceeds the interest.
 * `firstPrincipal` lets `loan()` pass the exact first-month principal of an amortized payment.
 */
export function amortize(input: {
  principal: Money;
  apr: Rate;
  payment: Money;
  extraPayment?: Money;
  /** payment + extra − the first month's interest, when the caller knows it more precisely. */
  firstPrincipal?: Money;
}): Amortization {
  const { principal, apr, payment } = input;
  const extra = input.extraPayment ?? 0;
  assertNonNegative('principal', principal);
  assertNonNegative('apr', apr);
  assertNonNegative('payment', payment);
  assertNonNegative('extraPayment', extra);

  const empty = { schedule: [], totalInterest: 0, totalPaid: 0 };
  if (principal <= PAID_OFF_EPSILON) return { ...empty, payoffMonth: 0 };
  const r = apr / 12;
  let principalPart = input.firstPrincipal ?? payment + extra - principal * r;
  if (!(principalPart > 0)) return { ...empty, payoffMonth: null }; // never pays off

  const schedule: LoanResult['schedule'] = [];
  let balance = principal;
  let totalInterest = 0;
  let totalPaid = 0;
  for (let month = 1; month <= MAX_SIMULATION_MONTHS; month++) {
    const interest = balance * r;
    const paid = Math.min(principalPart, balance);
    balance -= paid;
    if (balance <= PAID_OFF_EPSILON) balance = 0;
    totalInterest += interest;
    totalPaid += interest + paid;
    schedule.push({ month, interest, principal: paid, balance });
    if (balance === 0) return { schedule, totalInterest, totalPaid, payoffMonth: month };
    principalPart *= 1 + r;
  }
  return { ...empty, payoffMonth: null }; // not paid off within 100 years
}
