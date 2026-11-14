import type { Debt, Money } from '@lifeguessr/types';
import { cardMinPaymentFor, usesCardFormula } from '../simulate';
import { assertNonNegative, PAID_OFF_EPSILON } from './amortize';

const DEBT_KINDS: readonly Debt['kind'][] = ['card', 'auto', 'student', 'personal', 'bnpl', 'mortgage'];

/** Throws a RangeError for debts the math can't use (bad numbers, unknown kind, duplicate ids). */
export function validateDebts(debts: readonly Debt[]): void {
  const ids = new Set<string>();
  for (const d of debts) {
    if (typeof d.id !== 'string' || d.id === '') throw new RangeError('Invalid debt id: empty');
    if (ids.has(d.id)) throw new RangeError(`Duplicate debt id: ${d.id}`);
    ids.add(d.id);
    if (!DEBT_KINDS.includes(d.kind)) throw new RangeError(`Invalid debt kind for ${d.id}: ${d.kind}`);
    assertNonNegative(`balance of ${d.id}`, d.balance);
    assertNonNegative(`apr of ${d.id}`, d.apr);
    assertNonNegative(`minPayment of ${d.id}`, d.minPayment.value);
    if (d.extraPayment !== undefined) assertNonNegative(`extraPayment of ${d.id}`, d.extraPayment);
  }
}

/**
 * The payment a debt requires this month at `balance`: the card formula for a card whose minimum is
 * an estimate, else its stated minimum; capped at what is owed (balance + this month's interest).
 */
export function requiredPayment(d: Debt, balance: Money): Money {
  if (balance <= PAID_OFF_EPSILON) return 0;
  const required = usesCardFormula(d) ? cardMinPaymentFor(balance, d.apr) : d.minPayment.value;
  return Math.min(required, balance * (1 + d.apr / 12));
}

