// T3: loan, compareLoans, amortize, payoffOrder. Spec: docs/ENGINEERING.md → Loan amortization.
// Expected values are hand-checked from the closed-form formulas noted next to each one.
import { describe, expect, it } from 'vitest';
import { cloneProfileDemo, loanOffersSample, profileDemo } from '@lifeguessr/data/fixtures';
import type { Debt, LoanInput, Profile } from '@lifeguessr/types';
import { forecast } from '../forecast';
import { MAX_SIMULATION_MONTHS, amortize, amortizedPayment, compareLoans, loan, payoffOrder } from './index';

const debt = (id: string, balance: number, apr: number, min: number, extra?: number, isEstimate = false): Debt => ({
  id, kind: 'card', balance, apr, minPayment: { value: min, isEstimate }, ...(extra !== undefined && { extraPayment: extra }),
});

/** Demo profile with its debts replaced (and optionally another take-home pay). */
function profileWith(debts: Debt[], takeHomePay?: number): Profile {
  const p = cloneProfileDemo();
  p.debts = debts;
  if (takeHomePay !== undefined) p.takeHomePay = { value: takeHomePay, isEstimate: false };
  return p;
}

describe('amortizedPayment', () => {
  it('hits the hand-checked payment: $28,000 at 6.9% for 36 months = $863.28/month', () => {
    // r = 0.00575; (1.00575)^36 = 1.229274…; 28,000 × 0.00575 × 1.229274 / 0.229274 = 863.279…
    expect(amortizedPayment(28_000, 0.069, 36)).toBeCloseTo(863.279_08, 5);
  });

  it('is P / n at 0% APR and 0 with nothing to finance', () => {
    expect(amortizedPayment(1_200, 0, 12)).toBe(100);
    expect(amortizedPayment(0, 0.2, 12)).toBe(0);
  });

  it('stays accurate where the textbook form cancels (100% APR over 600 months)', () => {
    // (1 + r)^600 ≈ 7e20, so the payment is P·r to 21 digits, but the part above P·r is not 0.
    const pmt = amortizedPayment(10_000, 1, 600);
    expect(pmt).toBeCloseTo(10_000 / 12, 9);
  });

  it('rejects invalid input with a RangeError', () => {
    expect(() => amortizedPayment(-1, 0.1, 12)).toThrow(RangeError);
    expect(() => amortizedPayment(1_000, Number.NaN, 12)).toThrow(RangeError);
    expect(() => amortizedPayment(1_000, 0.1, 0)).toThrow(RangeError);
    expect(() => amortizedPayment(1_000, 0.1, 12.5)).toThrow(RangeError);
    expect(() => amortizedPayment(1_000, 0.1, MAX_SIMULATION_MONTHS + 1)).toThrow(RangeError);
  });
});

