// @vitest-environment jsdom
import { affordComfort, canAfford, comfortableCushionMonths, debtLoadThresholds, inflationAnnualOf, safetyCushionMonths } from '@lifeguessr/engine';
import { COST_CATEGORIES, type CostCategory, type Profile, type Purchase } from '@lifeguessr/types';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getArea } from '@lifeguessr/data/areas';
import { cloneProfileDemo } from '@/fixtures';
import type { ParseFn } from '@/lib/model/useParseConfirm';
import { useAppStore, useProStore } from '@/state';
import { resetClientState, waitForReady } from '@/test/clientState';
import { fakeProAdapter, PRO_DEMO, resetProState, statusInfo } from '@/test/pro';
import { affordGoalEffect, purchaseFromForm, useAfford } from './useAfford';

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
    expect(result.current.rules).toEqual({
      cushionMonths: safetyCushionMonths.value,
      debtLoadRed: debtLoadThresholds.value.red,
      debtLoadYellow: debtLoadThresholds.value.yellow,
      comfortableCushionMonths: comfortableCushionMonths.value,
    });

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
    // The comfort tier and its numbers are the engine's affordComfort on the same purchase and rates.
    const comfort = affordComfort(cloneProfileDemo(), purchase, expected.verdict, { rates });
    expect(r.data).toMatchObject({
      tier: comfort.tier,
      stretchedBy: comfort.stretchedBy,
      cushion: { before: comfort.cushionMonthsBefore, after: comfort.cushionMonthsAfter },
      debtLoad: { before: comfort.debtLoadBefore, after: comfort.debtLoadAfter },
    });
    // The chart: one point a year, today to year 10, read off the same with / without forecasts.
    expect(r.data.chart.map((p) => p.year)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(r.data.chart[10]).toEqual({ year: 10, with: expected.with.points[120]!.mid, without: expected.without.points[120]!.mid });
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
    expect(r.data.cheapestWayFits).toBe(expected.cheapestWayFits);
    expect(r.data.goalEffect).toBeNull(); // no goal set
  });

  it('with a goal set, the result says when the goal is reached with the purchase', async () => {
    act(() => useAppStore.getState().setGoal({ target: 100_000, years: 10 }));
    const { result } = renderHook(() => useAfford());
    await waitForReady(result);
    act(() => result.current.setAmount(1200));
    const r = result.current.result!;
    if (r.status !== 'ready') throw new Error('not ready');
    expect(r.data.goalEffect).not.toBeNull();
    expect(r.data.goalEffect!.target).toBe(100_000);
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

describe('affordGoalEffect', () => {
  it('hand-checked: reached 3 months later, still within the goal year', () => {
    // No growth: net worth = 5,000 + 1,000·m. $10,000 in month 5 without; after a $2,500 cash
    // purchase 2,500 + 1,000·m ≥ 10,000 in month 8. From mid-November 2026 (month index 10),
    // month 8 lands in 2026 + floor((10 + 8) / 12) = 2027; 8 ≤ 12 months, so on time.
    const spending = Object.fromEntries(
      COST_CATEGORIES.map((c) => [c, { value: c === 'other' ? 4000 : 0, isEstimate: false }]),
    ) as Record<CostCategory, { value: number; isEstimate: boolean }>;
    const p: Profile = {
      age: { value: 30, isEstimate: false },
      takeHomePay: { value: 5000, isEstimate: false },
      spending,
      cash: { value: 5000, isEstimate: false },
      retirement: { value: 0, isEstimate: false },
      retirementShare: { value: 0, isEstimate: false },
      debts: [],
      doneMoveIds: [],
    };
    const zero = { inflationAnnual: 0, cashYieldAnnual: 0, returnAnnualNominal: 0 };
    const buy: Purchase = { label: 'Car', amount: 2500, recurring: false, payWith: 'cash' };
    expect(affordGoalEffect(p, { target: 10_000, years: 1 }, buy, zero, new Date(2026, 10, 15))).toEqual({
      target: 10_000,
      reachYear: 2027,
      delayMonths: 3,
      onTime: true,
    });
  });
});
