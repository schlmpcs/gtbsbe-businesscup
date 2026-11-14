// @vitest-environment jsdom
import { canAfford, inflationAnnualOf } from '@lifeguessr/engine';
import type { Purchase } from '@lifeguessr/types';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { areaByZip, cloneProfileDemo } from '@/fixtures';
import type { ParseFn } from '@/lib/model/useParseConfirm';
import { useAppStore } from '@/state';
import { resetClientState, waitForReady } from '@/test/clientState';
import { purchaseFromForm, useAfford } from './useAfford';

beforeEach(resetClientState);

const rates = { inflationAnnual: inflationAnnualOf(areaByZip('75206')) };

describe('useAfford (S11)', () => {
  it('no result until an amount is entered; then the engine verdict with horizons', async () => {
    const { result } = renderHook(() => useAfford());
    await waitForReady(result);
    expect(result.current.result).toBeNull();
    expect(result.current.invalidFields).toEqual([]);

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
      waitMonths: expected.waitMonths ?? null,
      failsOn: expected.failsOn ?? null,
    });
    expect(r.data.horizons.map((h) => h.month)).toEqual([1, 12, 60, 120]);
    const ten = r.data.horizons[3]!;
    expect(ten.with).toEqual(expected.with.points[120]);
    expect(ten.deltaMid).toBeCloseTo(expected.with.points[120]!.mid - expected.without.points[120]!.mid, 6);
  });

  it('a loan needs APR and term; the form reports the missing fields', async () => {
    const { result } = renderHook(() => useAfford());
    await waitForReady(result);
    act(() => {
      result.current.setAmount(28000);
      result.current.setPayWith('loan');
    });
    expect(result.current.purchase).toBeNull();
    expect(result.current.invalidFields).toEqual(expect.arrayContaining(['loan.apr', 'loan.termMonths']));
    act(() => result.current.setLoan({ apr: 0.069, termMonths: 36 }));
    expect(result.current.purchase?.payWith).toEqual({ loan: { amount: 28000, apr: 0.069, termMonths: 36 } });
    expect(result.current.result?.status).toBe('ready');
  });

  it('blank label falls back to the copy default', () => {
    const { purchase } = purchaseFromForm({ label: ' ', amount: 50, recurring: 'monthly', payWith: 'cash', loan: { apr: null, termMonths: null, downPayment: 0, fees: 0 } });
    expect(purchase).toEqual({ label: 'Purchase', amount: 50, recurring: 'monthly', payWith: 'cash' });
  });

  it('free text fills the form only after confirmation; wishlist round trip', async () => {
    const parsed: Purchase = { label: 'Gym', amount: 60, recurring: 'monthly', payWith: 'card' };
    const parse = vi.fn(async () => ({ value: parsed, inferred: ['recurring'] })) as unknown as ParseFn;
    const { result } = renderHook(() => useAfford({ parse }));
    await waitForReady(result);
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
});
