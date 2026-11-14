// @vitest-environment jsdom
import {
  applyPatch, cardAprDefault, estimateSpread, forecast, inflationAnnualFallback, inflationAnnualOf, monthEnd, rankMoves,
  returnAnnualNominal,
} from '@lifeguessr/engine';
import { COST_CATEGORIES, type CostCategory } from '@lifeguessr/types';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/http';
import { getArea } from '@lifeguessr/data/areas';
import { cloneProfileDemo } from '@/fixtures';
import { useAppStore } from '@/state';
import { resetClientState, waitForReady } from '@/test/clientState';
import { howWeCalculate } from './howWeCalculate';
import { useFuture } from './useFuture';
import { moveTarget } from './useNextMoves';
import { useToday } from './useToday';

beforeEach(resetClientState);

const rates = { inflationAnnual: inflationAnnualOf(getArea('75206')) };
const totals = (over: Partial<Record<CostCategory, number>>) =>
  Object.fromEntries(COST_CATEGORIES.map((c) => [c, over[c] ?? 0])) as Record<CostCategory, number>;

describe('useFuture (S10)', () => {
  it('shows the engine forecast in today’s dollars with area inflation and the band inputs', async () => {
    const { result } = renderHook(() => useFuture());
    await waitForReady(result);
    const expected = forecast(cloneProfileDemo(), 10, { todaysDollars: true, rates });
    expect(result.current.status).toBe('ready');
    expect(result.current.in10y).toEqual(expected.in10y);
    expect(result.current.points).toHaveLength(121);
    expect(result.current.yearly.map((p) => p.month)).toEqual([0, 12, 24, 36, 48, 60, 72, 84, 96, 108, 120]);
    expect(result.current.band.isZero).toBe(false);
    expect(result.current.band.estimatedFields).toContainEqual({ field: 'spending', category: 'eatingOut' });
    expect(result.current.band.estimatedFields).toContainEqual({ field: 'debtMinPayment', debtId: 'card-1' });

    act(() => result.current.setTodaysDollars(false));
    expect(result.current.in10y).toEqual(forecast(cloneProfileDemo(), 10, { rates }).in10y);
  });

  it('ranks moves with the same rates, commits, and marks done', async () => {
    const { result } = renderHook(() => useFuture());
    await waitForReady(result);
    const expected = rankMoves(cloneProfileDemo(), { rates });
    expect(result.current.moves.status).toBe('ready');
    if (result.current.moves.status !== 'ready') return;
    expect(result.current.moves.data.map((m) => m.id)).toEqual(expected.map((m) => m.id));
    expect(result.current.level).toBe(1);
    expect(result.current.level2Kinds).toEqual(['retirementMatch', 'hsa', 'refinance', 'negotiateRent', 'reshopInsurance']);

    const first = result.current.moves.data[0]!;
    act(() => result.current.commit(first.id));
    expect(useAppStore.getState().profile.committedMoveId).toBe(first.id);
    expect(result.current.level).toBe(2);
    if (result.current.moves.status !== 'ready') return;
    expect(result.current.moves.data.find((m) => m.id === first.id)?.isCommitted).toBe(true);
    expect(result.current.committedPreview?.moveId).toBe(first.id);
    expect(result.current.committedPreview!.in10y.mid).toBeGreaterThan(result.current.in10y.mid);

    act(() => result.current.markDone(first.id));
    expect(useAppStore.getState().profile.doneMoveIds).toEqual([first.id]);
    expect(result.current.committedPreview).toBeNull();
    expect(result.current.doneCount).toBe(1);
    if (result.current.moves.status === 'ready') {
      expect(result.current.moves.data.map((m) => m.id)).not.toContain(first.id);
    }
  });

  it('cancelSubscriptions appears only after a statement found subscriptions', async () => {
    const { result } = renderHook(() => useFuture());
    await waitForReady(result);
    const kinds = () => (result.current.moves.status === 'ready' ? result.current.moves.data.map((m) => m.kind) : []);
    expect(kinds()).not.toContain('cancelSubscriptions');
    act(() => useAppStore.getState().applyStatementTotals([
      { month: '2026-10', totals: totals({ ...Object.fromEntries(COST_CATEGORIES.map((c) => [c, cloneProfileDemo().spending[c].value])), subscriptions: 120 }), oneOffs: [] },
    ]));
    expect(useAppStore.getState().subscriptionsDetected).toBe(true);
    expect(rankMoves(useAppStore.getState().profile, { rates, subscriptionsDetected: true }).map((m) => m.kind))
      .toEqual(kinds());
  });
});

