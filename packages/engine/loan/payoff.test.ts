import { describe, expect, it } from 'vitest';
import { cloneProfileDemo } from '@lifeguessr/data/fixtures';
import { PayoffPlanSchema, type Debt } from '@lifeguessr/types';
import {
  amortizedPayment,
  comparePayoff,
  extraToFinishBy,
  payoffOrder,
  payoffPlan,
  suggestedPayoffExtra,
} from './index';
import { PAYOFF_MAX_EXTRA, payCardExtraShareOfSurplus, payCardExtraStep } from '../assumptions';
const debt = (id: string, balance: number, apr = 0, min = 100): Debt => ({
  id,
  kind: 'personal',
  balance,
  apr,
  minPayment: { value: min, isEstimate: false },
});

describe('payoff plans', () => {
  it.each(
    [
      [],
      [debt('a', 1200)],
      [debt('a', 0)],
      cloneProfileDemo().debts,
      [debt('a', 1000, 0.24, 10)],
      [debt('a', 1200, 0.12), { ...debt('b', 500, 0.12), extraPayment: 50 }],
    ].map((debts) => ({ debts })),
  )('preserves the legacy payoff invariant for %j', ({ debts }) => {
    for (const method of ['avalanche', 'snowball'] as const) {
      const plan = payoffPlan(debts, 50, method);
      expect({
        order: plan.order,
        payoffMonth: plan.monthsToDebtFree,
        totalInterest: plan.totalInterest,
      }).toEqual(payoffOrder(debts, 50, method));
      expect(PayoffPlanSchema.safeParse(plan).success).toBe(true);
    }
  });
  it('has hand-checked zero-interest totals and per-debt payoff dates', () => {
    const plan = payoffPlan([debt('a', 200), debt('b', 400)], 0, 'snowball');
    expect(plan.timeline).toEqual([
      { month: 0, balance: 600 },
      { month: 1, balance: 400 },
      { month: 2, balance: 200 },
      { month: 3, balance: 0 },
    ]);
    expect(plan.perDebt).toEqual([
      { id: 'a', payoffMonth: 2, interest: 0 },
      { id: 'b', payoffMonth: 3, interest: 0 },
    ]);
    expect(plan.totalPaid).toBe(600);
  });
  it('compares realistic priority strategies and conserves paid principal', () => {
    const debts = [
      debt('card', 6400, 0.228, 180),
      debt('auto', 17800, 0.065, 350),
    ];
    const result = comparePayoff(debts, 200);
    expect(result.avalanche.totalInterest).toBeLessThanOrEqual(
      result.snowball.totalInterest,
    );
    expect(result.snowball.totalInterest).toBeLessThan(
      result.minimum.totalInterest,
    );
    for (const p of [result.avalanche, result.snowball, result.minimum]) {
      expect(p.timeline.at(-1)!.balance).toBe(0);
      expect(p.totalPaid - p.totalInterest).toBeCloseTo(24200, 5);
      expect(Math.max(...p.perDebt.map((d) => d.payoffMonth!))).toBe(
        p.monthsToDebtFree,
      );
      expect(
        p.timeline.every(
          (v, i, a) => i === 0 || v.balance <= a[i - 1]!.balance,
        ),
      ).toBe(true);
    }
  });
  it('bounds never-paid plans and reports null month savings', () => {
    const p = payoffPlan([debt('a', 1000, 0.24, 10)], 0, 'minimum');
    expect(p.monthsToDebtFree).toBeNull();
    expect(p.timeline).toHaveLength(1201);
    expect(p.monthsSavedVsMinimum).toBeNull();
    expect(p.perDebt[0]!.payoffMonth).toBeNull();
  });
  it('returns feasible, monotone target solves, including the cap and already met', () => {
    const debts = [debt('a', 1200)];
    expect(extraToFinishBy(debts, 12)).toEqual({ extra: 0, reachable: true });
    const six = extraToFinishBy(debts, 6),
      three = extraToFinishBy(debts, 3);
    expect(six.extra).toBeGreaterThanOrEqual(100);
    expect(six.extra).toBeLessThan(101);
    expect(three.extra).toBeGreaterThan(six.extra);
    expect(
      payoffPlan(debts, six.extra, 'avalanche').monthsToDebtFree,
    ).toBeLessThanOrEqual(6);
    expect(extraToFinishBy([debt('a', 1e9)], 1)).toEqual({
      extra: PAYOFF_MAX_EXTRA,
      reachable: false,
    });
  });
  it('rejects malformed debts, amounts, methods and horizons', () => {
    expect(() => payoffPlan([debt('a', NaN)], 0, 'avalanche')).toThrow(
      RangeError,
    );
    expect(() => comparePayoff([], Infinity)).toThrow(RangeError);
    expect(() => extraToFinishBy([], 0)).toThrow(RangeError);
    expect(
      PayoffPlanSchema.safeParse({
        ...payoffPlan([], 0, 'minimum'),
        totalPaid: -1,
      }).success,
    ).toBe(false);
    expect(
      PayoffPlanSchema.safeParse({
        ...payoffPlan([], 0, 'minimum'),
        totalInterest: Infinity,
      }).success,
    ).toBe(false);
  });
});

