// @vitest-environment jsdom
import { cardToProfile, costOfLife } from '@lifeguessr/engine';
import { COST_CATEGORIES, type CategoryTotals, type CostCategory } from '@lifeguessr/types';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFixtureGameClient } from '@/features/game/model/client';
import { areaByZip, cardById, cardsSample } from '@/fixtures';
import type { ParseFn } from '@/lib/model/useParseConfirm';
import { useAppStore, useGameStore } from '@/state';
import { resetClientState, waitForReady } from '@/test/clientState';
import { useBalanceSheet } from './useBalanceSheet';
import { useClosestLife } from './useClosestLife';
import { useGuessYourself } from './useGuessYourself';
import { useQuickSliders } from './useQuickSliders';
import { useStatementUpload } from './useStatementUpload';

beforeEach(resetClientState);

const totals = (over: Partial<Record<CostCategory, number>>) =>
  Object.fromEntries(COST_CATEGORIES.map((c) => [c, over[c] ?? 0])) as Record<CostCategory, number>;

describe('useGuessYourself (S5)', () => {
  it('saves the slider value as the self guess and summarizes today’s game', async () => {
    const client = createFixtureGameClient({ persist: false });
    const { cards } = await client.daily('2026-11-14');
    useGameStore.getState().startDay('2026-11-14', cards);
    useGameStore.getState().setGuess(cards[0]!.id, 1000);
    useGameStore.getState().setReveal(cards[0]!.id, await client.guess(cards[0]!.id, 1000));

    const { result } = renderHook(() => useGuessYourself());
    await waitForReady(result);
    expect(result.current.savedGuess).toBeNull();
    expect(result.current.bridge).toEqual({ played: 1, guessedLow: 1, guessedHigh: 0 });
    act(() => result.current.setGuess(4567));
    expect(result.current.guess.value).toBe(4570);
    act(() => result.current.submit());
    expect(useAppStore.getState().selfGuess).toBe(4570);
    expect(result.current.savedGuess).toBe(4570);
  });
});

describe('useClosestLife (S6)', () => {
  it('offers sample lives when the game was not played, nearest to the self guess first', async () => {
    useAppStore.getState().setSelfGuess(4000);
    const { result } = renderHook(() => useClosestLife());
    await waitForReady(result);
    const { candidates } = result.current;
    expect(candidates).toHaveLength(cardsSample.length);
    expect(candidates.every((c) => !c.fromToday && c.available)).toBe(true);
    const dist = (mid: number) => Math.abs(Math.log(mid / 4000));
    expect(dist(candidates[0]!.monthly.mid)).toBeLessThanOrEqual(dist(candidates[1]!.monthly.mid));
    expect(result.current.nearestCardId).toBe(candidates[0]!.cardId);
    const card = cardById(candidates[0]!.cardId);
    expect(candidates[0]!.monthly).toEqual(costOfLife(card, areaByZip(card.zip)).total);
  });

  it('choose builds the profile with cardToProfile', async () => {
    const { result } = renderHook(() => useClosestLife());
    await waitForReady(result);
    const id = cardsSample[3]!.id;
    act(() => result.current.choose(id));
    const card = cardById(id);
    expect(useAppStore.getState().profile).toEqual(cardToProfile(card, areaByZip(card.zip)));
    expect(useAppStore.getState().profileOrigin).toBe('closestLife');
    expect(result.current.chosenCardId).toBe(id);
  });
});

describe('useQuickSliders (S7)', () => {
  it('sliders patch spending as measured values and the month updates from the engine', async () => {
    const { result } = renderHook(() => useQuickSliders());
    await waitForReady(result);
    const eat = result.current.sliders.find((s) => s.category === 'eatingOut')!;
    expect(eat).toMatchObject({ value: 340, isEstimate: true, min: 0, max: 1500 });
    const before = result.current.month.spending;
    const in10yBefore = result.current.in10y.mid;

    act(() => result.current.setSpending('eatingOut', 143));
    const after = result.current.sliders.find((s) => s.category === 'eatingOut')!;
    expect(after).toMatchObject({ value: 140, isEstimate: false });
    expect(result.current.month.spending).toBeCloseTo(before - 200, 6);
    expect(result.current.in10y.mid).toBeGreaterThan(in10yBefore);
    expect(result.current.monthlyCost).toBeCloseTo(result.current.month.spending + result.current.month.debtPayments, 6);

    act(() => result.current.setSavingsShare(0.123));
    expect(result.current.savings).toMatchObject({ value: 0.12, isEstimate: false });
  });

  it('free text: parse, show for confirmation, apply only on confirm', async () => {
    const parse = vi.fn(async () => ({ value: { spending: { rentUtilities: 1800 } }, inferred: [] })) as unknown as ParseFn;
    const { result } = renderHook(() => useQuickSliders({ parse }));
    await waitForReady(result);
    act(() => result.current.parse.setText('rent is 1800'));
    act(() => result.current.parse.submit());
    await waitFor(() => expect(result.current.parse.status).toBe('confirming'));
    expect(result.current.parse.parsed).toEqual({ spending: { rentUtilities: 1800 } });
    expect(useAppStore.getState().profile.spending.rentUtilities.value).toBe(1950); // not yet
    act(() => result.current.parse.confirm());
    expect(useAppStore.getState().profile.spending.rentUtilities).toEqual({ value: 1800, isEstimate: false });
    expect(result.current.parse.status).toBe('idle');
    expect(parse).toHaveBeenCalledWith('life', 'rent is 1800', expect.objectContaining({ debts: expect.any(Array) }));
  });
});

