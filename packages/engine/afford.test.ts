// Can I Afford It? (Y4): verdicts on the demo fixture and on hand-built profiles where every
// number is plain arithmetic (no inflation, yield or returns).
import { describe, expect, it } from 'vitest';
import { cloneProfileDemo, profileDemo } from '@lifeguessr/data/fixtures';
import type { CostCategory, Debt, Profile, Purchase } from '@lifeguessr/types';
import { COST_CATEGORIES } from '@lifeguessr/types';
import { canAfford } from './afford';
import { forecast } from './forecast';
import type { ForecastRates } from './simulate';

/** No growth, no yield, no returns; a 0% card so card balances are plain arithmetic too. */
const ZERO: Partial<ForecastRates> = { inflationAnnual: 0, cashYieldAnnual: 0, returnAnnualNominal: 0, cardApr: 0 };

function profile(o: { pay: number; other: number; cash: number; debts?: Debt[] }): Profile {
  const spending = Object.fromEntries(
    COST_CATEGORIES.map((c) => [c, { value: c === 'other' ? o.other : 0, isEstimate: false }]),
  ) as Record<CostCategory, { value: number; isEstimate: boolean }>;
  return {
    age: { value: 30, isEstimate: false },
    takeHomePay: { value: o.pay, isEstimate: false },
    spending,
    cash: { value: o.cash, isEstimate: false },
    retirement: { value: 0, isEstimate: false },
    retirementShare: { value: 0, isEstimate: false },
    debts: o.debts ?? [],
    doneMoveIds: [],
  };
}

const debt = (o: { id?: string; kind?: Debt['kind']; balance: number; apr: number; min: number; estimate?: boolean }): Debt => ({
  id: o.id ?? 'd1',
  kind: o.kind ?? 'personal',
  balance: o.balance,
  apr: o.apr,
  minPayment: { value: o.min, isEstimate: o.estimate ?? false },
});

const buy = (amount: number, payWith: Purchase['payWith'] = 'cash', recurring: Purchase['recurring'] = false): Purchase => ({
  label: 'Thing', amount, recurring, payWith,
});

describe('canAfford: demo profile', () => {
  // $5,200 pay − $3,655 spending − $605.92 debt minimums ≈ $939 surplus a month; $3,800 cash is
  // just under one month of outflow ($4,260.92) until the first month's surplus lands.
  it('a small cash purchase fits', () => {
    const r = canAfford(profileDemo, buy(300));
    expect(r.verdict).toBe('fits');
    expect(r.waitMonths).toBeUndefined();
    expect(r.failsOn).toBeUndefined();
    expect(r.baselineFails).toBe(false);
  });

  it('a small card purchase, paid off from the surplus, fits', () => {
    expect(canAfford(profileDemo, buy(400, 'card')).verdict).toBe('fits');
  });

  it('a card purchase the surplus cannot clear in 12 months returns "no"', () => {
    const r = canAfford(profileDemo, buy(15_000, 'card'));
    expect(r.verdict).toBe('no');
    expect(r.waitMonths).toBeUndefined();
    expect(r.failsOn).toBe('cushion'); // buying now: month 1's surplus goes to the card, not cash
    expect(r.baselineFails).toBe(false);
  });

  it('a big one-time cash purchase waits until cash covers it and the cushion', () => {
    const r = canAfford(profileDemo, buy(3000));
    expect(r.verdict).toBe('wait');
    expect(r.waitMonths).toBe(3);
    expect(r.failsOn).toBe('cushion');
  });

  it('a recurring purchase the surplus cannot carry is "no", never "wait"', () => {
    const r = canAfford(profileDemo, buy(1500, 'cash', 'monthly'));
    expect(r.verdict).toBe('no');
    expect(r.waitMonths).toBeUndefined();
  });
});

