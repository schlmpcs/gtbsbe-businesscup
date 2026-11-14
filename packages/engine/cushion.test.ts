// Emergency cushion. Demo profile: essentials = rent 1,950 + groceries 520 + childcare 0 + car 310
// + debt minimums (193.92 + 412) = 3,385.92; full = all categories but debtPayments (3,655) + 605.92
// = 4,260.92; cash 3,800.
import { describe, expect, it } from 'vitest';
import { cloneProfileDemo, profileDemo } from '@lifeguessr/data/fixtures';
import { cushionBandMonths } from './assumptions';
import { CUSHION_ESSENTIAL_CATEGORIES, cushionBand, emergencyCushion } from './cushion';

describe('emergencyCushion', () => {
  it('demo profile: months of essentials and of full spending', () => {
    const c = emergencyCushion(profileDemo);
    expect(c.debtMinimums).toBeCloseTo(605.92, 9);
    expect(c.essentialMonthly).toBeCloseTo(3_385.92, 9);
    expect(c.fullMonthly).toBeCloseTo(4_260.92, 9);
    expect(c.monthsEssential).toBeCloseTo(3_800 / 3_385.92, 9);
    expect(c.monthsFull).toBeCloseTo(3_800 / 4_260.92, 9);
    expect(c.band).toBe('1to3');
    expect(c.next?.band).toBe('3to6');
    expect(c.next?.months).toBe(3);
    expect(c.next?.extraCash).toBeCloseTo(3 * 3_385.92 - 3_800, 6);
    expect(c.isEstimate).toBe(true); // car, groceries and the card minimum are estimates
  });

  it('essentials are rent, groceries, childcare and car, plus debt minimums', () => {
    expect([...CUSHION_ESSENTIAL_CATEGORIES].sort()).toEqual(['car', 'childcare', 'groceries', 'rentUtilities']);
  });

  it('ignores the informational debtPayments category and extra payments', () => {
    const p = cloneProfileDemo();
    p.spending.debtPayments = { value: 900, isEstimate: false };
    p.debts[0]!.extraPayment = 500;
    const c = emergencyCushion(p);
    expect(c.essentialMonthly).toBeCloseTo(3_385.92, 9);
    expect(c.fullMonthly).toBeCloseTo(4_260.92, 9);
  });

  it('skips paid-off debts and caps a minimum at the balance', () => {
    const p = cloneProfileDemo();
    p.debts[0]!.balance = 0;
    p.debts[1]!.balance = 100;
    expect(emergencyCushion(p).debtMinimums).toBeCloseTo(100, 9);
  });

  it('bands: a lower edge belongs to its band', () => {
    const { thin, okay, solid } = cushionBandMonths.value;
    expect([thin, okay, solid]).toEqual([1, 3, 6]);
    expect(cushionBand(0)).toBe('under1');
    expect(cushionBand(0.99)).toBe('under1');
    expect(cushionBand(1)).toBe('1to3');
    expect(cushionBand(2.99)).toBe('1to3');
    expect(cushionBand(3)).toBe('3to6');
    expect(cushionBand(6)).toBe('6plus');
  });

  it('next band and the extra cash to reach it', () => {
    const p = cloneProfileDemo();
    p.debts = [];
    p.spending.rentUtilities.value = 1_000;
    p.spending.groceries.value = 0;
    p.spending.car.value = 0;
    p.cash.value = 500; // 0.5 months of 1,000
    expect(emergencyCushion(p).next).toEqual({ band: '1to3', months: 1, extraCash: 500 });
    p.cash.value = 4_000;
    expect(emergencyCushion(p).next).toEqual({ band: '6plus', months: 6, extraCash: 2_000 });
    p.cash.value = 6_000;
    const c = emergencyCushion(p);
    expect(c.band).toBe('6plus');
    expect(c.next).toBeNull();
  });

  it('negative cash counts as none', () => {
    const p = cloneProfileDemo();
    p.cash.value = -250;
    const c = emergencyCushion(p);
    expect(c.cash).toBe(0);
    expect(c.monthsEssential).toBe(0);
    expect(c.band).toBe('under1');
    expect(c.next?.extraCash).toBeCloseTo(3_385.92, 9);
  });

  it('no essential spending: months null, nothing to reach', () => {
    const p = cloneProfileDemo();
    p.debts = [];
    for (const c of CUSHION_ESSENTIAL_CATEGORIES) p.spending[c].value = 0;
    const c = emergencyCushion(p);
    expect(c.monthsEssential).toBeNull();
    expect(c.monthsFull).toBeCloseTo(3_800 / (340 + 85 + 450), 9);
    expect(c.band).toBe('6plus');
    expect(c.next).toBeNull();
  });

  it('is not an estimate when cash and the essential inputs are measured', () => {
    const p = cloneProfileDemo();
    for (const c of CUSHION_ESSENTIAL_CATEGORIES) p.spending[c].isEstimate = false;
    p.debts[0]!.minPayment.isEstimate = false;
    p.spending.eatingOut.isEstimate = true; // not an essential
    expect(emergencyCushion(p).isEstimate).toBe(false);
    p.cash.isEstimate = true;
    expect(emergencyCushion(p).isEstimate).toBe(true);
  });
});
