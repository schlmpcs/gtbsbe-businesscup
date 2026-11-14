// Daily log → monthEnd's `current`, the usual month and "safe to spend today". Spec: docs/ENGINEERING.md → Daily log.
import { describe, expect, it } from 'vitest';
import { profileDemo } from '@lifeguessr/data/fixtures';
import { COST_CATEGORIES, type CategoryTotals, type CostCategory, type DailyEntry, type Money } from '@lifeguessr/types';
import { dailyMonthToDate, dailyTotalsByDay, safeToSpendToday } from './daily';
import { monthEnd, usualMonthSpend } from './month';

const totals = (t: Partial<Record<CostCategory, Money>> = {}): Record<CostCategory, Money> =>
  Object.fromEntries(COST_CATEGORIES.map((c) => [c, t[c] ?? 0])) as Record<CostCategory, Money>;
const month = (m: string, t: Partial<Record<CostCategory, Money>>): CategoryTotals => ({ month: m, totals: totals(t), oneOffs: [] });
let n = 0;
const entry = (date: string, category: CostCategory, amount: Money, label?: string): DailyEntry => ({
  id: `e${++n}`, date, category, amount, ...(label ? { label } : {}),
});

// Demo profile: bills = rent 1,950 + car 310 + childcare 0 + subscriptions 85 = 2,345;
// the rest = groceries 520 + eating out 340 + other 450 = 1,310; usual month = 3,655.
const DEMO_USUAL = 3_655;
const DEMO_BILLS = 2_345;

const NOV_LOG = [
  entry('2026-11-02', 'eatingOut', 5, 'coffee'),
  entry('2026-11-10', 'groceries', 64, 'groceries'),
  entry('2026-11-14', 'other', 18, 'taxi'),
  entry('2026-11-14', 'eatingOut', 5.5, 'coffee'),
  entry('2026-11-20', 'groceries', 100),   // after today: ignored
  entry('2026-10-31', 'groceries', 999),   // last month: ignored
];

describe('dailyMonthToDate', () => {
  it('sums this month up to today by category; later days and other months are left out', () => {
    const c = dailyMonthToDate(NOV_LOG, '2026-11', 14);
    expect(c.month).toBe('2026-11');
    expect(c.day).toBe(14);
    expect(c.totals).toEqual(totals({ eatingOut: 10.5, groceries: 64, other: 18 }));
  });

  it('an empty log is all zeros', () => {
    expect(dailyMonthToDate([], '2026-02', 28).totals).toEqual(totals());
  });

  it('feeds monthEnd: bills at usual, the rest extrapolated from the log', () => {
    const r = monthEnd(profileDemo, [], dailyMonthToDate(NOV_LOG, '2026-11', 14));
    // 30-day month: (10.5 + 64 + 18) / 14 × 30, plus bills at the profile's usual.
    expect(r.projectedSpend).toBeCloseTo(DEMO_BILLS + (92.5 / 14) * 30, 9);
  });

  it('throws a RangeError on bad input', () => {
    expect(() => dailyMonthToDate([], '2026-13', 1)).toThrow(RangeError);
    expect(() => dailyMonthToDate([], '2026-11', 31)).toThrow(RangeError);
    expect(() => dailyMonthToDate([], '2026-11', 0)).toThrow(RangeError);
    expect(() => dailyMonthToDate([entry('2026-11', 'other', 5)], '2026-11', 3)).toThrow(RangeError);
    expect(() => dailyMonthToDate([entry('2026-11-31', 'other', 5)], '2026-11', 3)).toThrow(RangeError);
    expect(() => dailyMonthToDate([entry('2026-11-01', 'other', -5)], '2026-11', 3)).toThrow(RangeError);
    expect(() => dailyMonthToDate([entry('2026-11-01', 'other', Number.NaN)], '2026-11', 3)).toThrow(RangeError);
  });
});

describe('dailyTotalsByDay', () => {
  it('sums each day of the month, newest day first', () => {
    expect(dailyTotalsByDay(NOV_LOG, '2026-11')).toEqual([
      { date: '2026-11-20', total: 100 },
      { date: '2026-11-14', total: 23.5 },
      { date: '2026-11-10', total: 64 },
      { date: '2026-11-02', total: 5 },
    ]);
    expect(dailyTotalsByDay(NOV_LOG, '2026-09')).toEqual([]);
    expect(() => dailyTotalsByDay(NOV_LOG, 'Nov')).toThrow(RangeError);
  });
});

