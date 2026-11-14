// Future life events in the engine: calendar months, and how simulate() applies each kind.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { CostCategory, LifeEvent, Profile } from '@lifeguessr/types';
import { COST_CATEGORIES } from '@lifeguessr/types';
import { areaByZip, cloneProfileDemo, profileDemo } from '@lifeguessr/data/fixtures';
import { estimateSpread } from './assumptions';
import { addMonths, eventStartMonth, withoutEvents } from './events';
import { canAfford } from './afford';
import { applyPatch, cloneProfile, forecast } from './forecast';
import { goalStatus } from './goal';
import { rankMoves } from './moves';
import { type ForecastRates, hasEstimates, inflationAnnualOf, simulate } from './simulate';

/** No growth, no yield, no returns: every result is plain arithmetic. */
const ZERO: Partial<ForecastRates> = { inflationAnnual: 0, cashYieldAnnual: 0, returnAnnualNominal: 0 };
const AS_OF = '2026-11';

/** $4,000 take-home, $1,000 of `other` spending, $500 rent, nothing estimated; `asOf` = Nov 2026. */
function profile(events: LifeEvent[] = [], o: { share?: number; cash?: number } = {}): Profile {
  const spending = Object.fromEntries(
    COST_CATEGORIES.map((c) => [c, { value: c === 'other' ? 1_000 : c === 'rentUtilities' ? 500 : 0, isEstimate: false }]),
  ) as Record<CostCategory, { value: number; isEstimate: boolean }>;
  return {
    age: { value: 30, isEstimate: false },
    takeHomePay: { value: 4_000, isEstimate: false },
    spending,
    cash: { value: o.cash ?? 10_000, isEstimate: false },
    retirement: { value: 0, isEstimate: false },
    retirementShare: { value: o.share ?? 0, isEstimate: false },
    debts: [],
    doneMoveIds: [],
    events,
    asOf: AS_OF,
  };
}

const pay = (month: string, value: number, isEstimate = false, id = `pay-${month}-${value}`): LifeEvent =>
  ({ id, kind: 'pay', month, takeHomePay: { value, isEstimate } });
const spend = (month: string, category: Exclude<CostCategory, 'debtPayments'>, value: number, isEstimate = false): LifeEvent =>
  ({ id: `sp-${month}-${category}-${value}`, kind: 'spending', month, category, monthly: { value, isEstimate } });
const oneOff = (month: string, amount: number, direction: 'cost' | 'income'): LifeEvent =>
  ({ id: `oo-${month}-${amount}`, kind: 'oneOff', month, amount, direction });

/** path[m] is the end of month m, whose step is t = m − 1: an event starting at t first shows in path[t + 1]. */
const incomes = (p: Profile, months = 24, opts = {}) => simulate(p, months, { rates: ZERO, ...opts }).path.map((s) => s.income);
const spendings = (p: Profile, months = 24, opts = {}) => simulate(p, months, { rates: ZERO, ...opts }).path.map((s) => s.spending);

describe('calendar months', () => {
  it('eventStartMonth counts whole months from asOf, across year ends', () => {
    expect(eventStartMonth('2026-11', '2026-12')).toBe(1);
    expect(eventStartMonth('2026-11', '2027-01')).toBe(2);
    expect(eventStartMonth('2026-12', '2027-01')).toBe(1);
    expect(eventStartMonth('2026-01', '2026-12')).toBe(11);
    expect(eventStartMonth('2026-11', '2028-03')).toBe(16);
    expect(eventStartMonth('2026-11', '2056-11')).toBe(360);
  });

  it('clamps a month at or before asOf to 0 (it has already started)', () => {
    expect(eventStartMonth('2026-11', '2026-11')).toBe(0);
    expect(eventStartMonth('2026-11', '2026-10')).toBe(0);
    expect(eventStartMonth('2027-01', '2026-12')).toBe(0);
  });

  it('rejects anything that is not YYYY-MM', () => {
    for (const bad of ['2026-13', '2026-1', '26-11', '2026-00', '2026/11', '']) {
      expect(() => eventStartMonth(bad, '2027-01')).toThrow(RangeError);
      expect(() => eventStartMonth('2026-11', bad)).toThrow(RangeError);
    }
  });

  it('addMonths moves across year ends both ways and is the inverse of eventStartMonth', () => {
    expect(addMonths('2026-11', 0)).toBe('2026-11');
    expect(addMonths('2026-11', 1)).toBe('2026-12');
    expect(addMonths('2026-11', 2)).toBe('2027-01');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2027-01', -1)).toBe('2026-12');
    expect(addMonths('2026-11', 360)).toBe('2056-11');
    expect(addMonths('0999-12', 1)).toBe('1000-01');
    for (let n = 0; n < 40; n++) expect(eventStartMonth('2026-11', addMonths('2026-11', n))).toBe(n);
    expect(() => addMonths('2026-11', 1.5)).toThrow(RangeError);
    expect(() => addMonths('2026-13', 1)).toThrow(RangeError);
    expect(() => addMonths('0000-01', -1)).toThrow(RangeError);
  });
});

