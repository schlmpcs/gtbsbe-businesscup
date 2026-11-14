// S14 check-in: simulateMonth, checkinRecord, checkinStart, checkinSummary. Every expected number is
// derived here from simulate / forecast / goalStatus on the demo profile, or checked by hand.
import { describe, expect, it } from 'vitest';
import { cloneProfileDemo } from '@lifeguessr/data/fixtures';
import { CheckinRecordSchema, COST_CATEGORIES, type Move, type Profile } from '@lifeguessr/types';
import { checkinMonthNoise } from './assumptions';
import {
  CHECKIN_CATEGORIES, checkinRecord, checkinStart, checkinSummary, profileWithBalances, seedOf, simulateMonth,
} from './checkin';
import { applyPatch, forecast } from './forecast';
import { goalStatus } from './goal';
import { SYNTHETIC_CARD_ID, simulate } from './simulate';

const SEED = seedOf('2026-12');

describe('simulateMonth', () => {
  it('is deterministic for the same profile, month and seed', () => {
    const p = cloneProfileDemo();
    expect(simulateMonth(p, 1, SEED)).toEqual(simulateMonth(p, 1, SEED));
  });

  it('differs between months and seeds', () => {
    const p = cloneProfileDemo();
    expect(simulateMonth(p, 1, SEED).totals).not.toEqual(simulateMonth(p, 2, SEED).totals);
    expect(simulateMonth(p, 1, SEED).totals).not.toEqual(simulateMonth(p, 1, SEED + 1).totals);
  });

  it('stays within the documented noise of the plan, per category, and is labelled simulated', () => {
    const p = cloneProfileDemo();
    for (let i = 1; i <= 24; i++) {
      const m = simulateMonth(p, i, SEED);
      expect(m.simulated).toBe(true);
      expect(m.monthIndex).toBe(i);
      for (const c of COST_CATEGORIES) {
        const plan = p.spending[c].value;
        expect(m.planned[c]).toBe(plan);
        // ±noise, plus half a cent of rounding.
        expect(Math.abs(m.totals[c] - plan)).toBeLessThanOrEqual(plan * checkinMonthNoise.value[c] + 0.005);
        expect(m.totals[c]).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('moves every noisy category over a year (the month is not the plan copied)', () => {
    const p = cloneProfileDemo();
    const months = Array.from({ length: 12 }, (_, i) => simulateMonth(p, i + 1, SEED));
    for (const c of ['groceries', 'eatingOut', 'other', 'car'] as const) {
      expect(months.some((m) => m.totals[c] !== p.spending[c].value)).toBe(true);
    }
    expect(months.every((m) => m.totals.debtPayments === p.spending.debtPayments.value)).toBe(true);
  });

  it('rejects a bad month index or seed', () => {
    const p = cloneProfileDemo();
    expect(() => simulateMonth(p, 0, SEED)).toThrow(RangeError);
    expect(() => simulateMonth(p, 1.5, SEED)).toThrow(RangeError);
    expect(() => simulateMonth(p, 1, 0.5)).toThrow(RangeError);
  });

  it('seedOf is stable (FNV-1a)', () => {
    expect(seedOf('')).toBe(0x811c9dc5);
    expect(seedOf('a')).toBe(0xe40c292c);
  });
});

describe('checkinRecord', () => {
  it('runs the simulated month through simulate: balances, net worth, vs forecast, debt paid down', () => {
    const p = cloneProfileDemo();
    const sim = simulateMonth(p, 1, SEED);
    const r = checkinRecord(p, '2026-12', sim);
    expect(CheckinRecordSchema.parse(r)).toEqual(r);

    const actualP: Profile = { ...p, spending: Object.fromEntries(COST_CATEGORIES.map((c) => [c, { ...p.spending[c], value: sim.totals[c] }])) as Profile['spending'] };
    const actual = simulate(actualP, 1).path;
    const planned = simulate(p, 1).path;
    expect(r.netWorth).toBeCloseTo(actual[1]!.netWorth, 6);
    expect(r.balances.cash).toBeCloseTo(actual[1]!.cash, 6);
    expect(r.vsForecast).toBeCloseTo(actual[1]!.netWorth - planned[1]!.netWorth, 6);
    expect(r.debtPaidDown).toBeCloseTo(actual[0]!.debtBalance - actual[1]!.debtBalance, 6);
    expect(r.debtPaidDown).toBeGreaterThan(0);

    // Spending less than planned leaves you ahead by about the difference (cash yield aside).
    const spentLess = CHECKIN_CATEGORIES.reduce((s, c) => s + sim.planned[c] - sim.totals[c], 0);
    expect(r.vsForecast).toBeCloseTo(spentLess, 0);

    const after = profileWithBalances(p, r.balances);
    expect(r.number10y).toBeCloseTo(forecast(after, 10, { todaysDollars: true }).in10y.mid, 6);
  });

  it('a month exactly on plan is 0 vs forecast', () => {
    const p = cloneProfileDemo();
    const sim = simulateMonth(p, 1, SEED);
    const r = checkinRecord(p, '2026-12', { ...sim, totals: { ...sim.planned } });
    expect(r.vsForecast).toBeCloseTo(0, 9);
  });

  it('rejects a malformed month', () => {
    const p = cloneProfileDemo();
    expect(() => checkinRecord(p, '2026-13', simulateMonth(p, 1, SEED))).toThrow(RangeError);
  });
});

describe('checkinStart and profileWithBalances', () => {
  it('continues from the last saved month and keeps the plan', () => {
    const p = cloneProfileDemo();
    const r1 = checkinRecord(p, '2026-12', simulateMonth(p, 1, SEED));
    const start = checkinStart(p, [r1]);
    expect(start.cash.value).toBe(r1.balances.cash);
    expect(start.retirement.value).toBe(r1.balances.retirement);
    expect(start.debts.find((d) => d.id === 'card-1')!.balance).toBe(r1.balances.debts['card-1']);
    expect(start.spending).toEqual(p.spending);
    expect(checkinStart(p, [])).toBe(p);
  });

  it('adds the card the simulation opened for a shortfall', () => {
    const p = cloneProfileDemo();
    const next = profileWithBalances(p, { cash: 0, retirement: 1, debts: { [SYNTHETIC_CARD_ID]: 500 } });
    const card = next.debts.find((d) => d.id === SYNTHETIC_CARD_ID)!;
    expect(card).toMatchObject({ kind: 'card', balance: 500 });
    expect(card.minPayment.isEstimate).toBe(true);
  });
});

describe('checkinSummary', () => {
  const goal = { target: 150_000, years: 10 };

  it('before any month: today’s number, no rows, no value, no change', () => {
    const p = cloneProfileDemo();
    const s = checkinSummary(p, [], null);
    expect(s.rows).toEqual([]);
    expect(s.value).toBeNull();
    expect(s.number.today).toBeCloseTo(simulate(p, 0).path[0]!.netWorth, 9);
    expect(s.number.in10y.mid).toBeCloseTo(forecast(p, 10, { todaysDollars: true }).in10y.mid, 6);
    expect(s.number.change10y).toBeCloseTo(0, 6);
  });

  it('forecast vs actual rows and the change since the number before the first check-in', () => {
    const p = cloneProfileDemo();
    const r1 = checkinRecord(p, '2026-12', simulateMonth(p, 1, SEED));
    const s = checkinSummary(p, [], r1);
    expect(s.rows.map((r) => r.category)).not.toContain('debtPayments');
    expect(s.rows.map((r) => r.category)).not.toContain('childcare'); // $0 in the demo plan
    expect(s.forecastTotal).toBeCloseTo(CHECKIN_CATEGORIES.reduce((t, c) => t + r1.planned[c], 0), 9);
    expect(s.actualTotal).toBeCloseTo(CHECKIN_CATEGORIES.reduce((t, c) => t + r1.totals[c], 0), 9);
    expect(s.number.today).toBe(r1.netWorth);
    expect(s.number.in10y.mid).toBeCloseTo(r1.number10y, 6);
    expect(s.number.previous10y).toBeCloseTo(forecast(p, 10, { todaysDollars: true }).in10y.mid, 6);
    expect(s.number.change10y).toBeCloseTo(r1.number10y - s.number.previous10y, 6);
    expect(s.value).toBeNull(); // nothing saved yet
  });

  it('the value check sums the saved check-ins; change is against the last saved one', () => {
    const p = cloneProfileDemo();
    const r1 = checkinRecord(p, '2026-12', simulateMonth(p, 1, SEED));
    const start2 = checkinStart(p, [r1]);
    const r2 = checkinRecord(start2, '2027-01', simulateMonth(start2, 2, seedOf('2027-01')));
    const s = checkinSummary(p, [r1, r2], null);
    expect(s.value!.checkins).toBe(2);
    expect(s.value!.debtPaidDown).toBeCloseTo(r1.debtPaidDown + r2.debtPaidDown, 9);
    expect(s.value!.vsForecast).toBeCloseTo(r1.vsForecast + r2.vsForecast, 9);
    expect(s.value!.numberChange).toBeCloseTo(r2.number10y - forecast(p, 10, { todaysDollars: true }).in10y.mid, 6);
    expect(s.number.previous10y).toBe(r1.number10y);
    expect(s.number.today).toBe(r2.netWorth);

    const withCurrent = checkinSummary(p, [r1], r2);
    expect(withCurrent.number.previous10y).toBe(r1.number10y);
    expect(withCurrent.value!.checkins).toBe(1);
  });

  it('goal status is goalStatus on the profile after the latest month', () => {
    const p = cloneProfileDemo();
    const r1 = checkinRecord(p, '2026-12', simulateMonth(p, 1, SEED));
    const s = checkinSummary(p, [r1], null, { goal });
    expect(s.goal).toEqual(goalStatus(profileWithBalances(p, r1.balances), goal));
    expect(checkinSummary(p, [r1], null).goal).toBeNull();
  });

  it('card move: paid since the check-ins started, and months to payoff with the move', () => {
    const base = cloneProfileDemo();
    const move: Move = { id: 'm1', kind: 'payCardFirst', level: 1, effect10y: 1, patch: { debts: [{ id: 'card-1', extraPayment: 400 }] } };
    const plan = applyPatch(base, move.patch);
    const r1 = checkinRecord(plan, '2026-12', simulateMonth(plan, 1, SEED));
    const s = checkinSummary(plan, [r1], null, { committedMove: move });
    expect(s.move).toMatchObject({ kind: 'debtPayoff', debtId: 'card-1', startBalance: 6400 });
    if (s.move?.kind !== 'debtPayoff') throw new Error('expected debtPayoff');
    expect(s.move.balance).toBe(r1.balances.debts['card-1']);
    expect(s.move.paid).toBeCloseTo(6400 - s.move.balance, 9);
    expect(s.move.paid).toBeGreaterThan(400); // the minimum plus the extra, less a month of interest
    expect(s.move.share).toBeCloseTo(s.move.paid / 6400, 9);
    const payoff = simulate(profileWithBalances(plan, r1.balances), 120).payoffMonth['card-1'];
    expect(s.move.payoffMonths).toBe(payoff);
  });

  it('spending move: the latest month against the target', () => {
    const base = cloneProfileDemo();
    const move: Move = { id: 'm2', kind: 'cutCategory', level: 1, category: 'eatingOut', effect10y: 1, patch: { spending: { eatingOut: 240 } } };
    const plan = applyPatch(base, move.patch);
    const r1 = checkinRecord(plan, '2026-12', simulateMonth(plan, 1, SEED));
    const s = checkinSummary(plan, [], r1, { committedMove: move });
    expect(s.move).toEqual({ kind: 'spendingTarget', category: 'eatingOut', target: 240, actual: r1.totals.eatingOut, onTrack: r1.totals.eatingOut <= 240 });
    // No month yet: nothing to measure.
    expect(checkinSummary(plan, [], null, { committedMove: move }).move).toBeNull();
  });
});
