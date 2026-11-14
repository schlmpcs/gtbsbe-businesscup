// Why the payoff methods come out the same (issue #144), on plans written out by hand (src/test/payoff.ts):
// avalanche 40 months / $5,000, snowball 41 / $5,400, minimums only 46 / $6,200 unless a test says otherwise.
import type { PayoffComparison } from '@lifeguessr/types';
import { describe, expect, it } from 'vitest';
import { avalanchePlan, minimumPlan, snowballPlan } from '@/test/payoff';
import { payoffTie } from './payoffTie';

const SAME = 0.5;
type Over = Parameters<typeof avalanchePlan>[0];
const compare = (extra: number, a: Over = {}, s: Over = {}, m: Over = {}): PayoffComparison => ({
  extra,
  avalanche: avalanchePlan(a),
  snowball: snowballPlan(s),
  minimum: minimumPlan(m),
});
const asMinimum = { monthsToDebtFree: 46, totalInterest: 6_200 };
const asAvalanche = { monthsToDebtFree: 40, totalInterest: 5_000 };

describe('payoffTie', () => {
  it('is null when the methods differ', () => {
    expect(payoffTie(compare(100), SAME)).toBeNull();
  });

  it('is "noExtra" when all three match with no extra', () => {
    expect(payoffTie(compare(0, asMinimum, asMinimum), SAME)).toBe('noExtra');
  });

  it('is "tooSmall" when all three still match with some extra', () => {
    expect(payoffTie(compare(5, asMinimum, { ...asMinimum, totalInterest: 6_200.3 }), SAME)).toBe('tooSmall');
  });

  it('is "oneDebt" when there is one debt to pay', () => {
    const one = { order: ['auto-1'] };
    expect(payoffTie(compare(100, one, { ...one, ...asAvalanche }), SAME)).toBe('oneDebt');
  });

  it('is "sameOrder" when avalanche and snowball pay the debts in the same order (the demo debts)', () => {
    // Both canned plans already list card-1, auto-1, new-loan.
    expect(payoffTie(compare(25, {}, asAvalanche), SAME)).toBe('sameOrder');
  });

  it('is "sameResult" when the orders differ but the plans come out the same', () => {
    expect(payoffTie(compare(25, {}, { ...asAvalanche, totalInterest: 5_000.4, order: ['auto-1', 'card-1', 'new-loan'] }), SAME)).toBe('sameResult');
  });

  it('is null when avalanche and snowball differ by half a dollar or more, or by a month', () => {
    expect(payoffTie(compare(25, {}, { ...asAvalanche, totalInterest: 5_000.5 }), SAME)).toBeNull();
    expect(payoffTie(compare(25, {}, { ...asAvalanche, monthsToDebtFree: 41 }), SAME)).toBeNull();
  });

  it('is null for plans that never pay off: the never notice speaks for those, and 100 years of interest is not a total', () => {
    const never = { monthsToDebtFree: null, totalInterest: 99_999 };
    expect(payoffTie(compare(0, never, never, never), SAME)).toBeNull();
  });

  it('only calls all three the same when minimums only also matches; otherwise it is about avalanche and snowball', () => {
    // avalanche == snowball, but minimums only is later: not "noExtra", even at $0 (the orders roll freed payments differently).
    expect(payoffTie(compare(0, {}, asAvalanche), SAME)).toBe('sameOrder');
  });
});