describe('withoutEvents', () => {
  it('drops events and asOf and leaves the profile alone', () => {
    const p = profile([pay('2027-02', 5_000)]);
    const before = cloneProfile(p);
    const q = withoutEvents(p);
    expect(q).not.toHaveProperty('events');
    expect(q).not.toHaveProperty('asOf');
    const { events: _e, asOf: _a, ...rest } = p;
    expect(q).toEqual(rest);
    expect(p).toEqual(before);
  });
});

describe('simulate: no events is today, bit for bit', () => {
  // sha256 of the demo profile's low/mid/high paths (360 months, area inflation, one cash purchase),
  // taken from simulate() before events existed.
  const BEFORE_EVENTS = 'ebac3cb9490181a21da5ac80400cb20c61fb50fac13fe6c61db1d7f895952bcb';
  const runs = (p: Profile) => {
    const rates = { inflationAnnual: inflationAnnualOf(areaByZip(profileDemo.zip!)) };
    return (['low', 'mid', 'high'] as const).map((scenario) => simulate(p, 360, {
      rates, scenario, extra: [{ label: 'car', amount: 9_000, recurring: false, payWith: 'cash', startMonth: 14 }],
    }));
  };
  const hash = (p: Profile) => createHash('sha256').update(JSON.stringify(runs(p))).digest('hex');

  it('the demo profile (no events) simulates exactly as before', () => {
    expect(hash(profileDemo)).toBe(BEFORE_EVENTS);
  });

  it('an empty list, with or without asOf, changes nothing', () => {
    expect(hash({ ...cloneProfileDemo(), events: [] })).toBe(BEFORE_EVENTS);
    expect(hash({ ...cloneProfileDemo(), events: [], asOf: AS_OF })).toBe(BEFORE_EVENTS);
  });

  it('an event past the horizon changes nothing within it', () => {
    const late = { ...cloneProfileDemo(), asOf: AS_OF, events: [pay('2056-12', 9_000), oneOff('2060-01', 50_000, 'cost')] };
    expect(hash(late)).toBe(BEFORE_EVENTS);
  });

  it('without asOf, events are refused (RangeError) rather than guessed', () => {
    const { asOf: _a, ...noAsOf } = profile([pay('2027-02', 5_000)]);
    expect(() => simulate(noAsOf, 12)).toThrow(RangeError);
    expect(() => forecast(noAsOf)).toThrow(RangeError);
    expect(() => simulate({ ...noAsOf, events: [] }, 12)).not.toThrow();
  });
});

describe('simulate: pay events', () => {
  it('take-home becomes the event value from its start month (before / at / after)', () => {
    const inc = incomes(profile([pay('2027-02', 5_000)])); // starts at t = 3
    expect(inc[3]).toBe(4_000);  // t = 2: before
    expect(inc[4]).toBe(5_000);  // t = 3: at
    expect(inc[24]).toBe(5_000); // after
  });

  it('$0 models quitting: income stops and the gap is drawn from cash', () => {
    const sim = simulate(profile([pay('2026-12', 0)]), 3, { rates: ZERO });
    expect(sim.path.map((s) => s.income)).toEqual([0, 4_000, 0, 0]);
    expect(sim.path[3]!.cash).toBe(10_000 + 2_500 - 1_500 - 1_500);
  });

  it('grows with income growth from month 0, not from its start (amounts are in today’s dollars)', () => {
    const rates = { ...ZERO, inflationAnnual: 0.12, incomeGrowthAnnual: 0.06 };
    const inc = incomes(profile([pay('2027-11', 5_000)]), 24, { rates }); // starts at t = 12
    expect(inc[12]).toBeCloseTo(4_000 * 1.06 ** (11 / 12), 9);
    expect(inc[13]).toBeCloseTo(5_000 * 1.06, 9);
    expect(inc[19]).toBeCloseTo(5_000 * 1.06 ** (18 / 12), 9);
  });

  it('a started event (month ≤ asOf) applies from month 0', () => {
    expect(incomes(profile([pay('2026-09', 5_000)]), 2)).toEqual([0, 5_000, 5_000]);
  });
});

