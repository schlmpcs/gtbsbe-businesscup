import { findArea, getArea, profileDemo } from '@lifeguessr/data';
import { FutureComparisonSchema, type Scenario, type ScenarioChange } from '@lifeguessr/types';
import { describe, expect, it } from 'vitest';
import {
  applyScenario, compareFutures, forecast, goalStatus, inflationAnnualOf, kidGroceryFactor, monthlyGallons,
  otherPerKidMonthly, raiseTakeHomeShare, simulate, takeHomeFromGrossRaise,
} from './index';

const rates = { inflationAnnual: inflationAnnualOf(getArea('75206')) };
const opts = { areaOf: findArea, rates };
const s = (...changes: ScenarioChange[]): Scenario => ({ label: 'test', changes });
const NONE = s();
const car = (amount: number): ScenarioChange => ({
  kind: 'purchase', category: 'car',
  purchase: { label: 'Car', amount, recurring: false, payWith: { loan: { amount, apr: 0.069, termMonths: 60, downPayment: amount * 0.1 } } },
});

describe('applyScenario', () => {
  it('does not change the input profile and an empty scenario is the profile itself', () => {
    const before = JSON.stringify(profileDemo);
    const plan = applyScenario(profileDemo, NONE, opts);
    expect(plan.extra).toEqual([]);
    expect(plan.profile).toEqual(profileDemo);
    applyScenario(profileDemo, s({ kind: 'move', zip: '60618' }, { kind: 'kid', age: 'infant' }), opts);
    expect(JSON.stringify(profileDemo)).toBe(before);
  });

  it('a move re-costs rent by the closest bedroom count, car by insurance and gas, and marks them estimates', () => {
    const from = getArea('75206');
    const to = getArea('60618');
    const { profile } = applyScenario(profileDemo, s({ kind: 'move', zip: '60618' }), opts);
    // $1,950 is closest to the studio rent in 75206.
    expect(profile.spending.rentUtilities.value).toBeCloseTo((1950 * to.rentByBedrooms[0].value) / from.rentByBedrooms[0].value, 6);
    expect(profile.spending.rentUtilities.isEstimate).toBe(true);
    const carDelta = to.carInsuranceMonthly.value - from.carInsuranceMonthly.value
      + monthlyGallons.value * (to.gasPerGallon.value - from.gasPerGallon.value);
    expect(profile.spending.car.value).toBeCloseTo(310 + carDelta, 6);
    expect(profile.zip).toBe('60618');
    expect(profile.takeHomePay).toEqual(profileDemo.takeHomePay); // income stays
  });

  it('a kid adds childcare by age band from the area, kid groceries and other, from inMonths on', () => {
    const area = getArea('75206');
    const { extra } = applyScenario(profileDemo, s({ kind: 'kid', age: 'infant', inMonths: 12 }), opts);
    const infant = extra.find((x) => x.label === 'childcare-infant')!;
    expect(infant.startMonth).toBe(12);
    expect(infant.endMonth).toBe(24);
    expect(infant.amount).toBeCloseTo(area.childcareMonthly!.infant * (1 + rates.inflationAnnual), 6);
    expect(extra.find((x) => x.label === 'childcare-toddler')).toMatchObject({ startMonth: 24, endMonth: 48 });
    expect(extra.find((x) => x.label === 'childcare-schoolAge')).toMatchObject({ startMonth: 72 });
    expect(extra.find((x) => x.label === 'kid-groceries')!.amount)
      .toBeCloseTo(kidGroceryFactor.value * area.groceriesPerAdult.value * (1 + rates.inflationAnnual), 6);
    expect(extra.find((x) => x.label === 'kid-other')!.amount).toBeCloseTo(otherPerKidMonthly.value * (1 + rates.inflationAnnual), 6);
  });

  it('income, rent and payDebt change the profile; payDebt is capped at cash', () => {
    const { profile } = applyScenario(
      profileDemo,
      s({ kind: 'income', monthlyDelta: 500 }, { kind: 'rent', monthly: 1500 }, { kind: 'payDebt', debtKind: 'card' }),
      opts,
    );
    expect(profile.takeHomePay.value).toBe(5700);
    expect(profile.spending.rentUtilities).toEqual({ value: 1500, isEstimate: false });
    expect(profile.cash.value).toBe(0);
    expect(profile.debts.find((d) => d.id === 'card-1')!.balance).toBe(6400 - 3800);
  });

  it('an unknown ZIP throws', () => {
    expect(() => applyScenario(profileDemo, s({ kind: 'move', zip: '99999' }), opts)).toThrow(RangeError);
  });

  it('takeHomeFromGrossRaise uses the named take-home share', () => {
    expect(takeHomeFromGrossRaise(12_000)).toBeCloseTo(12_000 * raiseTakeHomeShare.value / 12, 9);
  });
});