describe('useBalanceSheet (S8)', () => {
  it('typed fields are measured, skipped ones estimates; debts and debt load from the engine', async () => {
    const { result } = renderHook(() => useBalanceSheet());
    await waitForReady(result);
    expect(result.current.fields.age).toEqual({ value: 32, isEstimate: false });
    expect(result.current.netWorth).toBeCloseTo(3800 + 14500 - 6400 - 17800, 6);
    // (193.92 + 412) / 5200 ≈ 0.1165 → green
    expect(result.current.debtLoad.value).toBeCloseTo((193.92 + 412) / 5200, 2);
    expect(result.current.debtLoad.zone).toBe('green');

    act(() => result.current.setField('retirement', 20000));
    expect(result.current.fields.retirement).toEqual({ value: 20000, isEstimate: false });
    act(() => result.current.skipField('cash'));
    expect(result.current.fields.cash).toEqual({ value: 3800, isEstimate: true });

    let id = '';
    act(() => {
      id = result.current.addDebt({ kind: 'student', balance: 30000, apr: 0.05, minPayment: 900 });
    });
    expect(result.current.debts.find((d) => d.id === id)).toMatchObject({ kind: 'student', minPayment: 900, minPaymentIsEstimate: false });
    // (193.92 + 412 + 900) / 5200 ≈ 0.29 → yellow (0.20–0.36)
    expect(result.current.debtLoad.value).toBeCloseTo(1505.92 / 5200, 2);
    expect(result.current.debtLoad.zone).toBe('yellow');
  });
});

describe('useStatementUpload (S9)', () => {
  const months: CategoryTotals[] = [
    { month: '2026-08', totals: totals({ groceries: 500, subscriptions: 30 }), oneOffs: [], detectedPay: 5400 },
    { month: '2026-09', totals: totals({ groceries: 600, subscriptions: 30 }), oneOffs: [{ label: 'SOFA', amount: 800 }] },
    { month: '2026-10', totals: totals({ groceries: 700, subscriptions: 30 }), oneOffs: [] },
  ];

  it('review then apply merges totals as measured values', async () => {
    const { result } = renderHook(() => useStatementUpload());
    await waitForReady(result);
    expect(result.current.status).toBe('idle');
    act(() => result.current.submitTotals([months[2]!, months[0]!, months[1]!]));
    expect(result.current.status).toBe('review');
    expect(result.current.pending.map((m) => m.month)).toEqual(['2026-08', '2026-09', '2026-10']);
    expect(result.current.pending[0]!.total).toBe(530);
    expect(result.current.whatWeKeep).toMatchObject({ months: ['2026-08', '2026-09', '2026-10'], takeHomePay: true });
    expect(useAppStore.getState().statementMonths).toEqual([]); // nothing until apply

    act(() => result.current.apply());
    expect(result.current.status).toBe('applied');
    expect(result.current.history).toEqual(['2026-08', '2026-09', '2026-10']);
    expect(result.current.hasDriftHistory).toBe(true);
    const p = useAppStore.getState().profile;
    expect(p.spending.groceries).toEqual({ value: 600, isEstimate: false });
    expect(p.takeHomePay).toEqual({ value: 5400, isEstimate: false });
    expect(useAppStore.getState().subscriptionsDetected).toBe(true);
  });

  it('rejects malformed totals', async () => {
    const { result } = renderHook(() => useStatementUpload());
    await waitForReady(result);
    act(() => result.current.submitTotals([{ month: 'Oct', totals: {}, oneOffs: [] } as unknown as CategoryTotals]));
    expect(result.current.status).toBe('error');
    expect(result.current.error).toEqual({ kind: 'badInput' });
  });
});