describe('amortize', () => {
  it('returns payoffMonth null and no schedule when the payment does not cover the interest', () => {
    // $10,000 at 24%: the first month's interest is $200.
    for (const payment of [0, 150, 200]) {
      const a = amortize({ principal: 10_000, apr: 0.24, payment });
      expect(a.payoffMonth).toBeNull();
      expect(a.schedule).toEqual([]);
    }
    // An extra payment that lifts it above the interest makes it pay off.
    expect(amortize({ principal: 10_000, apr: 0.24, payment: 150, extraPayment: 51 }).payoffMonth).toBe(268);
  });

  it('pays off a payment just above the interest in n = −ln(1 − P·r / pmt) / ln(1 + r) months', () => {
    // −ln(1 − 200/201) / ln(1.02) = 267.8… → the 268th payment clears it.
    const a = amortize({ principal: 10_000, apr: 0.24, payment: 201 });
    expect(a.payoffMonth).toBe(268);
    expect(a.schedule).toHaveLength(268);
    expect(a.schedule.at(-1)!.balance).toBe(0);
    expect(a.schedule.reduce((s, m) => s + m.principal, 0)).toBeCloseTo(10_000, 6);
    expect(a.totalPaid).toBeCloseTo(a.totalInterest + 10_000, 6);
  });

  it('caps the last payment at what is left', () => {
    // $1,000 at 12% (r = 1%), level payment 88.85 for 12 months, + $500 extra.
    const pmt = amortizedPayment(1_000, 0.12, 12);
    const a = amortize({ principal: 1_000, apr: 0.12, payment: pmt, extraPayment: 500 });
    expect(a.payoffMonth).toBe(2);
    const [m1, m2] = a.schedule;
    expect(m1!.interest).toBeCloseTo(10, 9);
    expect(m1!.principal).toBeCloseTo(pmt + 500 - 10, 9);
    expect(m2!.interest).toBeCloseTo(m1!.balance * 0.01, 9);
    expect(m2!.principal).toBeCloseTo(m1!.balance, 9); // less than pmt + 500 − interest
    expect(m2!.balance).toBe(0);
  });

  it('is 0 months for nothing owed and gives up after MAX_SIMULATION_MONTHS', () => {
    expect(amortize({ principal: 0, apr: 0.2, payment: 0 })).toEqual({ schedule: [], totalInterest: 0, totalPaid: 0, payoffMonth: 0 });
    // 0% APR, $1 a month on $5,000: 5,000 months > the 1,200-month cap.
    expect(amortize({ principal: 5_000, apr: 0, payment: 1 }).payoffMonth).toBeNull();
  });

  it('rejects invalid input with a RangeError', () => {
    expect(() => amortize({ principal: 100, apr: 0.1, payment: -1 })).toThrow(RangeError);
    expect(() => amortize({ principal: 100, apr: 0.1, payment: 10, extraPayment: Number.POSITIVE_INFINITY })).toThrow(RangeError);
    expect(() => amortize({ principal: Number.NaN, apr: 0.1, payment: 10 })).toThrow(RangeError);
  });
});