describe('useToday (S1)', () => {
  it('month-end card, in 10 years, top move and the game call to action on the demo profile', async () => {
    const { result } = renderHook(() => useToday({ now: new Date(2026, 10, 14) }));
    await waitForReady(result);
    expect(result.current.isDemoProfile).toBe(true);
    expect(result.current.monthEnd.status).toBe('ready');
    if (result.current.monthEnd.status === 'ready') {
      const me = monthEnd(cloneProfileDemo(), []);
      expect(result.current.monthEnd.data).toMatchObject({
        projectedSpend: me.projectedSpend, vsAverage: null, drifts: [], historyMonths: 0, fromStatement: false,
      });
      expect(result.current.monthEnd.data.takeHome).toEqual({ value: 5200, isEstimate: false });
    }
    expect(result.current.in10y).toEqual(forecast(cloneProfileDemo(), 10, { todaysDollars: true, rates }).in10y);
    expect(result.current.in10yBandIsZero).toBe(false);
    const top = rankMoves(cloneProfileDemo(), { rates })[0]!;
    expect(result.current.topMove).toEqual({ status: 'ready', data: { ...top, isCommitted: false, target: moveTarget(top) } });
    expect(result.current.committedMove).toBeNull();
    expect(result.current.game).toEqual({ date: null, played: 0, total: 0, finished: false });
  });

  it('uses past statement months as history and this month as the month in progress', async () => {
    useAppStore.getState().applyStatementTotals([
      { month: '2026-09', totals: totals({ groceries: 500 }), oneOffs: [] },
      { month: '2026-10', totals: totals({ groceries: 500 }), oneOffs: [] },
      { month: '2026-11', totals: totals({ groceries: 200 }), oneOffs: [] },
    ]);
    const { result } = renderHook(() => useToday({ now: new Date(2026, 10, 14) }));
    await waitForReady(result);
    expect(result.current.isDemoProfile).toBe(false);
    if (result.current.monthEnd.status !== 'ready') throw new Error('monthEnd not ready');
    expect(result.current.monthEnd.data.historyMonths).toBe(2);
    expect(result.current.monthEnd.data.fromStatement).toBe(true);
  });

  it('marks the committed move done', async () => {
    const { result } = renderHook(() => useToday());
    await waitForReady(result);
    if (result.current.topMove.status !== 'ready' || !result.current.topMove.data) throw new Error('no move');
    const move = result.current.topMove.data;
    act(() => useAppStore.getState().commitMove(move));
    expect(result.current.committedMove?.id).toBe(move.id);
    expect(result.current.committedMove?.isCommitted).toBe(true);
    act(() => result.current.markCommittedDone());
    expect(result.current.committedMove).toBeNull();
    expect(useAppStore.getState().profile.doneMoveIds).toContain(move.id);
  });
});

