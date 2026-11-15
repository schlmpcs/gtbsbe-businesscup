// The comfort tier on top of canAfford: plain arithmetic profiles (no inflation, yield or returns).
import { describe, expect, it } from 'vitest';
import { profileDemo } from '@lifeguessr/data/fixtures';
import type { CostCategory, Debt, Profile, Purchase } from '@lifeguessr/types';
import { COST_CATEGORIES } from '@lifeguessr/types';
import { canAfford } from './afford';
import { affordComfort, comfortableCushionMonths } from './affordComfort';
import type { ForecastRates } from './simulate';

const ZERO: Partial<ForecastRates> = { inflationAnnual: 0, cashYieldAnnual: 0, returnAnnualNominal: 0, cardApr: 0 };

function profile(o: { pay: number; other: number; cash: number; debts?: Debt[] }): Profile {
  const spending = Object.fromEntries(
    COST_CATEGORIES.map((c) => [c, { value: c === 'other' ? o.other : 0, isEstimate: false }]),
  ) as Record<CostCategory, { value: number; isEstimate: boolean }>;
  return {
    age: { value: 30, isEstimate: false },
    takeHomePay: { value: o.pay, isEstimate: false },
    spending,
    cash: { value: o.cash, isEstimate: false },
    retirement: { value: 0, isEstimate: false },
    retirementShare: { value: 0, isEstimate: false },
    debts: o.debts ?? [],
    doneMoveIds: [],
  };
}

const buy = (amount: number, payWith: Purchase['payWith'] = 'cash', recurring: Purchase['recurring'] = false): Purchase => ({
  label: 'Thing', amount, recurring, payWith,
});

const tierOf = (p: Profile, x: Purchase) => affordComfort(p, x, canAfford(p, x, { rates: ZERO }).verdict, { rates: ZERO });

describe('affordComfort', () => {
  it('a small cash purchase with a deep cushion is comfortable', () => {
    // $2,000 costs a month, $20,000 cash, +$1,000 a month: 10 months of cushion before, 9.5 after $1,000.
    const p = profile({ pay: 3000, other: 2000, cash: 20_000 });
    const r = tierOf(p, buy(1000));
    expect(r.tier).toBe('comfortable');
    expect(r.stretchedBy).toBeNull();
    expect(r.cushionMonthsBefore).toBeCloseTo(10.5, 6); // lowest month = month 1: 21,000 / 2,000
    expect(r.cushionMonthsAfter).toBeCloseTo(10, 6); // 20,000 / 2,000
  });

  it('a purchase that fits but leaves under 3 months of cushion is stretched', () => {
    // Cash 8,000; buying 4,000 leaves 4,000 + 1,000 = 5,000 at month 1 = 2.5 months.
    const p = profile({ pay: 3000, other: 2000, cash: 8000 });
    const x = buy(4000);
    expect(canAfford(p, x, { rates: ZERO }).verdict).toBe('fits');
    const r = tierOf(p, x);
    expect(r.cushionMonthsAfter).toBeCloseTo(2.5, 6);
    expect(r.cushionMonthsAfter).toBeLessThan(comfortableCushionMonths.value);
    expect(r).toMatchObject({ tier: 'stretched', stretchedBy: 'cushion' });
  });

  it('a loan that lifts the debt load above 20% is stretched by debt load', () => {
    // Pay 4,000; a 0% loan of 36,000 over 36 months = 1,000 a month = 25% debt load.
    const p = profile({ pay: 4000, other: 1000, cash: 30_000 });
    const x = buy(36_000, { loan: { amount: 36_000, apr: 0, termMonths: 36 } });
    expect(canAfford(p, x, { rates: ZERO }).verdict).toBe('fits');
    const r = tierOf(p, x);
    expect(r.debtLoadBefore).toBe(0);
    expect(r.debtLoadAfter).toBeCloseTo(0.25, 9);
    expect(r).toMatchObject({ tier: 'stretched', stretchedBy: 'debtLoad' });
  });

  it('a debt load already above 20% does not make a cash purchase stretched', () => {
    const debts: Debt[] = [{ id: 'd', kind: 'personal', balance: 50_000, apr: 0, minPayment: { value: 1000, isEstimate: false } }];
    const p = profile({ pay: 4000, other: 1000, cash: 30_000, debts });
    const r = tierOf(p, buy(500));
    expect(r.debtLoadBefore).toBeCloseTo(0.25, 9);
    expect(r.tier).toBe('comfortable');
  });

  it('anything canAfford does not pass is "not yet"', () => {
    const p = profile({ pay: 3000, other: 2000, cash: 1000 });
    const x = buy(50_000);
    const verdict = canAfford(p, x, { rates: ZERO }).verdict;
    expect(verdict).not.toBe('fits');
    expect(affordComfort(p, x, verdict, { rates: ZERO })).toMatchObject({ tier: 'notYet', stretchedBy: null });
  });

  it('counts a recurring purchase in the monthly outflow', () => {
    const p = profile({ pay: 5000, other: 2000, cash: 20_000 });
    const r = tierOf(p, buy(1000, 'cash', 'monthly'));
    // Month 1: 20,000 + 5,000 − 2,000 − 1,000 = 22,000 cash over 3,000 of outflow.
    expect(r.cushionMonthsAfter).toBeCloseTo(22_000 / 3000, 6);
  });

  it('is deterministic on the demo profile and rejects a non-positive price', () => {
    const x = buy(1200);
    const v = canAfford(profileDemo, x).verdict;
    expect(affordComfort(profileDemo, x, v)).toEqual(affordComfort(profileDemo, x, v));
    expect(() => affordComfort(profileDemo, buy(0), 'fits')).toThrow(RangeError);
  });
});