describe('compareFutures', () => {
  const goal = { target: 150_000, years: 10 };

  it('is deterministic and matches its schema', () => {
    const a = compareFutures(profileDemo, s(car(35_000)), s(car(22_000)), { ...opts, goal });
    const b = compareFutures(profileDemo, s(car(35_000)), s(car(22_000)), { ...opts, goal });
    expect(a).toEqual(b);
    expect(FutureComparisonSchema.parse(a)).toBeTruthy();
    expect(a.A.points).toHaveLength(121);
    expect(a.A.yearly.map((p) => p.month)).toEqual([0, 12, 24, 36, 48, 60, 72, 84, 96, 108, 120]);
  });

  it('totals are forecast(): each side is the rules forecast of its plan in today\'s dollars, goal by goalStatus', () => {
    const B = s({ kind: 'move', zip: '60618' }, { kind: 'kid', age: 'toddler', inMonths: 6 });
    const c = compareFutures(profileDemo, NONE, B, { ...opts, goal });
    const plan = applyScenario(profileDemo, B, opts);
    const f = forecast(plan.profile, 10, { todaysDollars: true, rates, extra: plan.extra });
    expect(c.B.points).toEqual(f.points);
    expect(c.B.end).toEqual(f.in10y);
    expect(c.A.end).toEqual(forecast(profileDemo, 10, { todaysDollars: true, rates }).in10y);
    expect(c.base.end).toEqual(c.A.end);
    expect(c.diff).toBeCloseTo(c.B.end.mid - c.A.end.mid, 9);
    expect(c.B.goal).toEqual(goalStatus(plan.profile, goal, { rates, extra: plan.extra }));
    for (const p of c.B.points) {
      expect(p.low).toBeLessThanOrEqual(p.mid);
      expect(p.mid).toBeLessThanOrEqual(p.high);
    }
  });

  it('moving to a pricier ZIP lowers the end value', () => {
    const c = compareFutures(profileDemo, s({ kind: 'move', zip: '75216' }), s({ kind: 'move', zip: '75205' }), opts);
    expect(c.diff).toBeLessThan(0);
    expect(c.decidedBy?.term).toBe('rentUtilities');
  });

  it('adding a kid lowers it, and a kid later beats a kid now', () => {
    const now = compareFutures(profileDemo, NONE, s({ kind: 'kid', age: 'infant' }), opts);
    expect(now.diff).toBeLessThan(0);
    expect(now.B.monthly.find((m) => m.term === 'childcare')!.delta).toBe(getArea('75206').childcareMonthly!.infant);
    const later = compareFutures(profileDemo, s({ kind: 'kid', age: 'infant' }), s({ kind: 'kid', age: 'infant', inMonths: 24 }), opts);
    expect(later.diff).toBeGreaterThan(0);
    expect(later.decidedBy?.term).toBe('childcare');
  });

  it('a cheaper car raises it; the monthly line is the loan payment and decidedBy is the car', () => {
    const c = compareFutures(profileDemo, s(car(35_000)), s(car(22_000)), opts);
    expect(c.diff).toBeGreaterThan(0);
    expect(c.decidedBy).toMatchObject({ term: 'car' });
    expect(c.decidedBy!.gap).toBeGreaterThan(0);
    const a = c.A.monthly.find((m) => m.term === 'car')!.delta;
    const b = c.B.monthly.find((m) => m.term === 'car')!.delta;
    expect(a).toBeGreaterThan(b);
    expect(c.A.afford).toHaveLength(1);
    expect(['fits', 'wait', 'no']).toContain(c.A.afford[0]!.verdict);
  });

  it('a raise raises it; identical scenarios tie with no decidedBy', () => {
    expect(compareFutures(profileDemo, NONE, s({ kind: 'income', monthlyDelta: 700 }), opts).diff).toBeGreaterThan(0);
    const tie = compareFutures(profileDemo, s(car(20_000)), s(car(20_000)), opts);
    expect(tie.diff).toBe(0);
    expect(tie.decidedBy).toBeNull();
  });

  it('a later purchase is priced in that month\'s dollars', () => {
    const later: ScenarioChange = { kind: 'purchase', inMonths: 12, purchase: { label: 'Trip', amount: 3000, recurring: false, payWith: 'cash' } };
    const { extra } = applyScenario(profileDemo, s(later), opts);
    expect(extra[0]).toMatchObject({ startMonth: 12, payOffFromSurplus: true });
    expect(extra[0]!.amount).toBeCloseTo(3000 * (1 + rates.inflationAnnual), 6);
    // The simulation spends it in month 13 (index 12).
    const sim = simulate(profileDemo, 13, { rates, extra });
    expect(sim.path[13]!.purchasesCash).toBeCloseTo(extra[0]!.amount, 6);
  });
});
