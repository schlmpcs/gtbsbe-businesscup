// T9: monthEnd. Spec: docs/ENGINEERING.md → Month-end. Hand-checked numbers next to each case.
import { describe, expect, it } from 'vitest';
import { cloneProfileDemo, profileDemo } from '@lifeguessr/data/fixtures';
import statementSampleCsv from '@lifeguessr/data/fixtures/statement.sample.csv?raw';
import { COST_CATEGORIES, type CategoryTotals, type CostCategory, type Money } from '@lifeguessr/types';
import { monthEndBillCategories, monthEndDriftMinSpread } from './assumptions';
import { monthEnd, type CurrentMonth } from './month';

const totals = (t: Partial<Record<CostCategory, Money>> = {}): Record<CostCategory, Money> =>
  Object.fromEntries(COST_CATEGORIES.map((c) => [c, t[c] ?? 0])) as Record<CostCategory, Money>;
const month = (m: string, t: Partial<Record<CostCategory, Money>>): CategoryTotals => ({ month: m, totals: totals(t), oneOffs: [] });
const current = (m: string, day: number, t: Partial<Record<CostCategory, Money>>): CurrentMonth => ({ month: m, day, totals: totals(t) });

/** Profile spend without uploads: every category but debtPayments. */
const demoSpend = 1_950 + 310 + 0 + 520 + 340 + 85 + 450;

describe('monthEnd: no statement for this month', () => {
  it('without uploads: the profile monthly spend, no average, no drifts', () => {
    const r = monthEnd(profileDemo, []);
    expect(r.projectedSpend).toBeCloseTo(demoSpend, 9); // debtPayments excluded
    expect(r.vsAverage).toBeNull();
    expect(r.drifts).toEqual([]);
  });

  it('history alone (no current month) still shows the profile spend and no flags', () => {
    const h = ['2026-07', '2026-08', '2026-09'].map((m) => month(m, { groceries: 2_000 }));
    expect(monthEnd(profileDemo, h)).toEqual({ projectedSpend: demoSpend, vsAverage: null, drifts: [] });
  });
});

describe('monthEnd: projection', () => {
  it('extrapolates variable categories linearly: so far / day × days in month', () => {
    // April has 30 days: 300 by day 15 → 600; 100 by day 10 → 300.
    const r = monthEnd(profileDemo, [], current('2026-04', 15, { groceries: 300, eatingOut: 150, other: 0 }));
    const bills = 1_950 + 310 + 0 + 85; // bill categories at the profile's usual (nothing paid yet)
    expect(r.projectedSpend).toBeCloseTo(600 + 300 + 0 + bills, 9);
  });

  it('uses the right number of days: 31, 30, 28 and the leap-year 29', () => {
    const p = cloneProfileDemo();
    for (const c of COST_CATEGORIES) p.spending[c] = { value: 0, isEstimate: false };
    const proj = (m: string) => monthEnd(p, [], current(m, 1, { groceries: 10 })).projectedSpend;
    expect(proj('2026-01')).toBeCloseTo(310, 9);
    expect(proj('2026-04')).toBeCloseTo(300, 9);
    expect(proj('2026-02')).toBeCloseTo(280, 9);
    expect(proj('2028-02')).toBeCloseTo(290, 9);
    expect(monthEnd(p, [], current('2026-04', 30, { groceries: 10 })).projectedSpend).toBeCloseTo(10, 9); // last day
  });

  it('projects bill categories as max(so far, usual), not by the days elapsed', () => {
    expect(monthEndBillCategories.value).toEqual(['rentUtilities', 'childcare', 'subscriptions', 'car']);
    const p = cloneProfileDemo(); // usual (no history): rent 1,950, car 310, subscriptions 85, childcare 0
    const r = (t: Partial<Record<CostCategory, Money>>) => monthEnd(p, [], current('2026-11', 2, t)).projectedSpend;
    expect(r({})).toBeCloseTo(1_950 + 310 + 85, 9); // variable categories: nothing spent yet → 0
    // Rent paid on the 1st: 1,720 < usual 1,950 → 1,950, not 1,720 / 2 × 30 = 25,800.
    expect(r({ rentUtilities: 1_720 })).toBeCloseTo(1_950 + 310 + 85, 9);
    // Above usual: the amount so far.
    expect(r({ rentUtilities: 2_100, car: 400, childcare: 50 })).toBeCloseTo(2_100 + 400 + 50 + 85, 9);
  });

  it('leaves debtPayments out (it is informational) and counts refunds as 0', () => {
    const p = cloneProfileDemo();
    for (const c of COST_CATEGORIES) p.spending[c] = { value: 0, isEstimate: false };
    expect(monthEnd(p, [], current('2026-04', 15, { debtPayments: 900, groceries: -40 })).projectedSpend).toBe(0);
  });
});