// The demo profile: take-home $5,200; spending $1,950 + $310 + $520 + $340 + $85 + $450 = $3,655; minimums $193.92 on
// the card and $412 on the car loan. Its month leaves 5,200 − 3,655 − 605.92 = $939.08.
describe('suggestedPayoffExtra (where the payoff planner starts)', () => {
  /** Sample offer 1 ($28,000 at 6.9% for 36 months: $863.28 a month) added to the demo debts as Loan Lab does. */
  const withOffer1 = (): Debt[] => [
    ...cloneProfileDemo().debts,
    {
      id: 'new-loan',
      kind: 'personal',
      balance: 28_000,
      apr: 0.069,
      minPayment: { value: amortizedPayment(28_000, 0.069, 36), isEstimate: false },
    },
  ];

  it('is half of the month\'s surplus, rounded down to the step: $939.08 → $469.54 → $450 in $25 steps', () => {
    const p = cloneProfileDemo();
    const s = suggestedPayoffExtra(p, p.debts, { step: 25 });
    expect(s.surplus).toBeCloseTo(939.08, 6);
    expect(s.share).toBe(payCardExtraShareOfSurplus.value);
    expect(s.extra).toBe(450);
  });

  it('defaults to the Next Moves step ($10): $469.54 → $460, the same amount payCardFirst would suggest', () => {
    const p = cloneProfileDemo();
    expect(payCardExtraStep.value).toBe(10);
    expect(suggestedPayoffExtra(p, p.debts).extra).toBe(460);
  });

  it('takes the new loan\'s payment out of the month first: $939.08 − $863.28 = $75.80 left, half is $37.90 → $25', () => {
    const p = cloneProfileDemo();
    const s = suggestedPayoffExtra(p, withOffer1(), { step: 25 });
    expect(s.surplus).toBeCloseTo(75.8, 2);
    expect(s.extra).toBe(25);
    // And that $25 is enough for the plans to pull apart from minimums only (a month sooner, about $514 less interest).
    const c = comparePayoff(withOffer1(), s.extra);
    expect(c.avalanche.monthsToDebtFree).toBe(42);
    expect(c.minimum.monthsToDebtFree).toBe(43);
    expect(c.avalanche.interestSavedVsMinimum).toBeGreaterThan(500);
  });

  it('suggests $0 when the month has nothing left, and says how short it is', () => {
    const p = cloneProfileDemo();
    p.takeHomePay = { value: 4_000, isEstimate: false };
    const s = suggestedPayoffExtra(p, p.debts, { step: 25 });
    expect(s.surplus).toBeCloseTo(4_000 - 3_655 - 605.92, 6);
    expect(s.surplus).toBeLessThan(0);
    expect(s.extra).toBe(0);
  });

  it('suggests $0 when half of what is left is under one step ($40 left, half is $20 < $25)', () => {
    const p = cloneProfileDemo();
    p.takeHomePay = { value: 3_655 + 605.92 + 40, isEstimate: false };
    const s = suggestedPayoffExtra(p, p.debts, { step: 25 });
    expect(s.surplus).toBeCloseTo(40, 6);
    expect(s.extra).toBe(0);
  });

  it('counts each debt\'s own extra payment as already spent', () => {
    const p = cloneProfileDemo();
    const debts = p.debts.map((d) => (d.id === 'auto-1' ? { ...d, extraPayment: 100 } : d));
    const s = suggestedPayoffExtra(p, debts, { step: 25 });
    expect(s.surplus).toBeCloseTo(839.08, 6);
    expect(s.extra).toBe(400); // half of $839.08 is $419.54
  });

  it('never answers with a non-number: a profile whose pay is not a number gets no suggestion', () => {
    const p = cloneProfileDemo();
    p.takeHomePay = { value: Number.NaN, isEstimate: false };
    expect(suggestedPayoffExtra(p, p.debts, { step: 25 }).extra).toBe(0);
  });

  it('rejects a step that is not a positive number, and malformed debts', () => {
    const p = cloneProfileDemo();
    for (const step of [0, -25, Number.NaN, Infinity]) expect(() => suggestedPayoffExtra(p, p.debts, { step })).toThrow(RangeError);
    expect(() => suggestedPayoffExtra(p, [debt('a', 100), debt('a', 200)])).toThrow(RangeError);
  });
});