describe('simulate: spending events', () => {
  it('replaces that category’s amount from its start month; the others stay', () => {
    const sp = spendings(profile([spend('2027-01', 'rentUtilities', 2_000)])); // starts at t = 2
    expect(sp[2]).toBe(1_500); // other 1,000 + rent 500
    expect(sp[3]).toBe(3_000); // other 1,000 + rent 2,000
    expect(sp[24]).toBe(3_000);
  });

  it('a new category adds to spending, and $0 ends a cost', () => {
    const sp = spendings(profile([spend('2027-01', 'childcare', 1_200), spend('2027-07', 'childcare', 0)]));
    expect([sp[2], sp[3], sp[8], sp[9]]).toEqual([1_500, 2_700, 2_700, 1_500]);
  });

  it('inflates with prices from month 0', () => {
    const rates = { ...ZERO, inflationAnnual: 0.12 };
    const sp = spendings(profile([spend('2027-11', 'rentUtilities', 2_000)]), 24, { rates }); // t = 12
    expect(sp[12]).toBeCloseTo(1_500 * 1.12 ** (11 / 12), 9);
    expect(sp[13]).toBeCloseTo(3_000 * 1.12, 9);
  });

  it('moves money like spending: the surplus and cash follow', () => {
    const sim = simulate(profile([spend('2026-12', 'other', 3_000)]), 2, { rates: ZERO });
    expect(sim.path[1]!.surplus).toBe(2_500);
    expect(sim.path[2]!.surplus).toBe(500);
    expect(sim.path[2]!.cash).toBe(13_000);
  });
});

describe('simulate: one-off events', () => {
  it('a cost is paid once from cash in its month, like a cash purchase', () => {
    const sim = simulate(profile([oneOff('2027-01', 3_000, 'cost')]), 6, { rates: ZERO }); // t = 2
    expect(sim.path.map((s) => s.purchasesCash)).toEqual([0, 0, 0, 3_000, 0, 0, 0]);
    expect(sim.path[3]!.surplus).toBe(2_500 - 3_000);
    expect(sim.path[6]!.netWorth).toBe(10_000 + 6 * 2_500 - 3_000);
  });

  it('a cost cash cannot cover goes on a card', () => {
    const sim = simulate(profile([oneOff('2026-12', 20_000, 'cost')], { cash: 0 }), 2, { rates: ZERO });
    expect(sim.path[2]!.cash).toBe(0);
    expect(sim.path[2]!.cardBalance).toBeGreaterThan(0);
  });

  it('income is added to cash once (not split to retirement, not counted as pay)', () => {
    const sim = simulate(profile([oneOff('2027-01', 3_000, 'income')], { share: 0.5 }), 4, { rates: ZERO });
    expect(sim.path.map((s) => s.income)).toEqual([0, 4_000, 4_000, 4_000, 4_000]);
    expect(sim.path[3]!.cash - sim.path[2]!.cash).toBe(1_250 + 3_000);
    expect(sim.path[4]!.cash - sim.path[3]!.cash).toBe(1_250);
    expect(sim.path[4]!.retirement).toBe(4 * 1_250);
  });

  it('inflates to its month from month 0', () => {
    const rates = { ...ZERO, inflationAnnual: 0.12 };
    const sim = simulate(profile([oneOff('2028-11', 1_000, 'cost')]), 30, { rates }); // t = 24
    expect(sim.path[25]!.purchasesCash).toBeCloseTo(1_000 * 1.12 ** 2, 9);
  });
});

describe('simulate: several events on one field', () => {
  it('the latest start wins from its month, whatever the list order', () => {
    const inc = incomes(profile([pay('2028-01', 6_000), pay('2027-02', 5_000)])); // t = 14 and t = 3
    expect([inc[3], inc[4], inc[14], inc[15], inc[24]]).toEqual([4_000, 5_000, 5_000, 6_000, 6_000]);
    const sp = spendings(profile([spend('2028-01', 'other', 200), spend('2027-02', 'other', 700)]));
    expect([sp[3], sp[4], sp[14], sp[15]]).toEqual([1_500, 1_200, 1_200, 700]);
  });

  it('a tie in the same month goes to the later one in the list', () => {
    expect(incomes(profile([pay('2027-02', 5_000), pay('2027-02', 7_000)]))[4]).toBe(7_000);
    expect(incomes(profile([pay('2027-02', 7_000), pay('2027-02', 5_000)]))[4]).toBe(5_000);
  });

  it('events on different fields and kinds all apply', () => {
    const sim = simulate(profile([
      pay('2027-02', 5_000), spend('2027-02', 'childcare', 1_000), oneOff('2027-02', 400, 'cost'),
    ]), 5, { rates: ZERO });
    expect(sim.path[4]!.surplus).toBe(5_000 - 2_500 - 400);
    expect(sim.path[5]!.surplus).toBe(5_000 - 2_500);
  });
});