describe('monthEnd: history and drift', () => {
  const steady = (t: Partial<Record<CostCategory, Money>>) =>
    ['2026-01', '2026-02', '2026-03'].map((m) => month(m, t));

  it('no average and no flags with 0, 1 or 2 months of history', () => {
    const cur = current('2026-04', 15, { groceries: 1_000 }); // a huge overspend
    for (const n of [0, 1, 2]) {
      const r = monthEnd(profileDemo, steady({ groceries: 100 }).slice(0, n), cur);
      expect(r.vsAverage).toBeNull();
      expect(r.drifts).toEqual([]);
      expect(r.projectedSpend).toBeGreaterThan(2_000); // still projected
    }
  });

  it('with 3 months: vsAverage = projected − Σ averages and the real drift is flagged', () => {
    // groceries: average 100, spread max(0, 10, 25) = 25; projected 300 / 15 × 30 = 600 → +500.
    const r = monthEnd(profileDemo, steady({ groceries: 100 }), current('2026-04', 15, { groceries: 300 }));
    expect(r.projectedSpend).toBeCloseTo(600, 9);
    expect(r.vsAverage).toBeCloseTo(500, 9);
    expect(r.drifts).toEqual([{ category: 'groceries', delta: 600 - 100 }]);
  });

  it('flags at > max(std dev, 10% of average, $25): the 10% bound', () => {
    // 380, 400, 420: average 400, sample sd 20, 10% = 40 → spread 40.
    const h = [month('2026-01', { eatingOut: 380 }), month('2026-02', { eatingOut: 400 }), month('2026-03', { eatingOut: 420 })];
    const at = (soFar: number) => monthEnd(profileDemo, h, current('2026-04', 15, { eatingOut: soFar })).drifts;
    expect(at(220)).toEqual([]);                                     // 440: +40, not over
    expect(at(220.5)).toEqual([{ category: 'eatingOut', delta: 41 }]); // 441: +41
    expect(at(180)).toEqual([]);                                     // 360: −40
    expect(at(179.5)).toEqual([{ category: 'eatingOut', delta: -41 }]); // 359: −41 (under-spending drifts too)
  });

  it('flags at > max(std dev, 10% of average, $25): the std dev bound', () => {
    // 100, 300, 500: average 300, sample sd 200 → spread 200.
    const h = [month('2026-01', { other: 100 }), month('2026-02', { other: 300 }), month('2026-03', { other: 500 })];
    const at = (soFar: number) => monthEnd(profileDemo, h, current('2026-04', 15, { other: soFar })).drifts;
    expect(at(250)).toEqual([]);                                   // 500: +200
    expect(at(251)).toEqual([{ category: 'other', delta: 202 }]);  // 502: +202
  });

  it('flags at > max(std dev, 10% of average, $25): the $25 floor', () => {
    expect(monthEndDriftMinSpread.value).toBe(25);
    const h = steady({ other: 0 });
    const at = (soFar: number) => monthEnd(profileDemo, h, current('2026-04', 30, { other: soFar })).drifts;
    expect(at(25)).toEqual([]);
    expect(at(26)).toEqual([{ category: 'other', delta: 26 }]);
  });

  it('a bill drifts only when it really went over usual', () => {
    const h = steady({ rentUtilities: 1_720 });
    const on = (day: number, rent: number) => monthEnd(profileDemo, h, current('2026-04', day, { rentUtilities: rent })).drifts;
    // Spread = max(sd 0, 10% × 1,720 = 172, $25) = 172.
    expect(on(1, 1_720)).toEqual([]);   // paid on the 1st: projection = usual, not × 30
    expect(on(1, 0)).toEqual([]);       // not paid yet: usual
    expect(on(20, 1_890)).toEqual([]);  // +170
    expect(on(5, 1_900)).toEqual([{ category: 'rentUtilities', delta: 180 }]); // +180, already spent
  });

  it('uses the last 3 full months before the current one, sorted, ignoring later months', () => {
    const h = [
      month('2026-04', { groceries: 9_999 }), // the current month: not history
      month('2026-05', { groceries: 9_999 }), // after it
      month('2026-03', { groceries: 300 }),
      month('2025-12', { groceries: 9_999 }), // older than the last 3
      month('2026-01', { groceries: 100 }),
      month('2026-02', { groceries: 200 }),
    ];
    const r = monthEnd(profileDemo, h, current('2026-04', 30, { groceries: 200 }));
    expect(r.vsAverage).toBeCloseTo(0, 9); // average of Jan–Mar = 200 = projected
    expect(r.drifts).toEqual([]);
  });

  it('orders drifts by size', () => {
    const h = steady({ groceries: 500, eatingOut: 200, other: 300 });
    const r = monthEnd(profileDemo, h, current('2026-04', 30, { groceries: 600, eatingOut: 500, other: 0 }));
    expect(r.drifts.map((d) => d.category)).toEqual(['eatingOut', 'other', 'groceries']);
  });

  it('does not mutate its inputs', () => {
    const h = steady({ groceries: 100 });
    const cur = current('2026-04', 15, { groceries: 300 });
    const before = JSON.stringify([h, cur]);
    monthEnd(profileDemo, h, cur);
    expect(JSON.stringify([h, cur])).toBe(before);
  });

  it('rejects malformed input with a RangeError', () => {
    const h = steady({ groceries: 100 });
    expect(() => monthEnd(profileDemo, h, current('2026-4', 1, {}))).toThrow(RangeError);
    expect(() => monthEnd(profileDemo, h, current('2026-13', 1, {}))).toThrow(RangeError);
    expect(() => monthEnd(profileDemo, h, current('2026-04', 0, {}))).toThrow(RangeError);
    expect(() => monthEnd(profileDemo, h, current('2026-04', 31, {}))).toThrow(RangeError);
    expect(() => monthEnd(profileDemo, h, current('2026-04', 2.5, {}))).toThrow(RangeError);
    expect(() => monthEnd(profileDemo, h, current('2026-04', 2, { groceries: Number.NaN }))).toThrow(RangeError);
    expect(() => monthEnd(profileDemo, [...h, month('2026-03', {})], current('2026-04', 2, {}))).toThrow(RangeError);
    expect(() => monthEnd(profileDemo, [month('March', {})])).toThrow(RangeError);
    expect(() => monthEnd(profileDemo, [month('2026-01', { other: Number.POSITIVE_INFINITY })])).toThrow(RangeError);
  });
});