describe('loan', () => {
  it('amortizes $28,000 at 6.9% over 36 months: $863.28/month, paid off in month 36', () => {
    const r = loan(profileDemo, { amount: 28_000, apr: 0.069, termMonths: 36 });
    expect(r.monthly).toBeCloseTo(863.28, 2);
    expect(r.payoffMonth).toBe(36);
    expect(r.schedule).toHaveLength(36);
    expect(r.schedule.at(-1)!.balance).toBe(0);
    expect(r.schedule[0]).toMatchObject({ month: 1 });
    expect(r.schedule[0]!.interest).toBeCloseTo(28_000 * 0.00575, 9); // $161.00
    expect(r.schedule[0]!.principal).toBeCloseTo(863.279_08 - 161, 4);
    // Every payment but the capped last one is the level payment.
    for (const m of r.schedule.slice(0, -1)) expect(m.interest + m.principal).toBeCloseTo(r.monthly, 9);
    expect(r.totalInterest).toBeCloseTo(36 * 863.279_08 - 28_000, 3); // $3,078.05
    expect(r.totalCost).toBeCloseTo(28_000 + r.totalInterest, 6);
  });

  it('rolls fees into the principal and pays the down payment up front', () => {
    // P = 28,000 − 3,000 + 495 = 25,495 at 5.49% for 60 months = $486.87/month.
    const r = loan(profileDemo, loanOffersSample[1]!);
    const plain = loan(profileDemo, { amount: 25_495, apr: 0.0549, termMonths: 60 });
    expect(r.monthly).toBeCloseTo(486.866, 3);
    expect(r.monthly).toBe(plain.monthly);
    expect(r.totalInterest).toBeCloseTo(plain.totalInterest, 9);
    expect(r.totalCost).toBeCloseTo(3_000 + plain.totalCost, 6);
    expect(r.totalCost).toBeCloseTo(3_000 + 60 * r.monthly, 4);
  });

  it('fees + down payment + extra at 0% APR (the case from #55)', () => {
    // P = 1,200 − 120 + 120 = 1,200; $100/month + $900 extra: 1,000 then the last 200.
    const r = loan(profileDemo, { amount: 1_200, apr: 0, termMonths: 12, fees: 120, downPayment: 120, extraPayment: 900 });
    expect(r.monthly).toBe(100);
    expect(r.payoffMonth).toBe(2);
    expect(r.schedule.map((m) => m.principal)).toEqual([1_000, 200]);
    expect(r.totalInterest).toBe(0);
    expect(r.totalCost).toBe(1_320);
  });

  it('handles 0% APR and pays off early with an extra payment', () => {
    expect(loan(profileDemo, { amount: 1_200, apr: 0, termMonths: 12 }).payoffMonth).toBe(12);
    const r = loan(profileDemo, { amount: 1_200, apr: 0, termMonths: 12, extraPayment: 100 });
    expect(r.payoffMonth).toBe(6);
    expect(r.totalInterest).toBe(0);
  });

  it('extra payments shorten the loan and cut the interest', () => {
    const base = loan(profileDemo, loanOffersSample[0]!);
    const extra = loan(profileDemo, { ...loanOffersSample[0]!, extraPayment: 200 });
    expect(extra.monthly).toBe(base.monthly); // the required payment does not change
    expect(extra.payoffMonth!).toBeLessThan(36);
    expect(extra.totalInterest).toBeLessThan(base.totalInterest);
    expect(extra.debtLoadAfter).toBe(base.debtLoadAfter); // debt load counts required payments only
  });

  it('pays off within the term even where the level payment barely beats the interest', () => {
    const r = loan(profileDemo, { amount: 10_000, apr: 1, termMonths: 600 });
    expect(r.payoffMonth).toBe(600);
    expect(r.schedule.reduce((s, m) => s + m.principal, 0)).toBeCloseTo(10_000, 6);
    // Balance before the last payment = pmt / (1 + r).
    expect(r.schedule[598]!.balance).toBeCloseTo(r.monthly / (1 + 1 / 12), 3);
  });

  it('a fully paid-down loan finances nothing: payoffMonth 0, no schedule', () => {
    const r = loan(profileDemo, { amount: 5_000, apr: 0.1, termMonths: 24, downPayment: 5_000 });
    expect(r).toMatchObject({ monthly: 0, totalInterest: 0, totalCost: 5_000, payoffMonth: 0, schedule: [] });
    expect(r.debtLoadAfter).toBe(r.debtLoadBefore);
  });

  it('reports debt load before and after against take-home pay', () => {
    const r = loan(profileDemo, { amount: 28_000, apr: 0.069, termMonths: 36 });
    // Card: 6,400 × (0.2436/12 + 1%) = 193.92 (the card formula); auto: 412.
    const before = (193.92 + 412) / 5_200;
    expect(r.debtLoadBefore).toBeCloseTo(before, 9);
    expect(r.debtLoadAfter).toBeCloseTo(before + r.monthly / 5_200, 9);
  });

  it('debt load: estimated card minimums follow the card formula, paid-off debts and extras do not count', () => {
    const p = profileWith([
      debt('card', 1_000, 0.24, 999, 50, true), // stale estimate: formula = max(25, 1,000 × 3%) = 30
      debt('paid', 0, 0.2, 80),                 // paid off: no payment
      { ...debt('auto', 50, 0.12, 300), kind: 'auto' }, // capped at what is owed: 50 × 1.01 = 50.50
    ], 1_000);
    const r = loan(p, { amount: 0, apr: 0, termMonths: 1 });
    expect(r.debtLoadBefore).toBeCloseTo((30 + 50.5) / 1_000, 9);
  });

  it('debt load with zero or negative take-home pay: Infinity with payments, 0 without', () => {
    for (const pay of [0, -500]) {
      const withDebts = loan(profileWith([debt('c', 1_000, 0.2, 50)], pay), { amount: 1_000, apr: 0.1, termMonths: 12 });
      expect(withDebts.debtLoadBefore).toBe(Number.POSITIVE_INFINITY);
      expect(withDebts.debtLoadAfter).toBe(Number.POSITIVE_INFINITY);
      const noDebts = loan(profileWith([], pay), { amount: 1_000, apr: 0.1, termMonths: 12 });
      expect(noDebts.debtLoadBefore).toBe(0);
      expect(noDebts.debtLoadAfter).toBe(Number.POSITIVE_INFINITY);
      expect(loan(profileWith([], pay), { amount: 0, apr: 0, termMonths: 1 }).debtLoadAfter).toBe(0);
    }
  });

  it('effect10y = forecast with the financed purchase − forecast without (month 120, mid, today’s dollars)', () => {
    const l = loanOffersSample[0]!;
    const rates = { inflationAnnual: 0.025 };
    const r = loan(profileDemo, l, { rates });
    const purchase = { label: 'loan', amount: l.amount, recurring: false as const, payWith: { loan: l } };
    const withLoan = forecast(profileDemo, 10, { todaysDollars: true, rates, extra: [purchase] }).in10y.mid;
    const without = forecast(profileDemo, 10, { todaysDollars: true, rates }).in10y.mid;
    expect(r.effect10y).toBeCloseTo(withLoan - without, 6);
    expect(r.effect10y).toBeLessThan(0);
    // Default rates differ from the area's: the option is used.
    expect(loan(profileDemo, l).effect10y).not.toBeCloseTo(r.effect10y, 2);
  });

  it('effect10y ranks offers: the same car at a lower rate and shorter term costs less in 10 years', () => {
    const [cheap, , dear] = compareLoans(profileDemo, [...loanOffersSample]);
    expect(cheap!.totalInterest).toBeLessThan(dear!.totalInterest);
    expect(cheap!.effect10y).toBeGreaterThan(dear!.effect10y);
    expect(loan(profileDemo, { amount: 0, apr: 0, termMonths: 1 }).effect10y).toBe(0);
  });

  it('does not mutate its inputs', () => {
    const p = cloneProfileDemo();
    const l: LoanInput = { ...loanOffersSample[1]! };
    const before = JSON.stringify([p, l]);
    loan(p, l);
    compareLoans(p, [l]);
    expect(JSON.stringify([p, l])).toBe(before);
  });

  it('rejects invalid loans and profiles with a RangeError', () => {
    const ok: LoanInput = { amount: 1_000, apr: 0.1, termMonths: 12 };
    const bad: LoanInput[] = [
      { ...ok, amount: -1 },
      { ...ok, amount: Number.NaN },
      { ...ok, apr: -0.01 },
      { ...ok, apr: Number.POSITIVE_INFINITY },
      { ...ok, termMonths: 0 },
      { ...ok, termMonths: 1.5 },
      { ...ok, termMonths: MAX_SIMULATION_MONTHS + 1 },
      { ...ok, fees: -5 },
      { ...ok, downPayment: -5 },
      { ...ok, downPayment: 1_001 },
      { ...ok, extraPayment: -1 },
    ];
    for (const l of bad) expect(() => loan(profileDemo, l), JSON.stringify(l)).toThrow(RangeError);
    expect(() => loan(profileWith([], Number.NaN), ok)).toThrow(RangeError);
    expect(() => loan(profileWith([debt('a', 1, 0.1, 1), debt('a', 2, 0.1, 1)]), ok)).toThrow(RangeError);
    expect(() => loan(profileWith([debt('a', -1, 0.1, 1)]), ok)).toThrow(RangeError);
    expect(() => compareLoans(profileDemo, [ok, { ...ok, apr: -1 }])).toThrow(RangeError);
  });
});

