import type { Debt, Money, PayoffMethod, PayoffPlan } from '@lifeguessr/types';
import {
  assertNonNegative,
  MAX_SIMULATION_MONTHS,
  PAID_OFF_EPSILON,
} from './amortize';
import { requiredPayment, validateDebts } from './debts';

type Simulation = Omit<
  PayoffPlan,
  'interestSavedVsMinimum' | 'monthsSavedVsMinimum'
>;
const cents = (amount: number) => Math.round(amount * 100) / 100;

/** Shared fixed-budget simulation. Minimum uses input order and zero additional budget;
 * freed minimums still roll over. All calculations retain precision; only timeline output rounds. */
export function simulatePayoff(
  debts: readonly Debt[],
  extra: Money,
  method: PayoffMethod,
): Simulation {
  validateDebts(debts);
  assertNonNegative('extra', extra);
  if (!['avalanche', 'snowball', 'minimum'].includes(method))
    throw new RangeError('Invalid payoff method');
  const sorted = debts
    .filter((d) => d.balance > PAID_OFF_EPSILON)
    .sort((a, b) =>
      method === 'minimum'
        ? 0
        : method === 'avalanche'
          ? b.apr - a.apr || a.balance - b.balance
          : a.balance - b.balance || b.apr - a.apr,
    );
  const balance = sorted.map((d) => d.balance);
  const perDebt = debts.map((d) => ({
    id: d.id,
    payoffMonth: d.balance <= PAID_OFF_EPSILON ? 0 : (null as number | null),
    interest: 0,
  }));
  const details = new Map(perDebt.map((d) => [d.id, d]));
  const ownExtra = sorted.map((d) => d.extraPayment ?? 0);
  const budget = sorted.reduce(
    (sum, d, i) => sum + requiredPayment(d, d.balance) + ownExtra[i]!,
    method === 'minimum' ? 0 : extra,
  );
  const result: Simulation = {
    method,
    order: sorted.map((d) => d.id),
    monthsToDebtFree: sorted.length ? null : 0,
    totalInterest: 0,
    totalPaid: 0,
    perDebt,
    timeline: [
      { month: 0, balance: cents(balance.reduce((a, b) => a + b, 0)) },
    ],
  };
  if (!sorted.length) return result;
  for (let month = 1; month <= MAX_SIMULATION_MONTHS; month++) {
    let left = budget;
    for (const [i, d] of sorted.entries()) {
      if (balance[i]! <= PAID_OFF_EPSILON) continue;
      const due = requiredPayment(d, balance[i]!) + ownExtra[i]!;
      const interest = balance[i]! * (d.apr / 12);
      result.totalInterest += interest;
      details.get(d.id)!.interest += interest;
      balance[i]! += interest;
      const pay = Math.min(due, balance[i]!, left);
      balance[i]! -= pay;
      left -= pay;
      result.totalPaid += pay;
    }
    for (let i = 0; i < sorted.length && left > 0; i++) {
      const pay = Math.min(left, balance[i]!);
      balance[i]! -= pay;
      left -= pay;
      result.totalPaid += pay;
    }
    for (const [i, d] of sorted.entries()) {
      if (balance[i]! <= PAID_OFF_EPSILON) {
        balance[i] = 0;
        details.get(d.id)!.payoffMonth ??= month;
      }
    }
    result.timeline.push({
      month,
      balance: cents(balance.reduce((a, b) => a + b, 0)),
    });
    if (balance.every((b) => b === 0)) {
      result.monthsToDebtFree = month;
      break;
    }
  }
  return result;
}
