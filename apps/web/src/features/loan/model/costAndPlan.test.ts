// @vitest-environment jsdom
// Loan Lab's answer card and "Add to my plan": the cost parts, the best offer, the balance curve, the plan event.
import { compareLoans, expenseFinancingBreakdown, loan } from '@lifeguessr/engine';
import type { PlanEventOf } from '@lifeguessr/types';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { cloneProfileDemo, loanOffersSample } from '@/fixtures';
import { areaRates } from '@/lib/model/profile';
import { resetClientState, waitForReady } from '@/test/clientState';
import { planEventFromOffer } from './planEvent';
import { bestOffer, useLoanLab } from './useLoanLab';

beforeEach(resetClientState);

describe('Loan Lab answer', () => {
  it('splits each total into price, interest and fees, and names the cheapest against the next', async () => {
    const { result } = renderHook(() => useLoanLab());
    await waitForReady(result);
    const expected = compareLoans(cloneProfileDemo(), [...loanOffersSample], { rates: areaRates(cloneProfileDemo()) });
    result.current.offers.forEach((o, i) => {
      const c = o.cost!;
      expect(c).toEqual({ price: loanOffersSample[i]!.amount, interest: expected[i]!.totalInterest, fees: loanOffersSample[i]!.fees ?? 0 });
      expect(c.price + c.interest + c.fees).toBeCloseTo(expected[i]!.totalCost, 6);
    });
    expect(result.current.costScale).toBe(Math.max(...expected.map((r) => r.totalCost)));
    const sorted = [...expected].sort((a, b) => a.totalCost - b.totalCost);
    expect(result.current.best).toMatchObject({ index: 1, totalCost: sorted[0]!.totalCost });
    expect(result.current.best!.runnerUp!.costsMore).toBeCloseTo(sorted[1]!.totalCost - sorted[0]!.totalCost, 6);
  });

  it('bestOffer needs two valid offers; ties go to the earlier offer', () => {
    const vm = (id: string, totalCost: number | null) =>
      ({ id, result: totalCost === null ? null : { totalCost } }) as Parameters<typeof bestOffer>[0][number];
    expect(bestOffer([vm('a', 100)])).toBeNull();
    expect(bestOffer([vm('a', 100), vm('b', null)])).toBeNull();
    expect(bestOffer([vm('a', 200), vm('b', 200)])).toMatchObject({ id: 'a', runnerUp: { id: 'b', costsMore: 0 } });
    expect(bestOffer([vm('a', 300), vm('b', null), vm('c', 250)])).toMatchObject({ id: 'c', index: 3, runnerUp: { id: 'a', index: 1, costsMore: 50 } });
  });

  it('the balance curve is the engine schedule from the financed principal, and shortens with the extra payment', async () => {
    const { result } = renderHook(() => useLoanLab());
    await waitForReady(result);
    const chart = result.current.balanceChart!;
    const a = loanOffersSample[0]!;
    expect(chart.base[0]).toEqual({ month: 0, balance: a.amount - (a.downPayment ?? 0) + (a.fees ?? 0) });
    expect(chart.base).toHaveLength(37);
    expect(chart.withExtra).toBeNull();
    act(() => result.current.setExtraPayment(200));
    const withExtra = loan(cloneProfileDemo(), { ...a, extraPayment: 200 }, { rates: areaRates(cloneProfileDemo()) });
    expect(result.current.balanceChart!.withExtra!.at(-1)!.month).toBe(withExtra.payoffMonth);
    expect(result.current.balanceChart!.withExtra!.length).toBeLessThan(chart.base.length);
  });
});

describe('planEventFromOffer', () => {
  it('finances exactly what the loan math finances', () => {
    const offer = { amount: 28_000, apr: 0.0549, termMonths: 60, downPayment: 3000, fees: 495 };
    const draft = planEventFromOffer(offer, 'Loan (Offer B)');
    expect(draft).toEqual({
      type: 'expense', name: 'Loan (Offer B)', amount: 28_495, cadence: 'once',
      financing: { downPayment: 3000, apr: 0.0549, termMonths: 60 },
    });
    const b = expenseFinancingBreakdown({ ...draft, id: 'e', year: 2026, enabled: true } as PlanEventOf<'expense'>)!;
    const l = loan(cloneProfileDemo(), offer);
    expect(b.financed).toBe(28_000 - 3000 + 495);
    expect(b.monthlyPayment).toBeCloseTo(l.monthly, 6);
  });
});