describe('usualMonthSpend', () => {
  it('without 3 full months: the profile, debtPayments left out', () => {
    const u = usualMonthSpend(profileDemo, [month('2026-10', { groceries: 900 })], '2026-11');
    expect(u.fromHistory).toBe(false);
    expect(u.total).toBeCloseTo(DEMO_USUAL, 9);
    expect(u.byCategory.debtPayments).toBe(0);
    expect(u.byCategory.groceries).toBe(520);
  });

  it('with 3 full months before this one: their mean (later months ignored)', () => {
    const h = [
      month('2026-08', { groceries: 400, rentUtilities: 2_000 }),
      month('2026-09', { groceries: 500, rentUtilities: 2_000 }),
      month('2026-10', { groceries: 600, rentUtilities: 2_000, debtPayments: 300 }),
      month('2026-11', { groceries: 5_000 }),
    ];
    const u = usualMonthSpend(profileDemo, h, '2026-11');
    expect(u.fromHistory).toBe(true);
    expect(u.byCategory.groceries).toBeCloseTo(500, 9);
    expect(u.total).toBeCloseTo(2_500, 9);
  });

  it('agrees with monthEnd: a bill with nothing paid projects to its usual', () => {
    const h = ['2026-08', '2026-09', '2026-10'].map((m, i) => month(m, { rentUtilities: 1_800 + i * 30 }));
    const u = usualMonthSpend(profileDemo, h, '2026-11');
    const r = monthEnd(profileDemo, h, { month: '2026-11', day: 5, totals: totals() });
    expect(r.projectedSpend).toBeCloseTo(u.byCategory.rentUtilities + u.byCategory.car + u.byCategory.childcare + u.byCategory.subscriptions, 9);
  });

  it('validates like monthEnd', () => {
    expect(() => usualMonthSpend(profileDemo, [], '2026-1')).toThrow(RangeError);
    expect(() => usualMonthSpend(profileDemo, [month('2026-10', {}), month('2026-10', {})], '2026-11')).toThrow(RangeError);
  });
});

describe('safeToSpendToday', () => {
  it('(planned − spent − bills not paid yet) / days left, today included', () => {
    const s = safeToSpendToday(profileDemo, [], dailyMonthToDate(NOV_LOG, '2026-11', 14));
    expect(s.planned).toBeCloseTo(DEMO_USUAL, 9);
    expect(s.spent).toBeCloseTo(92.5, 9);
    expect(s.billsDue).toBeCloseTo(DEMO_BILLS, 9);
    expect(s.remaining).toBeCloseTo(DEMO_USUAL - 92.5 - DEMO_BILLS, 9); // 1,217.50
    expect(s.daysLeft).toBe(17); // Nov 14..30
    expect(s.perDay).toBeCloseTo(1_217.5 / 17, 9);
    expect(s.usualFromHistory).toBe(false);
  });

  it('a bill paid above its usual eats into the rest of the month; a paid bill is no longer due', () => {
    const log = [...NOV_LOG, entry('2026-11-01', 'rentUtilities', 2_000, 'rent')];
    const s = safeToSpendToday(profileDemo, [], dailyMonthToDate(log, '2026-11', 14));
    expect(s.billsDue).toBeCloseTo(310 + 85, 9);
    // The non-bill budget 1,310, minus 92.50 spent, minus the 50 over on rent.
    expect(s.remaining).toBeCloseTo(1_310 - 92.5 - 50, 9);
  });

  it('on the first day the whole non-bill budget is spread over the month', () => {
    const s = safeToSpendToday(profileDemo, [], dailyMonthToDate([], '2026-11', 1));
    expect(s.daysLeft).toBe(30);
    expect(s.perDay).toBeCloseTo(1_310 / 30, 9);
  });

  it('on the last day it is everything left; over the usual month it is 0 and remaining is negative', () => {
    expect(safeToSpendToday(profileDemo, [], dailyMonthToDate([], '2026-02', 28)).daysLeft).toBe(1);
    const s = safeToSpendToday(profileDemo, [], dailyMonthToDate([entry('2026-11-03', 'other', 2_000)], '2026-11', 14));
    expect(s.remaining).toBeCloseTo(1_310 - 2_000, 9);
    expect(s.perDay).toBe(0);
  });

  it('debt payments are not counted as spending (as in monthEnd)', () => {
    const s = safeToSpendToday(profileDemo, [], dailyMonthToDate([entry('2026-11-03', 'debtPayments', 400)], '2026-11', 14));
    expect(s.spent).toBe(0);
  });

  it('uses the 3-month usual when there is history', () => {
    const h = ['2026-08', '2026-09', '2026-10'].map((m) => month(m, { groceries: 600, eatingOut: 300 }));
    const s = safeToSpendToday(profileDemo, h, dailyMonthToDate([], '2026-11', 1));
    expect(s.usualFromHistory).toBe(true);
    expect(s.planned).toBeCloseTo(900, 9);
    expect(s.billsDue).toBe(0);
    expect(s.perDay).toBeCloseTo(30, 9);
  });

  it('throws a RangeError on a bad day', () => {
    expect(() => safeToSpendToday(profileDemo, [], { month: '2026-11', day: 31, totals: totals() })).toThrow(RangeError);
  });
});