// ----- the demo statement ---------------------------------------------------------------------
// statement.sample.csv (Jul 1 – Nov 12 2026) categorized by merchant prefix, the way the T7
// categorizer is meant to; income, transfers to savings and one-off purchases left out.

const MERCHANTS: [prefix: string, category: CostCategory | null][] = [
  ['OAKWOOD APTS', 'rentUtilities'], ['TXU ENERGY', 'rentUtilities'], ['ATMOS ENERGY', 'rentUtilities'], ['SPECTRUM', 'rentUtilities'],
  ['EXXON', 'car'], ['SHELL OIL', 'car'], ['QT ', 'car'], ['PROGRESSIVE', 'car'],
  ['ALDI', 'groceries'], ['KROGER', 'groceries'], ['TOM THUMB', 'groceries'], ['WALMART', 'groceries'],
  ['WHATABURGER', 'eatingOut'], ['TACO BELL', 'eatingOut'], ['STARBUCKS', 'eatingOut'], ['UBER', 'eatingOut'],
  ['DOORDASH', 'eatingOut'], ['CHIPOTLE', 'eatingOut'], ['HOPDODDY', 'eatingOut'],
  ['SPOTIFY', 'subscriptions'], ['NETFLIX', 'subscriptions'], ['APPLE.COM/BILL', 'subscriptions'],
  ['PLANET FITNESS', 'subscriptions'], ['AMAZON PRIME', 'subscriptions'],
  ['TOYOTA FINANCIAL', 'debtPayments'], ['CAPITAL ONE', 'debtPayments'],
  ['TARGET', 'other'], ['CVS', 'other'], ['AMAZON MKTPL', 'other'], ['ATM WITHDRAWAL', 'other'], ['Zelle payment to', 'other'],
  ['THE HOME DEPOT', null], ['DFW ANIMAL HOSPITAL', null], // one-offs
  ['ACME LOGISTICS', null], ['Online Transfer to SAV', null], ['VENMO', null], ['Zelle payment from', null], // not spending
];

