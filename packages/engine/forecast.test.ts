// forecast() and applyPatch() (Y2). Fixtures only, never live data, so a data refresh can't move
// the golden snapshot; it changes only when an assumption changes on purpose.
import { describe, expect, it } from 'vitest';
import type { Forecast, Profile, ProfilePatch } from '@lifeguessr/types';
import { areaByZip, cloneProfileDemo, profileDemo } from '@lifeguessr/data/fixtures';
import { applyPatch, forecast } from './forecast';
import { inflationAnnualOf } from './simulate';

/** The demo profile with every estimate flag cleared (as if every field were measured). */
function allMeasured(p: Profile = cloneProfileDemo()): Profile {
  p.age.isEstimate = false;
  p.takeHomePay.isEstimate = false;
  p.cash.isEstimate = false;
  p.retirement.isEstimate = false;
  p.retirementShare.isEstimate = false;
  for (const e of Object.values(p.spending)) e.isEstimate = false;
  for (const d of p.debts) d.minPayment.isEstimate = false;
  return p;
}

const width = (f: Forecast) => f.in10y.high - f.in10y.low;

describe('forecast', () => {
  it('returns months 0..120 and in10y = month 120', () => {
    const f = forecast(profileDemo);
    expect(f.points).toHaveLength(121);
    expect(f.points.map((p) => p.month)).toEqual([...Array(121).keys()]);
    expect(f.in10y).toEqual(f.points[120]);
    expect(f.todaysDollars).toBe(false);
  });

  it('simulates longer horizons and never fewer than 120 months', () => {
    expect(forecast(profileDemo, 20).points).toHaveLength(241);
    expect(forecast(profileDemo, 3).points).toHaveLength(121);
    expect(forecast(profileDemo, 20).in10y).toEqual(forecast(profileDemo).in10y);
  });

  it('month 0 is today’s net worth: cash + retirement − debts', () => {
    const f = forecast(profileDemo);
    expect(f.points[0]!.mid).toBeCloseTo(3800 + 14_500 - 6400 - 17_800, 9);
  });

  it('month 1 of the demo profile, by hand', () => {
    const spending = 1950 + 310 + 0 + 520 + 340 + 85 + 450; // debtPayments excluded
    const cardPayment = 6400 * (0.2436 / 12 + 0.01);          // estimated card minimum: formula
    const surplus = 5200 - spending - cardPayment - 412;
    const cash = 3800 * 1.03 ** (1 / 12) + surplus;            // retirementShare 0 → all to cash
    const retirement = 14_500 * 1.06 ** (1 / 12);
    const card = 6400 + 6400 * (0.2436 / 12) - cardPayment;
    const auto = 17_800 + 17_800 * (0.074 / 12) - 412;
    expect(forecast(profileDemo).points[1]!.mid).toBeCloseTo(cash + retirement - card - auto, 9);
  });

  it('band is zero when nothing is an estimate', () => {
    for (const point of forecast(allMeasured()).points) {
      expect(point.low).toBe(point.mid);
      expect(point.high).toBe(point.mid);
    }
  });

  it('low ≤ mid ≤ high at every point, nominal and in today’s dollars', () => {
    for (const todaysDollars of [false, true]) {
      const f = forecast(profileDemo, 10, { todaysDollars });
      for (const p of f.points) {
        expect(p.low).toBeLessThanOrEqual(p.mid);
        expect(p.mid).toBeLessThanOrEqual(p.high);
      }
      expect(f.in10y.low).toBeLessThan(f.in10y.mid);
      expect(f.in10y.mid).toBeLessThan(f.in10y.high);
    }
  });

  it('the band narrows as estimates are replaced by real inputs', () => {
    const demo = width(forecast(profileDemo));
    const spendingMeasured = cloneProfileDemo();
    for (const e of Object.values(spendingMeasured.spending)) e.isEstimate = false;
    const partial = width(forecast(spendingMeasured));
    expect(partial).toBeLessThan(demo);
    expect(partial).toBeGreaterThan(0);
    expect(width(forecast(allMeasured()))).toBe(0);
  });

  it('today’s dollars divides each point by (1 + inflation)^(month/12)', () => {
    const nominal = forecast(profileDemo);
    const real = forecast(profileDemo, 10, { todaysDollars: true });
    expect(real.todaysDollars).toBe(true);
    expect(real.points[0]).toEqual(nominal.points[0]);
    for (const [m, p] of real.points.entries()) {
      const n = nominal.points[m]!;
      expect(p.mid).toBeCloseTo(n.mid / 1.03 ** (m / 12), 6);
      if (m > 0 && n.mid !== 0) expect(Math.abs(p.mid)).toBeLessThan(Math.abs(n.mid));
    }
    expect(real.in10y.mid).toBeLessThan(nominal.in10y.mid); // the demo ends with positive net worth
    expect(real.in10y.mid).toBeGreaterThan(0);
  });

  it('a purchase lowers the forecast, and more on a card than in cash', () => {
    const base = forecast(profileDemo).in10y.mid;
    const withTv = forecast(profileDemo, 10, {
      extra: [{ label: 'TV', amount: 1500, recurring: false, payWith: 'cash' }],
    }).in10y.mid;
    const withTvOnCard = forecast(profileDemo, 10, {
      extra: [{ label: 'TV', amount: 1500, recurring: false, payWith: 'card' }],
    }).in10y.mid;
    expect(withTv).toBeLessThan(base);
    expect(withTvOnCard).toBeLessThan(withTv); // minimum payments at 24% cost more than cash at 3%
  });

  it('is pure and deterministic: the (frozen) input is not mutated and results repeat', () => {
    const before = cloneProfileDemo();
    const extra = Object.freeze([
      Object.freeze({ label: 'TV', amount: 900, recurring: false as const, payWith: 'card' as const }),
    ]);
    const a = forecast(profileDemo, 10, { extra, todaysDollars: true });
    const b = forecast(profileDemo, 10, { extra, todaysDollars: true });
    expect(a).toEqual(b);
    expect(profileDemo).toEqual(before);
  });

  it('rejects an invalid horizon', () => {
    expect(() => forecast(profileDemo, Number.NaN)).toThrow(RangeError);
    expect(() => forecast(profileDemo, 500)).toThrow(RangeError);
  });

  it('golden snapshot: demo profile + fixture area inflation', () => {
    const inflationAnnual = inflationAnnualOf(areaByZip(profileDemo.zip!));
    const yearly = (f: Forecast) =>
      f.points
        .filter((p) => p.month % 12 === 0)
        .map((p) => ({ month: p.month, low: cents(p.low), mid: cents(p.mid), high: cents(p.high) }));
    expect({
      nominal: yearly(forecast(profileDemo, 10, { rates: { inflationAnnual } })),
      todaysDollars: yearly(forecast(profileDemo, 10, { rates: { inflationAnnual }, todaysDollars: true })),
    }).toMatchSnapshot();
  });
});