describe('useFuture compare with a move (S10 toggle)', () => {
  it('compares with the top move, then with the committed one, in the same dollars', async () => {
    const { result } = renderHook(() => useFuture());
    await waitForReady(result);
    const ranked = rankMoves(cloneProfileDemo(), { rates });
    expect(ranked.length).toBeGreaterThanOrEqual(2);
    expect(result.current.compareMove?.id).toBe(ranked[0]!.id);
    expect(result.current.compareOn).toBe(false);
    expect(result.current.withMove).toBeNull();

    act(() => result.current.setCompareOn(true));
    const top = applyPatch(cloneProfileDemo(), ranked[0]!.patch);
    expect(result.current.withMove?.moveId).toBe(ranked[0]!.id);
    expect(result.current.withMove?.points).toHaveLength(121);
    expect(result.current.withMove?.in10y).toEqual(forecast(top, 10, { todaysDollars: true, rates }).in10y);
    expect(result.current.withMove!.in10y.mid).toBeGreaterThan(result.current.in10y.mid);

    act(() => result.current.setTodaysDollars(false));
    expect(result.current.withMove?.in10y).toEqual(forecast(top, 10, { rates }).in10y);

    act(() => result.current.commit(ranked[1]!.id));
    expect(result.current.compareMove?.id).toBe(ranked[1]!.id);
    expect(result.current.withMove?.moveId).toBe(ranked[1]!.id);

    act(() => result.current.setCompareOn(false));
    expect(result.current.withMove).toBeNull();
  });

  it('keeps the move list identity between renders while the ranking is unchanged', async () => {
    const { result, rerender } = renderHook(() => useFuture());
    await waitForReady(result);
    const before = result.current.moves;
    rerender();
    expect(result.current.moves).toBe(before);
  });
});

describe('useFuture "Why?" (POST /api/ai/explain)', () => {
  it('asks for one move and keeps the answer while the move is unchanged', async () => {
    const explain = vi.fn(async () => ({ text: 'Two sentences. About the move.', source: 'template' as const }));
    const { result } = renderHook(() => useFuture({ explain }));
    await waitForReady(result);
    if (result.current.moves.status !== 'ready') throw new Error('moves not ready');
    const move = result.current.moves.data[0]!;
    expect(result.current.explanations[move.id]).toBeUndefined();

    act(() => result.current.explain(move.id));
    expect(result.current.explanations[move.id]).toEqual({ status: 'loading' });
    await waitFor(() => expect(result.current.explanations[move.id]?.status).toBe('ready'));
    expect(result.current.explanations[move.id]).toEqual({
      status: 'ready', data: { text: 'Two sentences. About the move.', fromAi: false },
    });
    expect(explain).toHaveBeenCalledTimes(1);
    expect((explain.mock.calls[0] as unknown[])[0]).toEqual({ move });

    // A profile change moves the numbers: the old sentence no longer applies.
    act(() => useAppStore.getState().setSpending('rentUtilities', 1500));
    if (result.current.moves.status !== 'ready') throw new Error('moves not ready');
    expect(result.current.moves.data.find((m) => m.id === move.id)?.effect10y).not.toBe(move.effect10y);
    expect(result.current.explanations[move.id]).toBeUndefined();
  });

  it('maps a failed request to a VMError and can retry', async () => {
    const explain = vi.fn()
      .mockRejectedValueOnce(new ApiError('limited', 429))
      .mockResolvedValueOnce({ text: 'Retry worked. Fine.', source: 'ai' });
    const { result } = renderHook(() => useFuture({ explain }));
    await waitForReady(result);
    if (result.current.moves.status !== 'ready') throw new Error('moves not ready');
    const id = result.current.moves.data[0]!.id;
    act(() => result.current.explain(id));
    await waitFor(() => expect(result.current.explanations[id]).toEqual({ status: 'error', error: { kind: 'rateLimited' } }));
    act(() => result.current.explain(id));
    await waitFor(() => expect(result.current.explanations[id]).toEqual({
      status: 'ready', data: { text: 'Retry worked. Fine.', fromAi: true },
    }));
  });

  it('ignores an unknown move id', async () => {
    const explain = vi.fn();
    const { result } = renderHook(() => useFuture({ explain }));
    await waitForReady(result);
    act(() => result.current.explain('nope'));
    expect(explain).not.toHaveBeenCalled();
  });
});

