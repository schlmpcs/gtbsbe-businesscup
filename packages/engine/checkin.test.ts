// S14 monthEndDetail: monthEnd with per-category rows. The rows must add up to monthEnd's numbers.
import { describe, expect, it } from 'vitest';
import { profileDemo } from '@lifeguessr/data/fixtures';
import { COST_CATEGORIES, type CategoryTotals, type CostCategory, type Money } from '@lifeguessr/types';
import { monthEndDetail } from './checkin';
import { monthEnd, type CurrentMonth } from './month';

const totals = (t: Partial<Record<CostCategory, Money>> = {}): Record<CostCategory, Money> =>
  Object.fromEntries(COST_CATEGORIES.map((c) => [c, t[c] ?? 0])) as Record<CostCategory, Money>;
const month = (m: string, t: Partial<Record<CostCategory, Money>>): CategoryTotals => ({ month: m, totals: totals(t), oneOffs: [] });
const current = (m: string, day: number, t: Partial<Record<CostCategory, Money>>): CurrentMonth => ({ month: m, day, totals: totals(t) });

const usual = { rentUtilities: 1900, car: 300, groceries: 500, eatingOut: 300, subscriptions: 60, other: 300, debtPayments: 600 };
const history = [month('2026-08', usual), month('2026-09', { ...usual, eatingOut: 320 }), month('2026-10', { ...usual, eatingOut: 280 })];

describe('monthEndDetail', () => {
  it('rows add up to monthEnd: projection, average, drifts', () => {
    const cur = current('2026-11', 15, { rentUtilities: 1900, groceries: 250, eatingOut: 400, other: 150 });
    const base = monthEnd(profileDemo, history, cur);
    const d = monthEndDetail(profileDemo, history, cur);
    expect(d.projectedSpend).toBe(base.projectedSpend);
    expect(d.vsAverage).toBe(base.vsAverage);
    expect(d.drifts).toEqual(base.drifts);
    expect(d.rows.reduce((s, r) => s + r.projected, 0)).toBeCloseTo(base.projectedSpend, 9);
    expect(d.usualSpend - d.projectedSpend).toBeCloseTo(-base.vsAverage!, 9);
    expect(d.rows.filter((r) => r.drift).map((r) => r.category).sort()).toEqual(base.drifts.map((x) => x.category).sort());
    expect(d.rows.some((r) => r.category === 'debtPayments')).toBe(false);
    expect(d.usualFromHistory).toBe(true);
    expect(d.spentSoFar).toBe(1900 + 250 + 400 + 150);
    expect([d.day, d.daysInMonth]).toEqual([15, 30]);
    // Eating out: $400 by day 15 of 30 → $800, usual $300: the largest drift, listed first.
    expect(d.rows[0]).toMatchObject({ category: 'eatingOut', projected: 800, usual: 300, delta: 500, drift: true });
    // A bill not paid yet projects to its usual amount.
    expect(d.rows.find((r) => r.category === 'car')).toMatchObject({ soFar: 0, projected: 300, usual: 300, delta: 0, drift: false });
  });

  it('with less than 3 months of history the usual month is the profile, with no deltas', () => {
    const d = monthEndDetail(profileDemo, history.slice(1), current('2026-11', 30, { groceries: 600 }));
    expect(d.usualFromHistory).toBe(false);
    expect(d.vsAverage).toBeNull();
    expect(d.rows.every((r) => r.delta === null && !r.drift)).toBe(true);
    expect(d.rows.find((r) => r.category === 'groceries')!.usual).toBe(profileDemo.spending.groceries.value);
  });

  it('without a month: the profile month, nothing spent', () => {
    const d = monthEndDetail(profileDemo, []);
    expect(d.projectedSpend).toBe(monthEnd(profileDemo, []).projectedSpend);
    expect(d.usualSpend).toBe(d.projectedSpend);
    expect([d.spentSoFar, d.day, d.daysInMonth]).toEqual([0, null, null]);
  });

  it('validates like monthEnd', () => {
    expect(() => monthEndDetail(profileDemo, history, current('2026-11', 31, {}))).toThrow(RangeError);
  });
});
