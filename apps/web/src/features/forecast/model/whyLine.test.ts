import { COST_CATEGORIES, type CostCategory, type Profile } from '@lifeguessr/types';
import { describe, expect, it } from 'vitest';
import { whyLine } from './whyLine';

/** No inflation, yield or returns: every number below is plain arithmetic. */
const ZERO = { inflationAnnual: 0, cashYieldAnnual: 0, returnAnnualNominal: 0 };

function profile(pay: number, other: number, cash: number): Profile {
  const spending = Object.fromEntries(
    COST_CATEGORIES.map((c) => [c, { value: c === 'other' ? other : 0, isEstimate: false }]),
  ) as Record<CostCategory, { value: number; isEstimate: boolean }>;
  return {
    age: { value: 30, isEstimate: false },
    takeHomePay: { value: pay, isEstimate: false },
    spending,
    cash: { value: cash, isEstimate: false },
    retirement: { value: 0, isEstimate: false },
    retirementShare: { value: 0, isEstimate: false },
    debts: [],
    doneMoveIds: [],
  };
}

describe('whyLine (S10)', () => {
  it('spending more than pay: the gap, and the month cash runs out', () => {
    // $9,716 out, $6,000 in: $3,716 short. Cash 24,000 − 3,716·m: 1,704 left after month 6,
    // gone in month 7 (24,000 / 3,716 = 6.46).
    expect(whyLine(profile(6000, 9716, 24_000), ZERO)).toEqual({
      takeHome: 6000,
      outflow: 9716,
      cashOutMonth: 7,
    });
  });

  it('cash that covers the gap exactly runs out in that month', () => {
    // $1,000 short, $3,000 cash: 0 left at the end of month 3.
    expect(whyLine(profile(4000, 5000, 3000), ZERO).cashOutMonth).toBe(3);
  });

  it('earning more than goes out: not short, no run-out month', () => {
    expect(whyLine(profile(5000, 4000, 1000), ZERO)).toEqual({
      takeHome: 5000,
      outflow: 4000,
      cashOutMonth: null,
    });
  });

  it('short, but cash lasts past 10 years: no run-out month', () => {
    // $100 short, $20,000 cash: 200 months > 120.
    expect(whyLine(profile(4000, 4100, 20_000), ZERO).cashOutMonth).toBeNull();
  });
});