describe('howWeCalculate', () => {
  it('lists the forecast and moves assumptions with their sources or assumption flags', () => {
    const area = getArea('75206');
    const vm = howWeCalculate({ zip: '75206' });
    expect(vm.forecast.map((a) => a.id)).toEqual([
      'inflation', 'incomeGrowth', 'returnAnnualNominal', 'cashYieldAnnual', 'cardAprDefault', 'cardMinPayment',
      'retirementShareDefault', 'estimateSpread',
    ]);
    expect(vm.moves.map((a) => a.id)).toEqual([
      'payCardExtraShareOfSurplus', 'payCardExtraStep', 'cutCategoryShare', 'cancelSubscriptionsShare',
    ]);
    const byId = Object.fromEntries([...vm.forecast, ...vm.moves].map((a) => [a.id, a]));
    expect(byId.inflation).toEqual({
      id: 'inflation', value: { kind: 'ratePerYear', value: area.cpiYoY.value }, source: area.cpiYoY.source, isAssumption: false,
    });
    expect(byId.cardAprDefault).toEqual({
      id: 'cardAprDefault', value: { kind: 'ratePerYear', value: cardAprDefault.value }, source: cardAprDefault.source,
      isAssumption: false,
    });
    expect(byId.returnAnnualNominal).toMatchObject({ value: { value: returnAnnualNominal.value }, source: null, isAssumption: true });
    expect(byId.estimateSpread).toMatchObject({ value: { kind: 'spread', value: estimateSpread.value }, isAssumption: true });
    expect(byId.incomeGrowth!.value).toEqual({ kind: 'sameAsInflation' });
    for (const a of [...vm.forecast, ...vm.moves]) expect(a.source !== null || a.isAssumption).toBe(true);
  });

  it('falls back to the engine inflation assumption for an unknown ZIP', () => {
    expect(howWeCalculate({ zip: '00000' }).forecast[0]).toEqual({
      id: 'inflation', value: { kind: 'ratePerYear', value: inflationAnnualFallback.value }, source: null, isAssumption: true,
    });
    expect(howWeCalculate({}).forecast[0]!.isAssumption).toBe(true);
  });

  it('is exposed by useFuture for the profile', async () => {
    const { result } = renderHook(() => useFuture());
    await waitForReady(result);
    expect(result.current.howWeCalculate).toEqual(howWeCalculate(cloneProfileDemo()));
  });
});

describe('moveTarget', () => {
  const base = { level: 1 as const, effect10y: 100 };
  it('reads the extra payment or the category amount from the patch', () => {
    expect(moveTarget({ ...base, id: 'payCardFirst:card-1', kind: 'payCardFirst', patch: { debts: [{ id: 'card-1', extraPayment: 250 }] } }))
      .toEqual({ kind: 'extraPayment', debtId: 'card-1', monthly: 250 });
    expect(moveTarget({ ...base, id: 'cutCategory:eatingOut', kind: 'cutCategory', category: 'eatingOut', patch: { spending: { eatingOut: 272 } } }))
      .toEqual({ kind: 'spendingTo', category: 'eatingOut', monthly: 272 });
    expect(moveTarget({ ...base, id: 'cancelSubscriptions', kind: 'cancelSubscriptions', patch: { spending: { subscriptions: 60 } } }))
      .toEqual({ kind: 'spendingTo', category: 'subscriptions', monthly: 60 });
    expect(moveTarget({ ...base, id: 'x', kind: 'hsa', level: 2, patch: { retirementShare: 0.1 } })).toBeNull();
  });

  it('is set on every ranked move of the demo profile', async () => {
    const { result } = renderHook(() => useFuture());
    await waitForReady(result);
    if (result.current.moves.status !== 'ready') throw new Error('moves not ready');
    for (const m of result.current.moves.data) expect(m.target).not.toBeNull();
  });
});
