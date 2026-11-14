// Smoke tests for the T3 stub. T3 replaces/extends these with the full loan test suite.
import { describe, expect, it } from 'vitest';
import { cloneProfileDemo, loanOffersSample, profileDemo } from '@lifeguessr/data/fixtures';
import type { Debt } from '@lifeguessr/types';
import { compareLoans, loan, payoffOrder } from './index';

describe('loan (stub)', () => {
  it('hits the hand-checked payment: $28,000 at 6.9% for 36 months = $863.28/month', () => {
    const r = loan(profileDemo, { amount: 28_000, apr: 0.069, termMonths: 36 });
    expect(r.monthly).toBeCloseTo(863.279, 3);
    expect(r.payoffMonth).toBe(36);
    expect(r.schedule).toHaveLength(36);
    expect(r.schedule.at(-1)?.balance).toBe(0);
    expect(r.totalInterest).toBeCloseTo(863.279_4 * 36 - 28_000, 1);
    expect(r.totalCost).toBeCloseTo(28_000 + r.totalInterest, 6);
  });

  it('rolls fees into the principal and subtracts the down payment', () => {
    const r = loan(profileDemo, { amount: 28_000, apr: 0.069, termMonths: 36, downPayment: 3_000, fees: 500 });
    const plain = loan(profileDemo, { amount: 25_500, apr: 0.069, termMonths: 36 });
    expect(r.monthly).toBeCloseTo(plain.monthly, 9);
    expect(r.totalCost).toBeCloseTo(3_000 + plain.totalCost, 6);
  });

  it('handles 0% APR and pays off early with an extra payment', () => {
    expect(loan(profileDemo, { amount: 1_200, apr: 0, termMonths: 12 }).monthly).toBe(100);
    const r = loan(profileDemo, { amount: 1_200, apr: 0, termMonths: 12, extraPayment: 100 });
    expect(r.payoffMonth).toBe(6);
  });

  it('reports debt load before and after against take-home pay', () => {
    const r = loan(profileDemo, { amount: 28_000, apr: 0.069, termMonths: 36 });
    const before = (193.92 + 412) / 5_200;
    expect(r.debtLoadBefore).toBeCloseTo(before, 9);
    expect(r.debtLoadAfter).toBeCloseTo(before + r.monthly / 5_200, 9);
  });

  it('compares the fixture offers in order', () => {
    const rs = compareLoans(cloneProfileDemo(), [...loanOffersSample]);
    expect(rs).toHaveLength(3);
    expect(rs[0]?.monthly).toBeCloseTo(863.28, 2);
  });
});

describe('payoffOrder (stub)', () => {
  const debt = (id: string, balance: number, apr: number, min: number): Debt =>
    ({ id, kind: 'card', balance, apr, minPayment: { value: min, isEstimate: false } });
  const debts = [debt('small-low', 500, 0.1, 25), debt('big-high', 5_000, 0.25, 150)];

  it('orders by APR (avalanche) or by balance (snowball)', () => {
    expect(payoffOrder(debts, 100, 'avalanche').order).toEqual(['big-high', 'small-low']);
    expect(payoffOrder(debts, 100, 'snowball').order).toEqual(['small-low', 'big-high']);
  });

  it('avalanche never pays more interest than snowball', () => {
    const a = payoffOrder(debts, 100, 'avalanche');
    const s = payoffOrder(debts, 100, 'snowball');
    expect(a.payoffMonth).not.toBeNull();
    expect(a.totalInterest).toBeLessThanOrEqual(s.totalInterest);
  });

  it('returns null when the payments never cover the interest', () => {
    expect(payoffOrder([debt('x', 10_000, 0.3, 50)], 0, 'avalanche').payoffMonth).toBeNull();
  });
});
