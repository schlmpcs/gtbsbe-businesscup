// S13 carDecision: keep the car or switch. Checked against the engine's own forecast and loan math.
import { describe, expect, it } from 'vitest';
import { cloneProfileDemo, profileDemo } from '@lifeguessr/data/fixtures';
import { carDecision, carLoanPaymentTooLow, type CarNow } from './car';
import { forecast } from './forecast';
import { amortizedPayment } from './loan/amortize';
import { simulate } from './simulate';

const demoCar: CarNow = { value: 0, loanBalance: 17_800, loanPayment: 412, loanApr: 0.074, running: 310 };
const paidOff: CarNow = { value: 0, loanBalance: 0, loanPayment: 0, loanApr: 0, running: 300 };

describe('carDecision', () => {
  it('keeping the demo car (no car value) is the plain forecast: same net worth in 10 years, same payoff month', () => {
    const r = carDecision(profileDemo, demoCar, { kind: 'noCar', monthly: 100 });
    const f = forecast(profileDemo, 10, { todaysDollars: true });
    expect(r.keep.netWorth).toBeCloseTo(f.in10y.mid, 6);
    expect(r.keep.payoffMonth).toBe(simulate(profileDemo, 120).payoffMonth['auto-1']);
    expect(r.years).toHaveLength(11);
    expect(r.years.map((y) => y.year)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(r.keep.costNow).toEqual({ payment: 412, running: 310, signing: 0, total: 722 });
    expect(r.keep.costAfterPayoff.total).toBe(310);
  });

  it('both lines start at today’s net worth', () => {
    const car: CarNow = { value: 19_500, loanBalance: 17_800, loanPayment: 412, loanApr: 0.074, running: 310 };
    for (const alt of [
      { kind: 'lease', monthly: 489, termMonths: 36, dueAtSigning: 3000, running: 280 },
      { kind: 'buy', price: 28_000, downPayment: 3000, apr: 0.08, termMonths: 60, running: 310 },
      { kind: 'noCar', monthly: 200 },
    ] as const) {
      const r = carDecision(profileDemo, car, alt);
      expect(r.years[0]!.alternative).toBe(r.years[0]!.keep);
      expect(r.tradeInEquity).toBe(1700);
    }
  });

  it('the same costs on both paths give the same result; cheaper going gives the alternative the lead', () => {
    const same = carDecision(profileDemo, paidOff, { kind: 'noCar', monthly: 300 });
    expect(same.difference).toBeCloseTo(0, 6);
    expect(same.isClose).toBe(true);
    const cheaper = carDecision(profileDemo, paidOff, { kind: 'noCar', monthly: 100 });
    expect(cheaper.better).toBe('alternative');
    expect(cheaper.difference).toBeLessThan(0);
    expect(cheaper.isClose).toBe(false);
    // Each line only moves with its own costs.
    expect(cheaper.keep.netWorth).toBeCloseTo(same.keep.netWorth, 6);
    expect(cheaper.alternative.netWorth).toBeGreaterThan(same.alternative.netWorth);
  });

  it('a car loses value while the cash from selling it does not', () => {
    const r = carDecision(profileDemo, { ...paidOff, value: 10_000 }, { kind: 'noCar', monthly: 300 });
    expect(r.tradeInEquity).toBe(10_000);
    expect(r.better).toBe('alternative');
    expect(r.alternative.netWorth - r.keep.netWorth).toBeGreaterThan(5000);
  });

  it('a lease is signed every term; its signing cost is spread over the term in the monthly cost', () => {
    const r = carDecision(profileDemo, demoCar, { kind: 'lease', monthly: 489, termMonths: 36, dueAtSigning: 3000, running: 280 });
    expect(r.alternative.signings).toBe(4); // months 0, 36, 72, 108
    expect(r.alternative.costNow.signing).toBeCloseTo(3000 / 36, 9);
    expect(r.alternative.costNow.total).toBeCloseTo(489 + 280 + 3000 / 36, 9);
    // A dearer lease leaves less.
    const dearer = carDecision(profileDemo, demoCar, { kind: 'lease', monthly: 689, termMonths: 36, dueAtSigning: 3000, running: 280 });
    expect(dearer.alternative.netWorth).toBeLessThan(r.alternative.netWorth);
    expect(dearer.keep.netWorth).toBeCloseTo(r.keep.netWorth, 6);
  });

  it('a new car on a loan: amortized payment, the down payment up front', () => {
    const r = carDecision(profileDemo, demoCar, { kind: 'buy', price: 28_000, downPayment: 3000, apr: 0.08, termMonths: 60, running: 310 });
    expect(r.alternative.costNow.payment).toBeCloseTo(amortizedPayment(25_000, 0.08, 60), 9);
    expect(r.alternative.upfront).toBe(3000);
    expect(r.alternative.signings).toBe(0);
  });

  it('a loan larger than the car is paid from cash at the trade-in', () => {
    const under = carDecision(profileDemo, { ...demoCar, value: 5000 }, { kind: 'noCar', monthly: 310 });
    const even = carDecision(profileDemo, { ...demoCar, value: 17_800 }, { kind: 'noCar', monthly: 310 });
    expect(under.tradeInEquity).toBe(-12_800);
    expect(even.alternative.netWorth - under.alternative.netWorth).toBeGreaterThan(12_800);
  });

  it('rejects inputs that make no sense; flags a payment below the interest', () => {
    const p = cloneProfileDemo();
    expect(() => carDecision(p, { ...demoCar, value: -1 }, { kind: 'noCar', monthly: 0 })).toThrow(RangeError);
    expect(() => carDecision(p, demoCar, { kind: 'lease', monthly: 1, termMonths: 0, dueAtSigning: 0, running: 0 })).toThrow(RangeError);
    expect(() => carDecision(p, demoCar, { kind: 'buy', price: 10, downPayment: 20, apr: 0.05, termMonths: 60, running: 0 })).toThrow(RangeError);
    expect(() => carDecision(p, { ...demoCar, loanApr: 5 }, { kind: 'noCar', monthly: 0 })).toThrow(RangeError);
    expect(carLoanPaymentTooLow({ loanBalance: 20_000, loanPayment: 100, loanApr: 0.1 })).toBe(true);
    expect(carLoanPaymentTooLow(demoCar)).toBe(false);
    expect(carLoanPaymentTooLow({ loanBalance: 0, loanPayment: 0, loanApr: 0.1 })).toBe(false);
  });
});
