import { describe, expect, it } from 'vitest';
import { cloneProfileDemo } from '@lifeguessr/data/fixtures';
import { PayoffPlanSchema, type Debt } from '@lifeguessr/types';
import { comparePayoff, extraToFinishBy, payoffOrder, payoffPlan } from './index';
import { PAYOFF_MAX_EXTRA } from '../assumptions';
const debt = (id: string, balance: number, apr = 0, min = 100): Debt => ({ id, kind: 'personal', balance, apr, minPayment: { value: min, isEstimate: false } });

describe('payoff plans', () => {
  it.each([[], [debt('a', 1200)], [debt('a', 0)], cloneProfileDemo().debts,
    [debt('a', 1000, .24, 10)], [debt('a', 1200, .12), { ...debt('b', 500, .12), extraPayment: 50 }]].map(debts => ({ debts })))('preserves the legacy payoff invariant for %j', ({ debts }) => {
    for (const method of ['avalanche', 'snowball'] as const) {
      const plan = payoffPlan(debts, 50, method);
      expect({ order: plan.order, payoffMonth: plan.monthsToDebtFree, totalInterest: plan.totalInterest }).toEqual(payoffOrder(debts, 50, method));
      expect(PayoffPlanSchema.safeParse(plan).success).toBe(true);
    }
  });
  it('has hand-checked zero-interest totals and per-debt payoff dates', () => {
    const plan = payoffPlan([debt('a', 200), debt('b', 400)], 0, 'snowball');
    expect(plan.timeline).toEqual([{month:0,balance:600},{month:1,balance:400},{month:2,balance:200},{month:3,balance:0}]);
    expect(plan.perDebt).toEqual([{id:'a',payoffMonth:2,interest:0},{id:'b',payoffMonth:3,interest:0}]);
    expect(plan.totalPaid).toBe(600);
  });
  it('compares realistic priority strategies and conserves paid principal', () => {
    const debts = [debt('card',6400,.228,180),debt('auto',17800,.065,350)];
    const result = comparePayoff(debts, 200);
    expect(result.avalanche.totalInterest).toBeLessThanOrEqual(result.snowball.totalInterest);
    expect(result.snowball.totalInterest).toBeLessThan(result.minimum.totalInterest);
    for (const p of [result.avalanche,result.snowball,result.minimum]) {
      expect(p.timeline.at(-1)!.balance).toBe(0);
      expect(p.totalPaid - p.totalInterest).toBeCloseTo(24200, 5);
      expect(Math.max(...p.perDebt.map(d=>d.payoffMonth!))).toBe(p.monthsToDebtFree);
      expect(p.timeline.every((v,i,a)=>i===0 || v.balance <= a[i-1]!.balance)).toBe(true);
    }
  });
  it('bounds never-paid plans and reports null month savings', () => {
    const p = payoffPlan([debt('a', 1000, .24, 10)], 0, 'minimum');
    expect(p.monthsToDebtFree).toBeNull();
    expect(p.timeline).toHaveLength(1201);
    expect(p.monthsSavedVsMinimum).toBeNull();
    expect(p.perDebt[0]!.payoffMonth).toBeNull();
  });
  it('returns feasible, monotone target solves, including the cap and already met', () => {
    const debts = [debt('a',1200)];
    expect(extraToFinishBy(debts,12)).toEqual({extra:0,reachable:true});
    const six = extraToFinishBy(debts,6), three = extraToFinishBy(debts,3);
    expect(six.extra).toBeGreaterThanOrEqual(100);
    expect(six.extra).toBeLessThan(101);
    expect(three.extra).toBeGreaterThan(six.extra);
    expect(payoffPlan(debts,six.extra,'avalanche').monthsToDebtFree).toBeLessThanOrEqual(6);
    expect(extraToFinishBy([debt('a',1e9)],1)).toEqual({extra:PAYOFF_MAX_EXTRA,reachable:false});
  });
  it('rejects malformed debts, amounts, methods and horizons', () => {
    expect(()=>payoffPlan([debt('a',NaN)],0,'avalanche')).toThrow(RangeError);
    expect(()=>comparePayoff([],Infinity)).toThrow(RangeError);
    expect(()=>extraToFinishBy([],0)).toThrow(RangeError);
    expect(PayoffPlanSchema.safeParse({...payoffPlan([],0,'minimum'),totalPaid:-1}).success).toBe(false);
    expect(PayoffPlanSchema.safeParse({...payoffPlan([],0,'minimum'),totalInterest:Infinity}).success).toBe(false);
  });
});