describe('canAfford: the three rules', () => {
  // Cushion rule: $1,000 surplus, cushion = $4,000 of spending; month m's cash = 4,000 + 1,000·m.
  const saver = profile({ pay: 5000, other: 4000, cash: 4000 });

  it('cushion: "wait" returns the first month the purchase fits', () => {
    // Bought in month k + 1: 4,000 + 1,000(k + 1) − 3,500 ≥ 4,000 ⇔ k ≥ 2.5.
    const r = canAfford(saver, buy(3500), { rates: ZERO });
    expect(r).toMatchObject({ verdict: 'wait', waitMonths: 3, failsOn: 'cushion', baselineFails: false });
    expect(canAfford(saver, buy(1000), { rates: ZERO }).verdict).toBe('fits'); // 5,000 − 1,000 ≥ 4,000
    expect(canAfford(saver, buy(1001), { rates: ZERO })).toMatchObject({ verdict: 'wait', waitMonths: 1 });
  });

  it('cushion: the same purchase recurring yearly never gets "wait"', () => {
    const r = canAfford(saver, buy(3500, 'cash', 'yearly'), { rates: ZERO });
    expect(r.verdict).toBe('no');
    expect(r.waitMonths).toBeUndefined();
    expect(r.failsOn).toBe('cushion');
  });

  it('cushion: a recurring cost raises the cushion it must keep', () => {
    // $900/month leaves $100 surplus: cash 4,100 in month 1 is above the $4,000 of spending but
    // under a cushion of 4,000 + 900 = 4,900.
    expect(canAfford(saver, buy(900, 'cash', 'monthly'), { rates: ZERO }).failsOn).toBe('cushion');
    // $400/month: cash 4,000 + 600·m ≥ 4,400 from month 1.
    expect(canAfford(saver, buy(400, 'cash', 'monthly'), { rates: ZERO }).verdict).toBe('fits');
  });

  it('cardRevolves: the card balance must be gone by the 12th month, counting the purchase month', () => {
    // $200 surplus, cash far above the cushion. 0% card: month 1 the surplus pays $200; months
    // 2–12 the $25 minimum + $175 of surplus. 12 × 200 = 2,400 clears exactly at month 12.
    const thin = profile({ pay: 3000, other: 2800, cash: 20_000 });
    expect(canAfford(thin, buy(2400, 'card'), { rates: ZERO }).verdict).toBe('fits');
    const r = canAfford(thin, buy(2401, 'card'), { rates: ZERO });
    expect(r).toMatchObject({ verdict: 'no', failsOn: 'cardRevolves', baselineFails: false });
    expect(r.waitMonths).toBeUndefined(); // waiting saves cash, but the card is paid from the surplus
    expect(canAfford(thin, buy(2401, 'cash'), { rates: ZERO }).verdict).toBe('fits');
  });

  it('cardRevolves: at the default card APR, interest has to be cleared too', () => {
    const thin = profile({ pay: 3000, other: 2800, cash: 20_000 });
    const rates = { ...ZERO, cardApr: 0.2236 };
    expect(canAfford(thin, buy(2400, 'card'), { rates }).failsOn).toBe('cardRevolves');
  });

  it('debtLoad: a loan that lifts required payments above 36% of pay returns "no"', () => {
    // 1,200 / 4,000 = 0.30 today; a $12,000 loan at 0% over 30 months adds $400 → 0.40.
    const car = buy(12_000, { loan: { amount: 12_000, apr: 0, termMonths: 30 } });
    const indebted = profile({ pay: 4000, other: 1000, cash: 50_000, debts: [debt({ balance: 100_000, apr: 0, min: 1200 })] });
    const r = canAfford(indebted, car, { rates: ZERO });
    expect(r).toMatchObject({ verdict: 'no', failsOn: 'debtLoad', baselineFails: false });
    const debtFree = profile({ pay: 4000, other: 1000, cash: 50_000 });
    expect(canAfford(debtFree, car, { rates: ZERO }).verdict).toBe('fits');
  });
});

