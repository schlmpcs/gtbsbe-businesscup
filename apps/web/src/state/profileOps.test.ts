import { cardMinPaymentFor } from '@lifeguessr/engine';
import { COST_CATEGORIES, type CategoryTotals, type CostCategory } from '@lifeguessr/types';
import { describe, expect, it } from 'vitest';
import { cloneProfileDemo } from '@/fixtures';
import {
  addDebt, applyUserPatch, mergeStatementHistory, mergeStatementTotals, setSpending, skipField, updateDebt,
} from './profileOps';

const totals = (over: Partial<Record<CostCategory, number>>): Record<CostCategory, number> =>
  Object.fromEntries(COST_CATEGORIES.map((c) => [c, over[c] ?? 0])) as Record<CostCategory, number>;

describe('profileOps', () => {
  it('setSpending marks the category measured and leaves the input untouched', () => {
    const p = cloneProfileDemo();
    const next = setSpending(p, 'eatingOut', 200);
    expect(next.spending.eatingOut).toEqual({ value: 200, isEstimate: false });
    expect(p.spending.eatingOut).toEqual({ value: 340, isEstimate: true });
  });

  it('skipField keeps the value and flags it as an estimate', () => {
    const next = skipField(cloneProfileDemo(), 'cash');
    expect(next.cash).toEqual({ value: 3800, isEstimate: true });
  });

  it('applyUserPatch makes the patched fields measured', () => {
    const next = applyUserPatch(cloneProfileDemo(), { spending: { groceries: 600 }, retirementShare: 0.1 });
    expect(next.spending.groceries).toEqual({ value: 600, isEstimate: false });
    expect(next.retirementShare).toEqual({ value: 0.1, isEstimate: false });
    expect(next.spending.other.isEstimate).toBe(true); // untouched categories keep their flag
  });

  it('a skipped minimum payment is estimated with the card formula', () => {
    const { profile, id } = addDebt(cloneProfileDemo(), { kind: 'card', balance: 2000, apr: 0.25, minPayment: null });
    expect(id).toBe('card-2');
    const d = profile.debts.find((x) => x.id === id)!;
    // 2000 × 0.25/12 + 1% × 2000 = 41.67 + 20 = 61.67
    expect(d.minPayment.value).toBeCloseTo(61.6667, 3);
    expect(d.minPayment.value).toBe(cardMinPaymentFor(2000, 0.25));
    expect(d.minPayment.isEstimate).toBe(true);

    const typed = updateDebt(profile, id, { kind: 'card', balance: 2000, apr: 0.25, minPayment: 80 });
    expect(typed.debts.find((x) => x.id === id)!.minPayment).toEqual({ value: 80, isEstimate: false });
  });

  it('mergeStatementTotals averages each category and detected pay, as measured values', () => {
    const months: CategoryTotals[] = [
      { month: '2026-09', totals: totals({ groceries: 500, eatingOut: 300 }), oneOffs: [], detectedPay: 5000 },
      { month: '2026-10', totals: totals({ groceries: 700, eatingOut: 100 }), oneOffs: [{ label: 'TV', amount: 900 }] },
    ];
    const next = mergeStatementTotals(cloneProfileDemo(), months);
    expect(next.spending.groceries).toEqual({ value: 600, isEstimate: false });
    expect(next.spending.eatingOut).toEqual({ value: 200, isEstimate: false });
    expect(next.takeHomePay).toEqual({ value: 5000, isEstimate: false });
  });

  it('mergeStatementHistory keeps one entry per month, newest upload wins, sorted', () => {
    const a = { month: '2026-10', totals: totals({ other: 1 }), oneOffs: [] };
    const b = { month: '2026-09', totals: totals({ other: 2 }), oneOffs: [] };
    const a2 = { month: '2026-10', totals: totals({ other: 3 }), oneOffs: [] };
    const merged = mergeStatementHistory([a, b], [a2]);
    expect(merged.map((m) => [m.month, m.totals.other])).toEqual([['2026-09', 2], ['2026-10', 3]]);
  });
});
