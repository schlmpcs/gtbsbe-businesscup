import { describe, expect, it } from 'vitest';
import { cloneProfileDemo, togetherPartnerSample } from '@lifeguessr/data/fixtures';
import { COST_CATEGORIES, TOGETHER_DEBTS_MAX, TOGETHER_MONEY_MAX, TogetherPartnerSchema, type Profile } from '@lifeguessr/types';
import { forecast } from './forecast';
import { goalStatus } from './goal';
import {
  combineProfiles, fairSplit, householdMonth, partnerOfProfile, profileOfPartner, sharedBills, SHARED_BILL_CATEGORIES,
} from './together';

const a = (): Profile => cloneProfileDemo();
const b = (): Profile => profileOfPartner(structuredClone(togetherPartnerSample) as typeof togetherPartnerSample);

function measured(p: Profile): Profile {
  for (const f of ['age', 'cash', 'retirement', 'retirementShare', 'takeHomePay'] as const) p[f].isEstimate = false;
  for (const v of Object.values(p.spending)) v.isEstimate = false;
  for (const d of p.debts) d.minPayment.isEstimate = false;
  return p;
}

describe('combineProfiles', () => {
  it('sums pay, every spending category, cash and retirement', () => {
    const x = a();
    const y = b();
    const c = combineProfiles(x, y);
    expect(c.takeHomePay.value).toBe(5200 + 3800);
    for (const cat of COST_CATEGORIES) expect(c.spending[cat].value).toBe(x.spending[cat].value + y.spending[cat].value);
    expect(c.cash.value).toBe(3800 + 5200);
    expect(c.retirement.value).toBe(14500 + 9000);
  });

  it('concatenates debts with unique ids, even when both sides use the same id or one side repeats one', () => {
    const x = a();
    const y = a();
    y.debts.push({ ...y.debts[0]!, minPayment: { ...y.debts[0]!.minPayment } });
    const c = combineProfiles(x, y);
    expect(c.debts).toHaveLength(x.debts.length + y.debts.length);
    expect(new Set(c.debts.map((d) => d.id)).size).toBe(c.debts.length);
    expect(c.debts.map((d) => d.balance)).toEqual([...x.debts, ...y.debts].map((d) => d.balance));
  });

  it('keeps a value an estimate when either side is one, and measured when both are', () => {
    const x = measured(a());
    const y = measured(b());
    y.spending.groceries.isEstimate = true;
    y.cash.isEstimate = true;
    const c = combineProfiles(x, y);
    expect(c.spending.groceries.isEstimate).toBe(true);
    expect(c.cash.isEstimate).toBe(true);
    expect(c.spending.rentUtilities.isEstimate).toBe(false);
    expect(c.takeHomePay.isEstimate).toBe(false);
    expect(combineProfiles(y, x).spending.groceries.isEstimate).toBe(true);
  });

  it('weights retirementShare by take-home pay, and averages it when neither earns', () => {
    const x = a();
    const y = b();
    x.retirementShare.value = 0.2;
    y.retirementShare.value = 0.05;
    const c = combineProfiles(x, y);
    expect(c.retirementShare.value).toBeCloseTo((0.2 * 5200 + 0.05 * 3800) / 9000, 12);
    x.takeHomePay.value = 0;
    y.takeHomePay.value = 0;
    expect(combineProfiles(x, y).retirementShare.value).toBeCloseTo(0.125, 12);
  });

  it('does not touch its inputs and drops personal moves', () => {
    const x = a();
    x.committedMoveId = 'm1';
    x.doneMoveIds = ['m0'];
    const before = structuredClone(x);
    const c = combineProfiles(x, b());
    expect(x).toEqual(before);
    expect(c.committedMoveId).toBeUndefined();
    expect(c.doneMoveIds).toEqual([]);
    c.debts[0]!.minPayment.value = 1;
    expect(x.debts[0]!.minPayment.value).toBe(before.debts[0]!.minPayment.value);
  });

  it('feeds forecast() and goalStatus(): the household beats either partner alone with no debts', () => {
    const x = measured(a());
    x.debts = [];
    const y = measured(b());
    y.debts = [];
    const c = combineProfiles(x, y);
    const both = forecast(c).in10y.mid;
    expect(both).toBeGreaterThan(forecast(x).in10y.mid);
    expect(both).toBeGreaterThan(forecast(y).in10y.mid);
    expect(goalStatus(c, { target: 1, years: 5 }).verdict).toBe('onTrack');
  });
});

