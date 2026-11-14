// @vitest-environment jsdom
import { forecast, inflationAnnualOf, monthEnd, rankMoves } from '@lifeguessr/engine';
import { COST_CATEGORIES, type CostCategory } from '@lifeguessr/types';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { areaByZip, cloneProfileDemo } from '@/fixtures';
import { useAppStore } from '@/state';
import { resetClientState, waitForReady } from '@/test/clientState';
import { useFuture } from './useFuture';
import { useToday } from './useToday';

beforeEach(resetClientState);

const rates = { inflationAnnual: inflationAnnualOf(areaByZip('75206')) };
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
    expect(result.current.topMove).toEqual({ status: 'ready', data: { ...rankMoves(cloneProfileDemo(), { rates })[0]!, isCommitted: false } });
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