const cents = (x: number) => Math.round(x * 100) / 100;

describe('applyPatch', () => {
  it('merges spending, debts by id and retirementShare into a new profile', () => {
    const patch: ProfilePatch = {
      spending: { eatingOut: 272 },
      debts: [{ id: 'card-1', extraPayment: 200 }, { id: 'auto-1', apr: 0.05 }],
      retirementShare: 0.1,
    };
    const next = applyPatch(profileDemo, patch);
    expect(next).not.toBe(profileDemo);
    expect(next.spending.eatingOut).toEqual({ value: 272, isEstimate: true }); // keeps its flag
    expect(next.spending.groceries).toEqual(profileDemo.spending.groceries);
    expect(next.debts[0]).toEqual({ ...profileDemo.debts[0], extraPayment: 200 });
    expect(next.debts[1]).toEqual({ ...profileDemo.debts[1], apr: 0.05 });
    expect(next.retirementShare).toEqual({ value: 0.1, isEstimate: true });
    expect(next.takeHomePay).toEqual(profileDemo.takeHomePay);
    expect(next.zip).toBe(profileDemo.zip);
  });

  it('does not mutate or share structure with the input', () => {
    const before = cloneProfileDemo();
    const next = applyPatch(profileDemo, { spending: { other: 1 }, debts: [{ id: 'card-1', extraPayment: 50 }] });
    expect(profileDemo).toEqual(before);
    next.debts[1]!.balance = 0;
    next.spending.car.value = 0;
    next.doneMoveIds.push('x');
    expect(profileDemo).toEqual(before);
  });

  it('an empty patch gives an equal copy; unknown debt ids are ignored', () => {
    expect(applyPatch(profileDemo, {})).toEqual(profileDemo);
    expect(applyPatch(profileDemo, { debts: [{ id: 'nope', extraPayment: 100 }] })).toEqual(profileDemo);
  });

  it('paying the 24% card faster raises net worth in 10 years', () => {
    const base = forecast(profileDemo).in10y.mid;
    const faster = forecast(applyPatch(profileDemo, { debts: [{ id: 'card-1', extraPayment: 200 }] })).in10y.mid;
    expect(faster).toBeGreaterThan(base);
  });
});
