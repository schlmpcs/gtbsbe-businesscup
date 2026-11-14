// @vitest-environment jsdom
import { canAfford, debtLoadThresholds, inflationAnnualOf, safetyCushionMonths } from '@lifeguessr/engine';
import type { Purchase } from '@lifeguessr/types';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getArea } from '@lifeguessr/data/areas';
import { cloneProfileDemo } from '@/fixtures';
import type { ParseFn } from '@/lib/model/useParseConfirm';
import { useAppStore, useProStore } from '@/state';
import { resetClientState, waitForReady } from '@/test/clientState';
import { fakeProAdapter, PRO_DEMO, resetProState, statusInfo } from '@/test/pro';
import { purchaseFromForm, useAfford } from './useAfford';

beforeEach(() => {
  resetClientState();
  resetProState();
});

const rates = { inflationAnnual: inflationAnnualOf(getArea('75206')) };

describe('useAfford (S11)', () => {
  it('no result until an amount is entered; then the engine verdict with horizons', async () => {
    const { result } = renderHook(() => useAfford());
    await waitForReady(result);
    expect(result.current.result).toBeNull();
    expect(result.current.invalidFields).toEqual([]);
    expect(result.current.rules).toEqual({ cushionMonths: safetyCushionMonths.value, debtLoadRed: debtLoadThresholds.value.red });

    act(() => {
      result.current.setLabel('Laptop');
      result.current.setAmount(1200);
      result.current.setPayWith('card');
    });
    const purchase: Purchase = { label: 'Laptop', amount: 1200, recurring: false, payWith: 'card' };
    expect(result.current.purchase).toEqual(purchase);
    const expected = canAfford(cloneProfileDemo(), purchase, { rates });
    const r = result.current.result!;
    expect(r.status).toBe('ready');
    if (r.status !== 'ready') return;
    expect(r.data).toMatchObject({
      verdict: expected.verdict,
      baselineFails: expected.baselineFails,
      cheapestWay: expected.cheapestWay,
      todaysDollars: false,
      forecastSource: 'rules',
      waitMonths: expected.waitMonths ?? null,
      failsOn: expected.failsOn ?? null,
    });
    expect(r.data.horizons.map((h) => h.month)).toEqual([1, 12, 60, 120]);
    // $1,200 at $5,200/month over 40-hour weeks ($30/h) = 40 h = 5 days → 1 week of work.
    expect(r.data.workTime).toEqual({ unit: 'weeks', amount: 1, per: false, hoursPerWeek: 40, isEstimate: false });
    const ten = r.data.horizons[3]!;
    expect(ten.with).toEqual(expected.with.points[120]);
    expect(ten.deltaMid).toBeCloseTo(expected.with.points[120]!.mid - expected.without.points[120]!.mid, 6);
  });

  it('a loan starts on the typical terms for its kind, tagged estimate; typed terms replace them', async () => {
    const { result } = renderHook(() => useAfford());
    await waitForReady(result);
    act(() => {
      result.current.setLabel('Used car');
      result.current.setAmount(28000);
      result.current.setPayWith('loan');
    });
    // A car: 8% over 72 months (loanTermsTypical.auto). A verdict with nothing typed and no errors.
    expect(result.current.purchase?.payWith).toEqual({ loan: { amount: 28000, apr: 0.08, termMonths: 72 } });
    expect(result.current.invalidFields).toEqual([]);
    expect(result.current.result?.status).toBe('ready');
    expect(result.current.form.loan).toMatchObject({ apr: 0.08, termMonths: 72 });
    expect(result.current.loanEstimate).toMatchObject({ kind: 'auto', apr: true, termMonths: true, source: { year: 2025 } });

    // Anything else is a personal loan: 12% over 24 months.
    act(() => result.current.setLabel('Couch'));
    expect(result.current.purchase?.payWith).toEqual({ loan: { amount: 28000, apr: 0.12, termMonths: 24 } });
    expect(result.current.loanEstimate?.kind).toBe('personal');

    act(() => result.current.setLoan({ apr: 0.069 }));
    expect(result.current.purchase?.payWith).toEqual({ loan: { amount: 28000, apr: 0.069, termMonths: 24 } });
    expect(result.current.loanEstimate).toMatchObject({ apr: false, termMonths: true });
    act(() => result.current.setLoan({ termMonths: 36 }));
    expect(result.current.purchase?.payWith).toEqual({ loan: { amount: 28000, apr: 0.069, termMonths: 36 } });
    expect(result.current.loanEstimate).toBeNull();

    // A typed field that is emptied stays empty and is flagged (no snapping back to the typical value).
    act(() => result.current.setLoan({ apr: null }));
    expect(result.current.purchase).toBeNull();
    expect(result.current.invalidFields).toEqual(['loan.apr']);
  });

  it('a loan from a saved or parsed purchase keeps its own terms: nothing is typical', () => {
    const { purchase } = purchaseFromForm({
      label: 'Car', amount: 20000, recurring: false, payWith: 'loan', loan: { apr: 0.05, termMonths: 60, downPayment: 0, fees: 0 },
    });
    expect(purchase?.payWith).toEqual({ loan: { amount: 20000, apr: 0.05, termMonths: 60 } });
  });

  it('blank label falls back to the copy default', () => {
    const { purchase } = purchaseFromForm({ label: ' ', amount: 50, recurring: 'monthly', payWith: 'cash', loan: { apr: null, termMonths: null, downPayment: 0, fees: 0 } });
    expect(purchase).toEqual({ label: 'Purchase', amount: 50, recurring: 'monthly', payWith: 'cash' });
  });

  it('free text fills the form only after confirmation; wishlist round trip', async () => {
    const parsed: Purchase = { label: 'Gym', amount: 60, recurring: 'monthly', payWith: 'card' };
    const parse = vi.fn(async () => ({ value: parsed, inferred: ['recurring'] })) as unknown as ParseFn;
    resetProState(fakeProAdapter(statusInfo(PRO_DEMO)));
    const { result } = renderHook(() => useAfford({ parse }));
    await waitForReady(result);
    await waitFor(() => expect(result.current.wishlistLocked).toBe(false));
    act(() => result.current.parse.setText('gym 60 a month on my card'));
    act(() => result.current.parse.submit());
    await waitFor(() => expect(result.current.parse.status).toBe('confirming'));
    expect(result.current.parse.inferred).toEqual(['recurring']);
    expect(result.current.form.amount).toBeNull();
    act(() => result.current.parse.confirm());
    expect(result.current.purchase).toEqual(parsed);

    let id: string | null = null;
    act(() => {
      id = result.current.addToWishlist();
    });
    expect(useAppStore.getState().wishlist.map((w) => w.purchase)).toEqual([parsed]);
    act(() => result.current.setAmount(null));
    act(() => result.current.loadFromWishlist(id!));
    expect(result.current.purchase).toEqual(parsed);
    act(() => result.current.removeFromWishlist(id!));
    expect(result.current.wishlist).toEqual([]);
  });

  it('saving to the wishlist is locked until Pro; saved items stay usable', async () => {
    const saved: Purchase = { label: 'Bike', amount: 900, recurring: false, payWith: 'cash' };
    const savedId = useAppStore.getState().addToWishlist(saved);
    const { result } = renderHook(() => useAfford());
    await waitForReady(result);
    await waitFor(() => expect(useProStore.getState().load).toBe('ready'));
    expect(result.current.wishlistLocked).toBe(true);
    expect(result.current.proHref).toBe('/pro');

    act(() => result.current.setAmount(1200));
    let id: string | null = 'not called';
    act(() => {
      id = result.current.addToWishlist();
    });
    expect(id).toBeNull();
    expect(result.current.wishlist.map((w) => w.purchase)).toEqual([saved]);

    act(() => result.current.loadFromWishlist(savedId));
    expect(result.current.purchase).toEqual(saved);
    act(() => result.current.removeFromWishlist(savedId));
    expect(result.current.wishlist).toEqual([]);
  });
});
