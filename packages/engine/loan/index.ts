// T3: Loan Lab math. Spec: docs/ENGINEERING.md → Loan amortization.
//
// loan(p, l)
//   P = amount − downPayment + fees (fees are rolled into the loan); r = apr / 12
//   monthly = P·r / (1 − (1 + r)^−n), or P / n at 0% APR (./amortize.ts)
//   schedule: interest = balance·r, principal = min(monthly + extra − interest, balance)
//   payoffMonth = first month the balance is 0; null when monthly + extra ≤ the first interest
//   totalCost = downPayment + Σ payments (fees and interest included)
//   debtLoad = required monthly debt payments / take-home pay, before and after the new loan
//   effect10y = forecast(with the purchase financed by this loan).in10y.mid − forecast(without).in10y.mid,
//               in today's dollars (like Move.effect10y). The thing bought is consumption, not an
//               asset (as in Can I Afford It?), so this is the 10-year cost of buying it this way.
//
// Debt load counts required payments only (no extra payments), each capped at what is owed and 0
// for a paid-off debt, with an estimated card minimum following the card formula: the same
// numbers as the simulation's `requiredDebtPayments` in month 1, so Loan Lab and Can I Afford It?
// agree. With no take-home pay (0 or below) any payment is an unbounded load: Infinity, or 0 when
// nothing is owed.
//
// Invalid inputs (negative or non-finite amounts, a down payment above the amount, a term that is
// not a whole number of months, duplicate debt ids, ...) throw a RangeError, like the rest of the
// engine. API inputs are also validated by the zod schemas in @lifeguessr/types before they get here.
import type { Debt, LoanInput, LoanResult, Money, Profile, Rate } from '@lifeguessr/types';
import { forecast } from '../forecast';
import { type ForecastRates } from '../simulate';
import { requiredPayment, validateDebts } from './debts';
import { simulatePayoff } from './payoffSimulation';
export { validateDebts } from './debts';
export { payoffPlan, comparePayoff, extraToFinishBy, suggestedPayoffExtra, type PayoffExtraSuggestion } from './payoff';
import {
  PAID_OFF_EPSILON,
  amortize,
  amortizedPayment,
  assertNonNegative,
  assertTermMonths,
  firstPrincipal,
} from './amortize';

export { MAX_SIMULATION_MONTHS, amortize, amortizedPayment, type Amortization } from './amortize';

export type LoanOptions = {
  /** Rates for the effect10y forecasts (e.g. the area's inflation), as for rankMoves. */
  rates?: Partial<ForecastRates>;
};

/** Throws a RangeError for a loan input the math can't use. */
export function validateLoanInput(l: LoanInput): void {
  assertNonNegative('amount', l.amount);
  assertNonNegative('apr', l.apr);
  assertTermMonths(l.termMonths);
  if (l.fees !== undefined) assertNonNegative('fees', l.fees);
  if (l.downPayment !== undefined) assertNonNegative('downPayment', l.downPayment);
  if (l.extraPayment !== undefined) assertNonNegative('extraPayment', l.extraPayment);
  if ((l.downPayment ?? 0) > l.amount) {
    throw new RangeError(`Invalid downPayment: ${l.downPayment} is more than the amount ${l.amount}`);
  }
}

/** Required monthly debt payments / monthly take-home pay (∞ when there is no pay but a payment). */
function debtLoad(payments: Money, takeHomePay: Money): Rate {
  if (takeHomePay > 0) return payments / takeHomePay;
  return payments > 0 ? Number.POSITIVE_INFINITY : 0;
}

/** Net worth at month 120, mid, today's dollars, optionally with the loan-financed purchase. */
function netWorthIn10y(p: Profile, rates: Partial<ForecastRates> | undefined, l?: LoanInput): Money {
  const extra = l ? [{ label: 'loan', amount: l.amount, recurring: false as const, payWith: { loan: l } }] : undefined;
  return forecast(p, 10, { todaysDollars: true, rates, extra }).in10y.mid;
}

function checkProfile(p: Profile): void {
  if (!Number.isFinite(p.takeHomePay.value)) throw new RangeError(`Invalid takeHomePay: ${p.takeHomePay.value}`);
  validateDebts(p.debts);
}

/** `loan` against a precomputed baseline 10-year net worth (compareLoans computes it once). */
function loanAgainst(p: Profile, l: LoanInput, baseIn10y: () => Money, rates: Partial<ForecastRates> | undefined): LoanResult {
  validateLoanInput(l);
  const downPayment = l.downPayment ?? 0;
  const principal = l.amount - downPayment + (l.fees ?? 0);
  const monthly = amortizedPayment(principal, l.apr, l.termMonths);
  const extra = l.extraPayment ?? 0;
  const a = amortize({
    principal,
    apr: l.apr,
    payment: monthly,
    extraPayment: extra,
    // Exact first-month principal of the level payment (see amortize's numerics note).
    firstPrincipal: principal > 0 ? firstPrincipal(principal, l.apr / 12, l.termMonths) + extra : undefined,
  });

  const requiredBefore = p.debts.reduce((sum, d) => sum + requiredPayment(d, d.balance), 0);
  const takeHome = p.takeHomePay.value;
  const buysSomething = l.amount > 0 || principal > 0;
  return {
    monthly,
    totalInterest: a.totalInterest,
    totalCost: downPayment + a.totalPaid,
    payoffMonth: a.payoffMonth,
    debtLoadBefore: debtLoad(requiredBefore, takeHome),
    debtLoadAfter: debtLoad(requiredBefore + (principal > PAID_OFF_EPSILON ? monthly : 0), takeHome),
    effect10y: buysSomething ? netWorthIn10y(p, rates, l) - baseIn10y() : 0,
    schedule: a.schedule,
  };
}

/** Amortization of one loan, its effect on the profile's debt load, and its 10-year effect on net worth. */
export function loan(p: Profile, l: LoanInput, opts: LoanOptions = {}): LoanResult {
  checkProfile(p);
  return loanAgainst(p, l, () => netWorthIn10y(p, opts.rates), opts.rates);
}

/** `loan` for each offer, in the same order, against one shared baseline forecast. */
export function compareLoans(p: Profile, ls: readonly LoanInput[], opts: LoanOptions = {}): LoanResult[] {
  checkProfile(p);
  let base: Money | undefined;
  const baseIn10y = () => (base ??= netWorthIn10y(p, opts.rates));
  return ls.map((l) => loanAgainst(p, l, baseIn10y, opts.rates));
}

/**
 * Pays off several debts with a fixed monthly budget = Σ today's required payments + each debt's
 * own extraPayment + `extra`. Each month every debt accrues interest (apr / 12) and gets its
 * required payment (+ its own extra); what is left of the budget, including what paid-off debts
 * and shrinking card minimums free up, goes to the debts in order. avalanche = highest APR first
 * (ties: smaller balance); snowball = smallest balance first (ties: higher APR); then input order.
 * `order` lists the debts that have a balance. payoffMonth = month the last one is paid (0 when
 * nothing is owed); null when the budget never clears them within MAX_SIMULATION_MONTHS.
 */
export function payoffOrder(
  debts: Debt[],
  extra: Money,
  method: 'avalanche' | 'snowball',
): { order: string[]; payoffMonth: number | null; totalInterest: Money } {
  const result = simulatePayoff(debts, extra, method);
  return { order: result.order, payoffMonth: result.monthsToDebtFree, totalInterest: result.totalInterest };
}
