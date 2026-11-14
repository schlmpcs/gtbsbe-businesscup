// Life events (what-if timeline). Hand-checked numbers use zero rates (no inflation, yield, returns or
// card interest) and a profile whose surplus stays positive, so net worth is plain arithmetic.
import { describe, expect, it } from 'vitest';
import { areaByZip, areaDataSample, profileDemo } from '@lifeguessr/data/fixtures';
import type { AreaData, CostCategory, LifeEvent, Profile } from '@lifeguessr/types';
import { COST_CATEGORIES } from '@lifeguessr/types';
import { kidGroceryFactor, monthlyGallons, otherPerKidMonthly } from './assumptions';
import { forecast } from './forecast';
import { kidAgeAt, lifeEvents } from './lifeEvents';
import { type ForecastRates, simulate } from './simulate';

const ZERO: Partial<ForecastRates> = { inflationAnnual: 0, cashYieldAnnual: 0, returnAnnualNominal: 0, cardApr: 0 };

const mid = areaByZip('75206');   // Dallas mid: 2BR $2,230, groceries $367.95, infant $840.67
const cheap = areaByZip('75216'); // Dallas cheap: 2BR $1,300, same county prices
/** A made-up area with its own childcare and groceries, so ordering matters. */
const other: AreaData = {
  ...cheap,
  zip: '99999',
  metro: 'Elsewhere, ZZ',
  childcareMonthly: { infant: 500, toddler: 400, preschool: 300, schoolAge: 200, source: { name: 'Test childcare', year: 2026 } },
  groceriesPerAdult: { value: 300, source: { name: 'Test groceries', year: 2026 } },
};
const areas = [...areaDataSample, other];

function profile(o: { pay?: number; spend?: Partial<Record<CostCategory, number>>; cash?: number } = {}): Profile {
  const spending = Object.fromEntries(
    COST_CATEGORIES.map((c) => [c, { value: o.spend?.[c] ?? 0, isEstimate: false }]),
  ) as Profile['spending'];
  return {
    age: { value: 30, isEstimate: false },
    takeHomePay: { value: o.pay ?? 6000, isEstimate: false },
    spending: { ...spending, other: { value: o.spend?.other ?? 2000, isEstimate: false } },
    cash: { value: o.cash ?? 50_000, isEstimate: false },
    retirement: { value: 0, isEstimate: false },
    retirementShare: { value: 0, isEstimate: false },
    debts: [],
    zip: '75206',
    doneMoveIds: [],
  };
}

const opts = { home: mid, areas, rates: ZERO };

/** Childcare a child costs over months [from, to) of its life in `area`. */
function childcareOver(area: AreaData, from: number, to: number): number {
  let total = 0;
  for (let age = from; age < to; age++) total += area.childcareMonthly![kidAgeAt(age)];
  return total;
}
const kidFixed = (area: AreaData) => kidGroceryFactor.value * area.groceriesPerAdult.value + otherPerKidMonthly.value;

describe('kidAgeAt', () => {
  it('follows the NDCP age groups', () => {
    expect([0, 23, 24, 35, 36, 59, 60, 119].map(kidAgeAt)).toEqual([
      'infant', 'infant', 'toddler', 'toddler', 'preschool', 'preschool', 'schoolAge', 'schoolAge',
    ]);
  });
});

