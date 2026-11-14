// @vitest-environment jsdom
import { compareLoans, loan } from '@lifeguessr/engine';
import type { LoanInput } from '@lifeguessr/types';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cloneProfileDemo, loanOffersSample } from '@/fixtures';
import { areaRates } from '@/lib/model/profile';
import type { ParseFn } from '@/lib/model/useParseConfirm';
import { resetClientState, waitForReady } from '@/test/clientState';
import { DEBT_LOAD_GAUGE_MAX, MAX_OFFERS, useLoanLab } from './useLoanLab';

beforeEach(resetClientState);

describe('useLoanLab (S12)', () => {
  it('compares the 3 fixture offers with the engine and flags the cheapest', async () => {
    const { result } = renderHook(() => useLoanLab());
    await waitForReady(result);
    const expected = compareLoans(cloneProfileDemo(), [...loanOffersSample], { rates: areaRates(cloneProfileDemo()) });
    expect(result.current.offers.map((o) => o.result)).toEqual(expected);
    expect(result.current.offers[0]!.result!.monthly).toBeCloseTo(863.28, 2); // ENGINEERING.md known value
    const minCost = Math.min(...expected.map((r) => r.totalCost));
    expect(result.current.offers.filter((o) => o.isLowestCost).map((o) => o.result!.totalCost)).toEqual([minCost]);
    expect(result.current.canAddOffer).toBe(false);
    expect(result.current.addOffer()).toBeNull();
    expect(result.current.offers).toHaveLength(MAX_OFFERS);

    const g = result.current.gauge;
    expect(g.before.value).toBeCloseTo((193.92 + 412) / 5200, 6);
    expect(g.after!.value).toBeCloseTo(expected[0]!.debtLoadAfter, 6);
    expect(g.after!.zone).toBe('yellow'); // (605.92 + 863.28) / 5200 ≈ 0.28
    expect(g.isEstimate).toBe(true);
    expect(g.max).toBe(DEBT_LOAD_GAUGE_MAX);
    expect(g.max).toBeGreaterThan(g.before.thresholds.red);
  });

  it('extra-payment slider shortens the payoff of the selected offer', async () => {
    const { result } = renderHook(() => useLoanLab());
    await waitForReady(result);
    expect(result.current.extra).toMatchObject({ value: 0, min: 0, interestSaved: 0, monthsSaved: 0 });
    act(() => result.current.setExtraPayment(210)); // snaps to $25 steps
    const e = result.current.extra!;
    expect(e.value).toBe(200);
    const withExtra = loan(cloneProfileDemo(), { ...loanOffersSample[0]!, extraPayment: 200 }, { rates: areaRates(cloneProfileDemo()) });
    expect(e.payoffMonth).toBe(withExtra.payoffMonth);
    expect(e.basePayoffMonth).toBe(36);
    expect(e.monthsSaved).toBe(36 - withExtra.payoffMonth!);
    expect(e.interestSaved).toBeGreaterThan(0);
  });

  it('edits, removes and adds offers; invalid input shows the fields, not a result', async () => {
    const { result } = renderHook(() => useLoanLab());
    await waitForReady(result);
    const id = result.current.offers[1]!.id;
    act(() => result.current.updateOffer(id, { apr: 6.9 })); // a percent, not a decimal: invalid
    const bad = result.current.offers.find((o) => o.id === id)!;
    expect(bad.result).toBeNull();
    expect(bad.invalidFields).toEqual(['apr']);
    act(() => result.current.removeOffer(id));
    expect(result.current.offers).toHaveLength(2);
    expect(result.current.canAddOffer).toBe(true);
    act(() => {
      result.current.addOffer({ amount: 20000, apr: 0.05, termMonths: 48 });
    });
    expect(result.current.offers).toHaveLength(3);
    expect(result.current.selectedOfferId).toBe(result.current.offers[2]!.id);
  });

  it('parsed offer text is added after confirmation', async () => {
    const parsed: LoanInput = { amount: 15000, apr: 0.0799, termMonths: 60 };
    const parse = vi.fn(async () => ({ value: parsed, inferred: [] })) as unknown as ParseFn;
    const { result } = renderHook(() => useLoanLab({ parse, initialOffers: [loanOffersSample[0]!] }));
    await waitForReady(result);
    act(() => result.current.parse.setText('15k at 7.99% for 5 years'));
    act(() => result.current.parse.submit());
    await waitFor(() => expect(result.current.parse.status).toBe('confirming'));
    expect(result.current.offers).toHaveLength(1);
    act(() => result.current.parse.confirm());
    expect(result.current.offers.map((o) => o.input)).toEqual([loanOffersSample[0], parsed]);
  });
});