describe('compareLoans', () => {
  it('returns one result per offer, in the input order, equal to loan() for each', () => {
    const offers = [...loanOffersSample].reverse();
    const rs = compareLoans(cloneProfileDemo(), offers);
    expect(rs).toHaveLength(3);
    expect(rs).toEqual(offers.map((l) => loan(cloneProfileDemo(), l)));
    expect(rs[2]!.monthly).toBeCloseTo(863.28, 2);
    expect(rs.map((r) => r.payoffMonth)).toEqual([72, 60, 36]);
    expect(compareLoans(profileDemo, [])).toEqual([]);
  });
});

describe('payoffOrder', () => {
  const debts = [debt('small-low', 500, 0.1, 25), debt('big-high', 5_000, 0.25, 150)];

  it('orders by APR (avalanche) or by balance (snowball)', () => {
    expect(payoffOrder(debts, 100, 'avalanche').order).toEqual(['big-high', 'small-low']);
    expect(payoffOrder(debts, 100, 'snowball').order).toEqual(['small-low', 'big-high']);
  });

  it('breaks ties: avalanche by smaller balance, snowball by higher APR, then input order', () => {
    const ds = [debt('a', 900, 0.2, 25), debt('b', 300, 0.2, 25), debt('c', 300, 0.25, 25), debt('d', 300, 0.25, 25)];
    expect(payoffOrder(ds, 0, 'avalanche').order).toEqual(['c', 'd', 'b', 'a']);
    expect(payoffOrder(ds, 0, 'snowball').order).toEqual(['c', 'd', 'b', 'a']);
    const ds2 = [debt('x', 300, 0.1, 25), debt('y', 300, 0.3, 25), debt('z', 100, 0.05, 25)];
    expect(payoffOrder(ds2, 0, 'snowball').order).toEqual(['z', 'y', 'x']);
    expect(payoffOrder(ds2, 0, 'avalanche').order).toEqual(['y', 'x', 'z']);
  });

  it('avalanche never pays more interest than snowball', () => {
    const a = payoffOrder(debts, 100, 'avalanche');
    const s = payoffOrder(debts, 100, 'snowball');
    expect(a.payoffMonth).not.toBeNull();
    expect(s.payoffMonth).not.toBeNull();
    expect(a.totalInterest).toBeLessThan(s.totalInterest);
  });

  it('at 0% the payoff month is ⌈total / budget⌉ either way', () => {
    // Budget = 50 + 50 + 100 = 200 a month for 500 owed: 200, 200, 100.
    const ds = [debt('a', 300, 0, 50), debt('b', 200, 0, 50)];
    for (const m of ['avalanche', 'snowball'] as const) {
      expect(payoffOrder(ds, 100, m)).toEqual({ order: ['b', 'a'], payoffMonth: 3, totalInterest: 0 }); // equal APRs: smaller first
    }
  });

  it('one debt matches the loan amortization at payment = minimum + extra', () => {
    const r = payoffOrder([debt('x', 10_000, 0.24, 150, 30)], 21, 'avalanche');
    const a = amortize({ principal: 10_000, apr: 0.24, payment: 201 });
    expect(r.payoffMonth).toBe(a.payoffMonth);
    expect(r.payoffMonth).toBe(268);
    expect(r.totalInterest).toBeCloseTo(a.totalInterest, 4);
  });

  it('rolls freed minimums to the next debt (pays off sooner than minimums alone)', () => {
    const ds = [debt('a', 200, 0.2, 100), debt('b', 3_000, 0.2, 100)];
    const r = payoffOrder(ds, 0, 'snowball');
    const bAlone = amortize({ principal: 3_000, apr: 0.2, payment: 100 }).payoffMonth!;
    expect(r.payoffMonth!).toBeLessThan(bAlone);
  });

  it('returns null when the payments never cover the interest', () => {
    expect(payoffOrder([debt('x', 10_000, 0.3, 50)], 0, 'avalanche').payoffMonth).toBeNull();
    expect(payoffOrder([debt('x', 10_000, 0.24, 200)], 0, 'snowball').payoffMonth).toBeNull(); // = interest
  });

  it('nothing owed: empty order, payoff month 0', () => {
    expect(payoffOrder([], 100, 'snowball')).toEqual({ order: [], payoffMonth: 0, totalInterest: 0 });
    expect(payoffOrder([debt('paid', 0, 0.2, 25)], 0, 'avalanche')).toEqual({ order: [], payoffMonth: 0, totalInterest: 0 });
  });

  it('rejects invalid input with a RangeError', () => {
    expect(() => payoffOrder(debts, -1, 'avalanche')).toThrow(RangeError);
    expect(() => payoffOrder(debts, Number.NaN, 'avalanche')).toThrow(RangeError);
    expect(() => payoffOrder(debts, 0, 'fastest' as 'avalanche')).toThrow(RangeError);
    expect(() => payoffOrder([debt('a', 1, 0.1, 1), debt('a', 2, 0.1, 1)], 0, 'avalanche')).toThrow(RangeError);
    expect(() => payoffOrder([debt('a', 100, -0.1, 1)], 0, 'avalanche')).toThrow(RangeError);
    expect(() => payoffOrder([{ ...debt('a', 100, 0.1, 1), kind: 'boat' as Debt['kind'] }], 0, 'avalanche')).toThrow(RangeError);
  });
});