describe('lifeEvents', () => {
  it('without events, with = base and the delta is 0', () => {
    const r = lifeEvents(profile(), [], opts);
    expect(r.delta).toBe(0);
    expect(r.with).toEqual(r.base);
    expect(r.events).toEqual([]);
    expect(r.base.in10y.mid).toBeCloseTo(50_000 + 4000 * 120, 6);
  });

  it('base is the ordinary forecast in today’s dollars', () => {
    const r = lifeEvents(profileDemo, [], { home: mid, areas: areaDataSample });
    expect(r.todaysDollars).toBe(true);
    expect(r.base).toEqual(forecast(profileDemo, 10, { todaysDollars: true }));
  });

  it('a baby now: childcare by age, groceries and other kid costs for 10 years', () => {
    const r = lifeEvents(profile(), [{ id: 'b', kind: 'baby', startYear: 0 }], opts);
    const cost = childcareOver(mid, 0, 120) + kidFixed(mid) * 120;
    // 24 × 840.67 infant, then toddler, preschool and school-age prices (hand-checked shape).
    expect(r.delta).toBeCloseTo(-cost, 6);
    const e = r.events[0]!;
    expect(e.monthly).toBeCloseTo(840.67 + 0.7 * 367.95 + 150, 6);
    expect(e.lines.map((l) => l.item)).toEqual(['childcare', 'kidGroceries', 'kidOther']);
    expect(e.lines[0]!.source).toEqual(mid.childcareMonthly!.source);
    expect(e.isEstimate).toBe(true);
    expect(e.effect10yAlone).toBeCloseTo(r.delta, 6);
  });

  it('a baby in year 5 costs only its first 5 years', () => {
    const r = lifeEvents(profile(), [{ id: 'b', kind: 'baby', startYear: 5 }], opts);
    expect(r.delta).toBeCloseTo(-(childcareOver(mid, 0, 60) + kidFixed(mid) * 60), 6);
    expect(r.events[0]!.startMonth).toBe(60);
    const r0 = lifeEvents(profile(), [{ id: 'b', kind: 'baby', startYear: 0 }], opts);
    expect(r.delta).toBeGreaterThan(r0.delta);
    // Same path as the base until the baby arrives.
    expect(r.with.points[60]!.mid).toBeCloseTo(r.base.points[60]!.mid, 6);
    expect(r.with.points[61]!.mid).toBeLessThan(r.base.points[61]!.mid);
  });

  it('a move to a cheaper area is positive: your rent scales by the HUD rent ratio', () => {
    const p = profile({ spend: { rentUtilities: 2000, groceries: 600 } });
    const r = lifeEvents(p, [{ id: 'm', kind: 'move', startYear: 0, toZip: '75216' }], opts);
    const rentChange = 2000 * (1300 / 2230 - 1);
    const e = r.events[0]!;
    expect(e.toMetro).toBe(cheap.metro);
    expect(e.lines.find((l) => l.item === 'rent')!.monthly).toBeCloseTo(rentChange, 9);
    expect(e.lines.find((l) => l.item === 'groceries')!.monthly).toBeCloseTo(0, 9); // same county price
    expect(e.lines.some((l) => l.item === 'carInsurance')).toBe(false);             // no car
    expect(r.delta).toBeGreaterThan(0);
    expect(r.delta).toBeCloseTo(-rentChange * 120, 6);
  });

  it('a move to a pricier area costs money, and moving within the same area changes nothing', () => {
    const p = profile({ spend: { rentUtilities: 2000 } });
    expect(lifeEvents(p, [{ id: 'm', kind: 'move', startYear: 0, toZip: '75205' }], opts).delta).toBeLessThan(0);
    expect(lifeEvents(p, [{ id: 'm', kind: 'move', startYear: 0, toZip: '75206' }], opts).delta).toBeCloseTo(0, 9);
  });

  it('a move with a car changes insurance and fuel by the area difference', () => {
    const p = profile({ spend: { rentUtilities: 2000, groceries: 600, car: 300 } });
    const r = lifeEvents(p, [{ id: 'm', kind: 'move', startYear: 0, toZip: '99999' }], opts);
    const lines = r.events[0]!.lines;
    expect(lines.find((l) => l.item === 'groceries')!.monthly).toBeCloseTo(600 * (300 / 367.95 - 1), 9);
    expect(lines.find((l) => l.item === 'carInsurance')!.monthly).toBeCloseTo(0, 9);
    expect(lines.find((l) => l.item === 'fuel')!.monthly).toBeCloseTo(0, 9);
  });

  it('a move without home area data uses the new area’s HUD rent', () => {
    const p = profile({ spend: { rentUtilities: 2000 } });
    const r = lifeEvents(p, [{ id: 'm', kind: 'move', startYear: 0, toZip: '75216', bedrooms: 1 }], { ...opts, home: null });
    expect(r.events[0]!.lines).toHaveLength(1);
    expect(r.events[0]!.monthly).toBeCloseTo(cheap.rentByBedrooms[1].value - 2000, 9);
  });

  it('a car: down payment once, the loan payment for its term, insurance and fuel every month', () => {
    const car: LifeEvent = { id: 'c', kind: 'car', startYear: 0, price: 20_000, downPayment: 5_000, apr: 0, termMonths: 60 };
    const r = lifeEvents(profile(), [car], opts);
    const running = 150 + 3.408 * monthlyGallons.value;
    const e = r.events[0]!;
    expect(e.oneOff).toBe(5_000);
    expect(e.lines.map((l) => l.item)).toEqual(['carLoan', 'carInsurance', 'fuel']);
    expect(e.lines[0]!.monthly).toBeCloseTo(250, 9); // 15,000 / 60 at 0%
    expect(e.monthly).toBeCloseTo(250 + running, 9);
    expect(r.delta).toBeCloseTo(-(20_000 + running * 120), 6);
  });

  it('a car loan at 6.9% for 36 months pays the engine’s amortized payment', () => {
    const car: LifeEvent = { id: 'c', kind: 'car', startYear: 2, price: 33_000, downPayment: 5_000, apr: 0.069, termMonths: 36 };
    const e = lifeEvents(profile(), [car], opts).events[0]!;
    expect(e.lines[0]!.monthly).toBeCloseTo(863.28, 2);
  });

  it('a raise by an amount or by a share of take-home pay', () => {
    const a = lifeEvents(profile(), [{ id: 'r', kind: 'raise', startYear: 2, change: { by: 'amount', amount: 500 } }], opts);
    expect(a.delta).toBeCloseTo(500 * 96, 6);
    expect(a.events[0]!.monthly).toBe(-500);
    const b = lifeEvents(profile(), [{ id: 'r', kind: 'raise', startYear: 0, change: { by: 'rate', rate: 0.1 } }], opts);
    expect(b.delta).toBeCloseTo(600 * 120, 6);
    const cut = lifeEvents(profile(), [{ id: 'r', kind: 'raise', startYear: 0, change: { by: 'amount', amount: -1000 } }], opts);
    expect(cut.delta).toBeCloseTo(-1000 * 120, 6);
  });

  it('a one-off purchase comes out of cash once', () => {
    const r = lifeEvents(profile(), [{ id: 'w', kind: 'purchase', startYear: 3, amount: 25_000 }], opts);
    expect(r.delta).toBeCloseTo(-25_000, 6);
    expect(r.events[0]!).toMatchObject({ oneOff: 25_000, monthly: 0, lines: [] });
    expect(r.with.points[36]!.mid).toBeCloseTo(r.base.points[36]!.mid, 6);
    expect(r.with.points[37]!.mid).toBeCloseTo(r.base.points[37]!.mid - 25_000, 6);
  });

  it('an event in year 10 is listed but has no effect inside the 10 years', () => {
    const r = lifeEvents(profile(), [{ id: 'b', kind: 'baby', startYear: 10 }], opts);
    expect(r.delta).toBe(0);
    expect(r.events[0]!.monthly).toBeGreaterThan(0);
  });

  it('ordering: a baby is priced in the area you live in when it arrives', () => {
    const p = profile({ spend: { rentUtilities: 2000 } });
    const baby: LifeEvent = { id: 'b', kind: 'baby', startYear: 2 };
    const moveFirst = lifeEvents(p, [{ id: 'm', kind: 'move', startYear: 1, toZip: '99999' }, baby], opts);
    const moveLater = lifeEvents(p, [{ id: 'm', kind: 'move', startYear: 5, toZip: '99999' }, baby], opts);
    expect(moveFirst.events[1]!.lines[0]!.monthly).toBe(500);
    expect(moveLater.events[1]!.lines[0]!.monthly).toBe(840.67);
    // Hand-checked: the baby's costs follow the area month by month.
    const babyCost = (moveMonth: number) => {
      let total = 0;
      for (let t = 24; t < 120; t++) {
        const area = t >= moveMonth ? other : mid;
        total += area.childcareMonthly![kidAgeAt(t - 24)] + kidFixed(area);
      }
      return total;
    };
    const rentSaving = (moveMonth: number) => -2000 * (cheap.rentByBedrooms[2].value / 2230 - 1) * (120 - moveMonth);
    expect(moveFirst.delta).toBeCloseTo(rentSaving(12) - babyCost(12), 6);
    expect(moveLater.delta).toBeCloseTo(rentSaving(60) - babyCost(60), 6);
  });

  it('a later move replaces an earlier one; the order of the list does not matter otherwise', () => {
    const p = profile({ spend: { rentUtilities: 2000 } });
    const events: LifeEvent[] = [
      { id: 'm1', kind: 'move', startYear: 1, toZip: '75216' },
      { id: 'm2', kind: 'move', startYear: 4, toZip: '75205' },
      { id: 'b', kind: 'baby', startYear: 2 },
    ];
    const r = lifeEvents(p, events, opts);
    const reversed = lifeEvents(p, [...events].reverse(), opts);
    expect(reversed.delta).toBeCloseTo(r.delta, 9);
    const rent = (area: AreaData) => 2000 * (area.rentByBedrooms[2].value / 2230 - 1);
    const babyCost = childcareOver(mid, 0, 96) + kidFixed(mid) * 96; // Dallas county prices throughout
    const expected = -(rent(cheap) * 36 + rent(areaByZip('75205')) * 72) - babyCost;
    expect(r.delta).toBeCloseTo(expected, 6);
  });

  it('effects of independent events add up', () => {
    const events: LifeEvent[] = [
      { id: 'r', kind: 'raise', startYear: 1, change: { by: 'amount', amount: 400 } },
      { id: 'w', kind: 'purchase', startYear: 2, amount: 12_000 },
      { id: 'b', kind: 'baby', startYear: 3 },
    ];
    const r = lifeEvents(profile(), events, opts);
    const sumAlone = r.events.reduce((s, e) => s + e.effect10yAlone, 0);
    expect(r.delta).toBeCloseTo(sumAlone, 6);
  });

  it('is deterministic and does not mutate its inputs (demo profile, real rates)', () => {
    const events: LifeEvent[] = [
      { id: 'b', kind: 'baby', startYear: 1 },
      { id: 'c', kind: 'car', startYear: 3, price: 30_000, downPayment: 3_000, apr: 0.07, termMonths: 60 },
    ];
    const frozen = Object.freeze(events.map((e) => Object.freeze({ ...e })));
    const a = lifeEvents(profileDemo, frozen, { home: mid, areas: areaDataSample });
    const b = lifeEvents(profileDemo, frozen, { home: mid, areas: areaDataSample });
    expect(a).toEqual(b);
    expect(a.delta).toBeLessThan(0);
    expect(a.with.in10y.low).toBeLessThanOrEqual(a.with.in10y.mid);
    expect(a.with.in10y.mid).toBeLessThanOrEqual(a.with.in10y.high);
  });

  it('rejects invalid events', () => {
    const p = profile();
    const bad = (events: LifeEvent[]) => () => lifeEvents(p, events, opts);
    expect(bad([{ id: 'x', kind: 'baby', startYear: 0 }, { id: 'x', kind: 'baby', startYear: 1 }])).toThrow(RangeError);
    expect(bad([{ id: 'x', kind: 'baby', startYear: 11 }])).toThrow(RangeError);
    expect(bad([{ id: 'x', kind: 'baby', startYear: 1.5 }])).toThrow(RangeError);
    expect(bad([{ id: 'x', kind: 'move', startYear: 0, toZip: '00000' }])).toThrow(RangeError);
    expect(bad([{ id: 'x', kind: 'car', startYear: 0, price: 10_000, downPayment: 12_000, apr: 0.05, termMonths: 60 }])).toThrow(RangeError);
    expect(bad([{ id: 'x', kind: 'car', startYear: 0, price: 10_000, downPayment: 0, apr: 0.05, termMonths: 0 }])).toThrow(RangeError);
    expect(bad([{ id: 'x', kind: 'purchase', startYear: 0, amount: -5 }])).toThrow(RangeError);
    expect(bad([{ id: 'x', kind: 'raise', startYear: 0, change: { by: 'amount', amount: Number.NaN } }])).toThrow(RangeError);
  });
});

describe('simulate adjust', () => {
  it('adds month-indexed spending and income changes (today’s dollars)', () => {
    const p = profile({ cash: 0 });
    const spending = Array.from({ length: 12 }, () => 100);
    const income = [0, 0, 50];
    const s = simulate(p, 12, { rates: ZERO, adjust: { spending, income } });
    const plain = simulate(p, 12, { rates: ZERO });
    expect(s.path[12]!.netWorth).toBeCloseTo(plain.path[12]!.netWorth - 1200 + 50, 9);
    expect(s.path[1]!.spending).toBe(2100);
    expect(s.path[3]!.income).toBe(6050);
  });

  it('inflates spending changes like prices', () => {
    const p = profile();
    const s = simulate(p, 13, { rates: { ...ZERO, inflationAnnual: 0.1 }, adjust: { spending: Array(13).fill(100) } });
    expect(s.path[13]!.spending).toBeCloseTo(2100 * 1.1, 9);
  });

  it('rejects non-finite changes', () => {
    expect(() => simulate(profile(), 2, { adjust: { spending: [Number.NaN] } })).toThrow(RangeError);
  });
});