describe('canAfford: baselineFails', () => {
  it('a plan already running out of cash: flagged, and a purchase that deepens it is "no"', () => {
    // −$500 a month: cash 5,000 − 500·m falls under the $3,500 cushion in month 4 without any purchase.
    const broke = profile({ pay: 3000, other: 3500, cash: 5000 });
    const r = canAfford(broke, buy(100), { rates: ZERO });
    expect(r).toMatchObject({ verdict: 'no', failsOn: 'cushion', baselineFails: true });
  });

  it('a plan already over the debt-load line: a cash purchase that keeps the cushion still fits', () => {
    const indebted = profile({ pay: 4000, other: 1000, cash: 50_000, debts: [debt({ balance: 100_000, apr: 0, min: 1600 })] });
    const r = canAfford(indebted, buy(500), { rates: ZERO });
    expect(r).toMatchObject({ verdict: 'fits', baselineFails: true });
    expect(r.failsOn).toBeUndefined();
    // …but a loan makes the broken rule worse, so it is the purchase's fault.
    const loan = buy(1200, { loan: { amount: 1200, apr: 0, termMonths: 12 } });
    expect(canAfford(indebted, loan, { rates: ZERO })).toMatchObject({ verdict: 'no', failsOn: 'debtLoad', baselineFails: true });
  });

  it('a plan under the cushion now that recovers: the purchase waits for it', () => {
    // Cash 2,500 + 1,000·m vs a $4,000 cushion: broken in month 1 only.
    const recovering = profile({ pay: 5000, other: 4000, cash: 2500 });
    // Bought in month k + 1: 2,500 + 1,000(k + 1) − 1,000 ≥ 4,000 ⇔ k ≥ 1.5.
    const r = canAfford(recovering, buy(1000), { rates: ZERO });
    expect(r).toMatchObject({ verdict: 'wait', waitMonths: 2, failsOn: 'cushion', baselineFails: true });
  });

  it('a healthy plan is not flagged', () => {
    expect(canAfford(profile({ pay: 5000, other: 4000, cash: 4000 }), buy(100), { rates: ZERO }).baselineFails).toBe(false);
  });
});

describe('canAfford: with / without', () => {
  it('without = the plain forecast; with = the forecast with the purchase made now', () => {
    const x = buy(2000);
    const r = canAfford(profileDemo, x);
    expect(r.without).toEqual(forecast(profileDemo, 10));
    expect(r.with).toEqual(forecast(profileDemo, 10, { extra: [{ ...x, startMonth: 0, payOffFromSurplus: true }] }));
    expect(r.with.points[0]).toEqual(r.without.points[0]);
    expect(r.with.in10y.mid).toBeLessThan(r.without.in10y.mid);
    expect(r.with.points).toHaveLength(121);
  });

  it('passes the rates through to both forecasts', () => {
    const rates = { inflationAnnual: 0.05 };
    const r = canAfford(profileDemo, buy(2000), { rates });
    expect(r.without).toEqual(forecast(profileDemo, 10, { rates }));
  });
});

