// STUB until T3 (Aibek) — replace with the real implementation + tests
// Minimal but correct-by-formula versions so the app works on fixtures before T3 lands.
// Spec: docs/ENGINEERING.md → Loan amortization. Known gaps for T3: effect10y (needs the forecast),
// debt load with a zero/negative take-home pay, validation of odd inputs.
import type { Debt, LoanInput, LoanResult, Money, Profile, Rate } from '@lifeguessr/types';

/** Balances below this many dollars count as paid off (absorbs floating-point dust). */
const PAID_OFF_EPSILON: Money = 1e-6;
/** Safety cap for month-by-month simulations (100 years). */
export const MAX_SIMULATION_MONTHS = 1200;

/** Monthly payment for a fully amortizing loan: P·r / (1 − (1 + r)^−n), or P / n at 0% APR. */
export function amortizedPayment(principal: Money, apr: Rate, termMonths: number): Money {
  if (principal <= 0) return 0;
  const r = apr / 12;
  return r === 0 ? principal / termMonths : (principal * r) / (1 - (1 + r) ** -termMonths);
}

/** Σ required monthly debt payments / monthly take-home pay. */
function debtLoad(payments: Money, takeHomePay: Money): Rate {
  if (takeHomePay > 0) return payments / takeHomePay;
  return payments > 0 ? Number.POSITIVE_INFINITY : 0;
}

/** Amortization of one loan plus its effect on the profile's debt load. */
export function loan(p: Profile, l: LoanInput): LoanResult {
  const downPayment = l.downPayment ?? 0;
  const principal = Math.max(0, l.amount - downPayment + (l.fees ?? 0));
  const r = l.apr / 12;
  const extra = l.extraPayment ?? 0;
  const monthly = amortizedPayment(principal, l.apr, l.termMonths);

  const schedule: LoanResult['schedule'] = [];
  let balance = principal;
  let totalInterest = 0;
  let totalPaid = 0;
  let payoffMonth: number | null = principal === 0 ? 0 : null;
  const neverPaysOff = principal > 0 && monthly + extra <= principal * r;

  for (let month = 1; balance > PAID_OFF_EPSILON && month <= MAX_SIMULATION_MONTHS; month++) {
    const interest = balance * r;
    const payment = Math.min(monthly + extra, balance + interest);
    const principalPaid = payment - interest; // negative when the payment doesn't cover interest
    balance -= principalPaid;
    if (balance <= PAID_OFF_EPSILON) balance = 0;
    totalInterest += interest;
    totalPaid += payment;
    schedule.push({ month, interest, principal: principalPaid, balance });
    if (balance === 0) payoffMonth = month;
    if (neverPaysOff && month >= l.termMonths) break; // show the term, then stop: it never ends
  }

  const requiredBefore = p.debts.reduce((sum, d) => sum + d.minPayment.value, 0);
  return {
    monthly,
    totalInterest,
    totalCost: downPayment + totalPaid, // everything paid over the life of the loan, fees included
    payoffMonth: neverPaysOff ? null : payoffMonth,
    debtLoadBefore: debtLoad(requiredBefore, p.takeHomePay.value),
    debtLoadAfter: debtLoad(requiredBefore + monthly, p.takeHomePay.value),
    effect10y: 0, // T3/Y2: forecast(with loan).in10y.mid − forecast(without).in10y.mid
    schedule,
  };
}

/** `loan` for each offer, in the same order. */
export function compareLoans(p: Profile, ls: LoanInput[]): LoanResult[] {
  return ls.map((l) => loan(p, l));
}

/**
 * Pay off several debts with a fixed monthly budget: every debt gets its minimum (+ its own
 * extraPayment); `extra` and the minimums freed by paid-off debts go to the first debt in order.
 * avalanche = highest APR first; snowball = smallest balance first.
 */
export function payoffOrder(
  debts: Debt[],
  extra: Money,
  method: 'avalanche' | 'snowball',
): { order: string[]; payoffMonth: number | null; totalInterest: Money } {
  const sorted = [...debts].sort((a, b) =>
    method === 'avalanche' ? b.apr - a.apr || a.balance - b.balance : a.balance - b.balance || b.apr - a.apr,
  );
  const order = sorted.map((d) => d.id);
  const balances = new Map(sorted.map((d) => [d.id, d.balance]));
  const ownPayment = (d: Debt) => d.minPayment.value + (d.extraPayment ?? 0);
  const budget = sorted.filter((d) => d.balance > 0).reduce((sum, d) => sum + ownPayment(d), extra);

  let totalInterest = 0;
  for (let month = 1; month <= MAX_SIMULATION_MONTHS; month++) {
    const active = sorted.filter((d) => (balances.get(d.id) ?? 0) > PAID_OFF_EPSILON);
    if (active.length === 0) return { order, payoffMonth: month - 1, totalInterest };

    for (const d of active) {
      const interest = (balances.get(d.id) ?? 0) * (d.apr / 12);
      totalInterest += interest;
      balances.set(d.id, (balances.get(d.id) ?? 0) + interest);
    }
    let left = budget;
    for (const d of active) {
      const pay = Math.min(ownPayment(d), balances.get(d.id) ?? 0, left);
      balances.set(d.id, (balances.get(d.id) ?? 0) - pay);
      left -= pay;
    }
    for (const d of active) {
      if (left <= 0) break;
      const pay = Math.min(left, balances.get(d.id) ?? 0);
      balances.set(d.id, (balances.get(d.id) ?? 0) - pay);
      left -= pay;
    }
    if (sorted.every((d) => (balances.get(d.id) ?? 0) <= PAID_OFF_EPSILON)) {
      return { order, payoffMonth: month, totalInterest };
    }
  }
  return { order, payoffMonth: null, totalInterest }; // not paid off within the simulation cap
}