describe('householdMonth', () => {
  it('is pay minus spending (without the informational debtPayments line) minus debt payments', () => {
    const p = a();
    p.spending.debtPayments.value = 999; // informational: never counted twice
    const m = householdMonth(p);
    const spending = 1950 + 310 + 0 + 520 + 340 + 85 + 450;
    expect(m.spending).toBeCloseTo(spending, 9);
    expect(m.debtPayments).toBeCloseTo(193.92 + 412, 9);
    expect(m.surplus).toBeCloseTo(5200 - spending - 193.92 - 412, 9);
    expect(m.isEstimate).toBe(true);
    expect(householdMonth(measured(a())).isEstimate).toBe(false);
  });

  it('adds extra payments and skips paid-off debts', () => {
    const p = measured(a());
    p.debts[0]!.extraPayment = 100;
    p.debts[1]!.balance = 0;
    expect(householdMonth(p).debtPayments).toBeCloseTo(193.92 + 100, 9);
  });
});

describe('sharedBills and fairSplit', () => {
  it('adds the shared categories of both partners', () => {
    const s = sharedBills(a(), b());
    expect(SHARED_BILL_CATEGORIES).toEqual(['rentUtilities', 'groceries', 'childcare']);
    expect(s.byCategory).toEqual({ rentUtilities: 3050, groceries: 900, childcare: 0 });
    expect(s.total).toBe(3950);
    expect(s.isEstimate).toBe(true);
  });

  it('splits in proportion to income and compares with 50/50', () => {
    const f = fairSplit(6000, 4000, 2200);
    expect(f.byIncome).toEqual({ a: 1320, b: 880, shareA: 0.6, basis: 'income' });
    expect(f.even).toEqual({ a: 1100, b: 1100 });
    expect(f.aVsEven).toBeCloseTo(220, 9);
    expect(f.byIncome.a + f.byIncome.b).toBeCloseTo(f.total, 9);
  });

  it('falls back to 50/50 when neither has income, and treats negatives as zero', () => {
    expect(fairSplit(0, 0, 1000).byIncome).toEqual({ a: 500, b: 500, shareA: 0.5, basis: 'even' });
    expect(fairSplit(-10, 1000, 1000).byIncome.a).toBe(0);
    expect(fairSplit(1, 1, -5).total).toBe(0);
    expect(() => fairSplit(Number.NaN, 1, 1)).toThrow(RangeError);
  });
});

describe('partnerOfProfile / profileOfPartner', () => {
  it('keeps only the plan fields, renames debts and passes the schema', () => {
    const p = a();
    p.debts[0]!.extraPayment = 50;
    const partner = partnerOfProfile(p, '  Alex ');
    expect(TogetherPartnerSchema.parse(partner)).toEqual(partner);
    expect(partner.nickname).toBe('Alex');
    expect(partner).not.toHaveProperty('zip');
    expect(partner).not.toHaveProperty('age');
    expect(partner.debts.map((d) => d.id)).toEqual(['d1', 'd2']);
    expect(partner.debts[0]).not.toHaveProperty('extraPayment');
    expect(partnerOfProfile(p)).not.toHaveProperty('nickname');
  });

  it('clamps amounts and debt count to the plan bounds', () => {
    const p = a();
    p.takeHomePay.value = TOGETHER_MONEY_MAX * 3;
    p.debts = Array.from({ length: TOGETHER_DEBTS_MAX + 5 }, (_, i) => ({
      id: `x${i}`, kind: 'card' as const, balance: i + 1, apr: 0.2, minPayment: { value: 25, isEstimate: true },
    }));
    const partner = partnerOfProfile(p);
    expect(partner.takeHomePay.value).toBe(TOGETHER_MONEY_MAX);
    expect(partner.debts).toHaveLength(TOGETHER_DEBTS_MAX);
    expect(partner.debts[0]!.balance).toBe(TOGETHER_DEBTS_MAX + 5);
    expect(TogetherPartnerSchema.safeParse(partner).success).toBe(true);
  });

  it('round-trips the money fields; the age it fills in is tagged as an estimate', () => {
    const p = a();
    const back = profileOfPartner(partnerOfProfile(p));
    expect(back.takeHomePay).toEqual(p.takeHomePay);
    expect(back.spending).toEqual(p.spending);
    expect(back.cash).toEqual(p.cash);
    expect(back.age.isEstimate).toBe(true);
    expect(forecast(back).in10y.mid).toBeCloseTo(forecast({ ...p, zip: undefined }).in10y.mid, 6);
  });
});