describe('canAfford: cheapestWay', () => {
  it('cash beats a 24% card on the demo profile, whichever way the user chose', () => {
    for (const payWith of ['cash', 'card'] as const) {
      expect(canAfford(profileDemo, buy(2000, payWith)).cheapestWay).toBe('cash');
    }
  });

  it('agrees with the 10-year forecasts of each way', () => {
    const loan = { loan: { amount: 28_000, apr: 0.069, termMonths: 36 } };
    const r = canAfford(profileDemo, buy(28_000, loan));
    const in10y = (payWith: Purchase['payWith']) => canAfford(profileDemo, buy(28_000, payWith)).with.in10y.mid;
    const byWay = { cash: in10y('cash'), card: in10y('card'), loan: in10y(loan) };
    const best = (Object.keys(byWay) as (keyof typeof byWay)[]).reduce((a, b) => (byWay[b] > byWay[a] ? b : a));
    expect(r.cheapestWay).toBe(best);
    // $3,800 of cash can't pay $28,000: the rest lands on a 24% card, so the 6.9% loan wins.
    expect(r.cheapestWay).toBe('loan');
  });

  it('a 0% loan beats paying cash that earns a yield', () => {
    const p = profile({ pay: 5000, other: 3000, cash: 50_000 });
    const rates = { ...ZERO, cashYieldAnnual: 0.03, cardApr: 0.2236 };
    const r = canAfford(p, buy(12_000, { loan: { amount: 12_000, apr: 0, termMonths: 12 } }), { rates });
    expect(r.cheapestWay).toBe('loan');
  });

  it('a 0% card paid off over months beats cash; a loan is never picked without loan terms', () => {
    const card = debt({ id: 'c', kind: 'card', balance: 0, apr: 0, min: 0, estimate: true });
    const p = profile({ pay: 3000, other: 2900, cash: 50_000, debts: [card] });
    const rates = { ...ZERO, cashYieldAnnual: 0.03 };
    expect(canAfford(p, buy(1000, 'cash'), { rates }).cheapestWay).toBe('card');
  });

  it('only a way that fits now is recommended: a cheaper card that revolves loses to cash', () => {
    // $100 surplus a month pays the card: 12 × 100 = 1,200 is cleared by month 12, 1,300 is not.
    // On the card, cash keeps its 3% yield, so the card is cheaper overall (as at 1,000 above).
    const card = debt({ id: 'c', kind: 'card', balance: 0, apr: 0, min: 0, estimate: true });
    const p = profile({ pay: 3000, other: 2900, cash: 50_000, debts: [card] });
    const rates = { ...ZERO, cashYieldAnnual: 0.03 };
    expect(canAfford(p, buy(1200, 'cash'), { rates })).toMatchObject({ cheapestWay: 'card', cheapestWayFits: true });
    // 1,300: the card breaks cardRevolves; cash (50,000 − 1,300 + 100 ≥ 2,900 cushion) fits.
    expect(canAfford(p, buy(1300, 'card'), { rates }).verdict).toBe('no');
    expect(canAfford(p, buy(1300, 'card'), { rates })).toMatchObject({ cheapestWay: 'cash', cheapestWayFits: true });
  });

  it('says so when no way to pay fits now', () => {
    // $28,000 car, $4,000 cash, $1,000 surplus. Cash: 4,000 covers part, cash hits 0 < the $4,000
    // cushion, and 4,000 + 1,000·k ≥ 32,000 needs k = 28 > 12 months, so "no". Card: the card's
    // minimum payment joins the outflow, so $4,000 of cash is under a cushion of 4,000 + that
    // minimum (and 12 × 1,000 = 12,000 of the 28,000 would be cleared in 12 months anyway).
    const saver = profile({ pay: 5000, other: 4000, cash: 4000 });
    const r = canAfford(saver, buy(28_000, 'cash'), { rates: ZERO });
    expect(r.verdict).toBe('no');
    expect(canAfford(saver, buy(28_000, 'card'), { rates: ZERO })).toMatchObject({ verdict: 'no', failsOn: 'cushion' });
    // 0% card, no yield: both ways end at the same net worth, so the tie goes to cash, not fitting.
    expect(r).toMatchObject({ cheapestWay: 'cash', cheapestWayFits: false });
  });

  it('ties go to cash', () => {
    // Paid off from the surplus in the purchase month: card and cash end up identical.
    const p = profile({ pay: 5000, other: 1000, cash: 10_000 });
    expect(canAfford(p, buy(500, 'card'), { rates: ZERO }).cheapestWay).toBe('cash');
  });
});

describe('canAfford: purity and input checks', () => {
  it('is pure and deterministic: frozen inputs are not mutated and results repeat', () => {
    const before = cloneProfileDemo();
    const x = Object.freeze(buy(1000, 'card'));
    const a = canAfford(profileDemo, x);
    const b = canAfford(profileDemo, x);
    expect(a).toEqual(b);
    expect(profileDemo).toEqual(before);
    expect(x).toEqual(buy(1000, 'card'));
  });

  it('rejects an amount that is not a positive number', () => {
    for (const amount of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => canAfford(profileDemo, buy(amount))).toThrow(RangeError);
    }
  });
});