describe('simulate: estimated event values', () => {
  const s = estimateSpread.value;

  it('shift by estimateSpread in low/high like any estimate (pay up is good, spending up is bad)', () => {
    const p = profile([pay('2027-02', 5_000, true), spend('2027-02', 'childcare', 1_000, true)]);
    const at = (scenario: 'low' | 'mid' | 'high') => simulate(p, 6, { rates: ZERO, scenario }).path[4]!;
    expect(at('mid').income).toBe(5_000);
    expect(at('low').income).toBeCloseTo(5_000 * (1 - s), 9);
    expect(at('high').income).toBeCloseTo(5_000 * (1 + s), 9);
    expect(at('low').spending).toBeCloseTo(1_500 + 1_000 * (1 + s), 9);
    expect(at('high').spending).toBeCloseTo(1_500 + 1_000 * (1 - s), 9);
    // measured profile values are not shifted before the event
    expect(simulate(p, 6, { rates: ZERO, scenario: 'low' }).path[1]!.income).toBe(4_000);
  });

  it('measured event values are not shifted', () => {
    const p = profile([pay('2027-02', 5_000)]);
    expect(simulate(p, 6, { rates: ZERO, scenario: 'low' }).path[4]!.income).toBe(5_000);
  });

  it('hasEstimates counts estimated pay and spending events, so forecast() has a band', () => {
    expect(hasEstimates(profile())).toBe(false);
    expect(hasEstimates(profile([pay('2027-02', 5_000), oneOff('2027-03', 100, 'cost')]))).toBe(false);
    expect(hasEstimates(profile([pay('2027-02', 5_000, true)]))).toBe(true);
    expect(hasEstimates(profile([spend('2027-02', 'childcare', 900, true)]))).toBe(true);
    const f = forecast(profile([spend('2027-02', 'childcare', 900, true)]));
    expect(f.points[2]!.high - f.points[2]!.low).toBe(0);  // before the event: nothing estimated
    expect(f.in10y.high).toBeGreaterThan(f.in10y.low);
  });
});

describe('events and moves', () => {
  it('a move changes today’s value; a later event on the same category replaces it from its month', () => {
    const p = profile([spend('2027-05', 'rentUtilities', 2_000)]); // t = 6
    const moved = spendings(applyPatch(p, { spending: { rentUtilities: 300 } }));
    const plain = spendings(p);
    expect(moved[6]).toBe(1_300);   // the move counts until the event
    expect(plain[6]).toBe(1_500);
    expect(moved.slice(7)).toEqual(plain.slice(7)); // then the event's rent, patched or not
  });

  it('applyPatch and cloneProfile keep the events and asOf, as deep copies', () => {
    const p = profile([pay('2027-02', 5_000, true), spend('2027-02', 'childcare', 1_000), oneOff('2027-03', 100, 'income')]);
    for (const q of [cloneProfile(p), applyPatch(p, { spending: { other: 900 } })]) {
      expect(q.events).toEqual(p.events);
      expect(q.asOf).toBe(AS_OF);
      expect(q.events).not.toBe(p.events);
      const e = q.events![0]!;
      if (e.kind === 'pay') e.takeHomePay.value = 1;
      expect(p.events![0]).toEqual(pay('2027-02', 5_000, true));
    }
    expect(cloneProfile(profileDemo)).not.toHaveProperty('events');
  });
});

describe('consumers follow the events (they live on the profile)', () => {
  const demo = (events: LifeEvent[]): Profile => ({ ...cloneProfileDemo(), asOf: AS_OF, events });

  it('a raise brings a goal closer', () => {
    const goal = { target: 60_000, years: 5 };
    const without = goalStatus(demo([]), goal);
    const withRaise = goalStatus(demo([pay('2027-02', profileDemo.takeHomePay.value + 1_500)]), goal);
    expect(withRaise.projected.mid).toBeGreaterThan(without.projected.mid);
    expect(withRaise.gap).toBeLessThan(without.gap);
  });

  it('a kid can change the Can I Afford It? verdict', () => {
    const buy = { label: 'sofa', amount: 300, recurring: false as const, payWith: 'cash' as const };
    expect(canAfford(demo([]), buy).verdict).toBe('fits');
    const kid = canAfford(demo([spend('2026-12', 'childcare', 2_500, true)]), buy);
    expect(kid.verdict).not.toBe('fits');
  });

  it('a cut on a category an event later replaces is worth less', () => {
    const cut = (p: Profile) => rankMoves(p).find((m) => m.id === 'cutCategory:other')?.effect10y ?? 0;
    const full = cut(demo([]));
    expect(full).toBeGreaterThan(0);
    // from a year on, `other` is set by an event anyway: the cut only counts until then
    const replaced = cut(demo([spend('2027-11', 'other', profileDemo.spending.other.value)]));
    expect(replaced).toBeLessThan(full / 2);
  });
});