function demoStatementMonths(): { months: Map<string, Record<CostCategory, Money>>; lastDay: Map<string, number> } {
  const months = new Map<string, Record<CostCategory, Money>>();
  const lastDay = new Map<string, number>();
  for (const line of statementSampleCsv.trim().split('\n').slice(1)) {
    const [, date, description, amount] = line.split(',');
    const [mm, dd, yyyy] = date!.split('/');
    const key = `${yyyy}-${mm}`;
    const match = MERCHANTS.find(([prefix]) => description!.startsWith(prefix));
    if (!match) throw new Error(`Uncategorized test line: ${description}`);
    lastDay.set(key, Math.max(lastDay.get(key) ?? 0, Number(dd)));
    const category = match[1];
    if (!category) continue;
    const t = months.get(key) ?? totals();
    t[category] += -Number(amount);
    months.set(key, t);
  }
  return { months, lastDay };
}

describe('monthEnd on the demo statement (Nov 14, 2026)', () => {
  const { months } = demoStatementMonths();
  const history = ['2026-07', '2026-08', '2026-09', '2026-10'].map((m) => ({ month: m, totals: months.get(m)!, oneOffs: [] }));
  const nov = months.get('2026-11')!;

  it('rent paid on the 1st and car insurance on the 5th are not drift', () => {
    expect(nov.rentUtilities).toBeGreaterThan(1_720); // rent + utilities already paid
    const r = monthEnd(profileDemo, history, { month: '2026-11', day: 14, totals: nov });
    expect(r.vsAverage).not.toBeNull();
    const flagged = r.drifts.map((d) => d.category);
    expect(flagged).not.toContain('rentUtilities');
    expect(flagged).not.toContain('car');
    expect(flagged).not.toContain('subscriptions');
    // The textbook linear projection would have called rent + utilities about $2,000 over.
    expect((nov.rentUtilities / 14) * 30 - 1_880).toBeGreaterThan(1_500);
  });

  it('a real overspend still flags: a $600 rent increase and $300 more eating out', () => {
    const over = { ...nov, rentUtilities: nov.rentUtilities + 600, eatingOut: nov.eatingOut + 300 };
    const r = monthEnd(profileDemo, history, { month: '2026-11', day: 14, totals: over });
    const rent = r.drifts.find((d) => d.category === 'rentUtilities');
    const eating = r.drifts.find((d) => d.category === 'eatingOut');
    expect(rent?.delta).toBeGreaterThan(500);
    expect(eating?.delta).toBeGreaterThan(300);
  });
});
