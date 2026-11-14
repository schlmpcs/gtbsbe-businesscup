import { cardMinPaymentFor } from '@lifeguessr/engine';
import { COST_CATEGORIES, type CategoryTotals, type CostCategory } from '@lifeguessr/types';
import { describe, expect, it } from 'vitest';
import { cloneProfileDemo } from '@/fixtures';
import {
  addDebt, applyUserPatch, mergeStatementHistory, mergeStatementTotals, setSpending, setSubscriptionsLine, skipField, updateDebt,
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

  it('setSubscriptionsLine: measured from a statement, an estimate from ticks, other lines untouched', () => {
    const p = cloneProfileDemo();
    expect(setSubscriptionsLine(p, 69.54, true).spending.subscriptions).toEqual({ value: 69.54, isEstimate: false });
    expect(setSubscriptionsLine(p, 54.97, false).spending.subscriptions).toEqual({ value: 54.97, isEstimate: true });
    expect(setSubscriptionsLine(p, 54.97, false).spending.eatingOut).toEqual(p.spending.eatingOut);
    expect(p.spending.subscriptions).toEqual({ value: 85, isEstimate: false }); // the input is not changed
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

  it('mergeStatementTotals leaves out a month the statement covers only in part, and keeps rent it never saw', () => {
    const p = cloneProfileDemo();
    const months: CategoryTotals[] = [
      { month: '2026-09', totals: totals({ groceries: 500 }), oneOffs: [], detectedPay: 4800, firstDay: 1, lastDay: 30 },
      { month: '2026-10', totals: totals({ groceries: 600 }), oneOffs: [], detectedPay: 4800, firstDay: 2, lastDay: 31 },
      // The export stops on Nov 12: two weeks of groceries and one paycheck are not a month.
      { month: '2026-11', totals: totals({ groceries: 150 }), oneOffs: [], detectedPay: 2400, firstDay: 1, lastDay: 12 },
    ];
    const next = mergeStatementTotals(p, months);
    expect(next.spending.groceries).toEqual({ value: 550, isEstimate: false });
    expect(next.takeHomePay).toEqual({ value: 4800, isEstimate: false });
    // A statement with no rent at all says it is paid from elsewhere, not that it is $0.
    expect(next.spending.rentUtilities).toEqual(p.spending.rentUtilities);
    expect(next.spending.childcare).toEqual({ value: 0, isEstimate: false });
  });

  it('mergeStatementHistory keeps one entry per month, newest upload wins, sorted', () => {
    const a = { month: '2026-10', totals: totals({ other: 1 }), oneOffs: [] };
    const b = { month: '2026-09', totals: totals({ other: 2 }), oneOffs: [] };
    const a2 = { month: '2026-10', totals: totals({ other: 3 }), oneOffs: [] };
    const merged = mergeStatementHistory([a, b], [a2]);
    expect(merged.map((m) => [m.month, m.totals.other])).toEqual([['2026-09', 2], ['2026-10', 3]]);
  });
});
