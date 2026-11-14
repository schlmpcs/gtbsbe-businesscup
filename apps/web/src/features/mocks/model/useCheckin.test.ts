// @vitest-environment jsdom
import { applyPatch, forecast, inflationAnnualOf, monthEnd, movesLevel, rankMoves, simulate } from '@lifeguessr/engine';
import type { CategoryTotals, CostCategory } from '@lifeguessr/types';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { areaByZip, cloneProfileDemo, statementTotalsSample } from '@/fixtures';
import { useAppStore } from '@/state';
import { resetClientState, waitForReady } from '@/test/clientState';
import { resetProState } from '@/test/pro';
import { CHECKIN_STEPS, checkinMonthInputs, daysInMonth, moveProgress, useCheckin } from './useCheckin';

beforeEach(() => {
  resetClientState();
  resetProState();
});

const rates = { inflationAnnual: inflationAnnualOf(areaByZip('75206')) };
const NOW = new Date(2026, 10, 14); // 14 Nov 2026, local time

const totals = (over: Partial<Record<CostCategory, number>> = {}): Record<CostCategory, number> => ({
  rentUtilities: 1950, car: 300, childcare: 0, groceries: 500, eatingOut: 300, subscriptions: 60, debtPayments: 600, other: 300, ...over,
});
const monthOf = (month: string, over?: Partial<Record<CostCategory, number>>): CategoryTotals => ({ month, totals: totals(over), oneOffs: [] });

async function ready() {
  const hook = renderHook(() => useCheckin({ now: NOW }));
  await waitForReady(hook.result);
  return hook;
}

describe('checkinMonthInputs', () => {
  it('reviews the latest month: finished months use their last day, the current month today’s day', () => {
    const months = [monthOf('2026-10'), monthOf('2026-08'), monthOf('2026-09'), monthOf('2026-07')];
    const done = checkinMonthInputs(months, { month: '2026-11', day: 14 });
    expect(done.latest?.month).toBe('2026-10');
    expect(done.inProgress).toBe(false);
    expect(done.history.map((m) => m.month)).toEqual(['2026-07', '2026-08', '2026-09']);
    expect(done.thisMonth).toEqual({ month: '2026-10', day: 31, totals: totals() });

    const live = checkinMonthInputs([...months, monthOf('2026-11')], { month: '2026-11', day: 14 });
    expect(live.inProgress).toBe(true);
    expect(live.thisMonth?.day).toBe(14);
    expect(live.history).toHaveLength(4);

    expect(checkinMonthInputs([], { month: '2026-11', day: 14 })).toEqual({ latest: null, inProgress: false, history: [], thisMonth: undefined });
  });

  it('knows month lengths', () => {
    expect([daysInMonth('2026-02'), daysInMonth('2028-02'), daysInMonth('2026-09'), daysInMonth('2026-12')]).toEqual([28, 29, 30, 31]);
  });
});

describe('moveProgress', () => {
  it('a card move reports the payoff month with and without it (engine simulate)', () => {
    const p = cloneProfileDemo();
    const move = rankMoves(p, { rates }).find((m) => m.kind === 'payCardFirst')!;
    const progress = moveProgress(p, move, { latest: null, inProgress: false, source: 'sample' });
    const without = simulate(p, 120, { rates }).payoffMonth['card-1'] ?? null;
    const withMove = simulate(applyPatch(p, move.patch), 120, { rates }).payoffMonth['card-1'] ?? null;
    expect(progress).toEqual({ kind: 'cardPayoff', debtId: 'card-1', payoffMonthWith: withMove, payoffMonthWithout: without });
    expect(withMove).not.toBeNull();
    expect(without === null || withMove! < without).toBe(true);
  });

  it('a spending move compares the user’s finished month with the target (never the sample or a partial month)', () => {
    const p = cloneProfileDemo();
    const move = rankMoves(p, { rates }).find((m) => m.kind === 'cutCategory')!;
    const category = move.category!;
    const target = move.patch.spending![category]!;
    const latest = monthOf('2026-10', { [category]: target - 10 });
    expect(moveProgress(p, move, { latest, inProgress: false, source: 'uploads' })).toEqual({
      kind: 'spendingTarget', category, target, planned: p.spending[category].value, actual: target - 10, onTrack: true,
    });
    const over = monthOf('2026-10', { [category]: target + 10 });
    expect(moveProgress(p, move, { latest: over, inProgress: false, source: 'uploads' })).toMatchObject({ onTrack: false });
    expect(moveProgress(p, move, { latest, inProgress: true, source: 'uploads' })).toMatchObject({ actual: null, onTrack: null });
    expect(moveProgress(p, move, { latest, inProgress: false, source: 'sample' })).toMatchObject({ actual: null, onTrack: null });
  });
});

describe('useCheckin (S14)', () => {
  it('without uploads, reviews the sample statement’s last month against the 3 before it (engine monthEnd)', async () => {
    const { result } = await ready();
    const m = result.current.month;
    expect(m).toMatchObject({ source: 'sample', hasUploads: false, month: '2026-10', inProgress: false, historyMonths: 3, historyNeeded: 3 });
    expect(m.takeHome).toEqual({ value: statementTotalsSample[3]!.detectedPay, isEstimate: false });
    const expected = monthEnd(cloneProfileDemo(), statementTotalsSample.slice(0, 3), {
      month: '2026-10', day: 31, totals: statementTotalsSample[3]!.totals,
    });
    expect(m.result).toEqual({ status: 'ready', data: expected });
  });

  it('with uploads, reviews them by default; the sample is one tap away', async () => {
    const { result } = await ready();
    const uploads = [monthOf('2026-08'), monthOf('2026-09'), monthOf('2026-10'), monthOf('2026-11', { eatingOut: 90 })];
    act(() => useAppStore.getState().applyStatementTotals(uploads));
    const m = result.current.month;
    expect(m).toMatchObject({ source: 'uploads', hasUploads: true, month: '2026-11', inProgress: true, historyMonths: 3 });
    const profile = useAppStore.getState().profile;
    expect(m.takeHome).toEqual(profile.takeHomePay);
    expect(m.result).toEqual({
      status: 'ready',
      data: monthEnd(profile, useAppStore.getState().statementMonths.slice(0, 3), { month: '2026-11', day: 14, totals: totals({ eatingOut: 90 }) }),
    });
    act(() => result.current.setSource('sample'));
    expect(result.current.month).toMatchObject({ source: 'sample', month: '2026-10' });
  });

  it('steps forward and back, finishes and restarts', async () => {
    const { result } = await ready();
    expect(result.current.steps).toEqual(CHECKIN_STEPS);
    expect(result.current.step).toBe('month');
    act(() => result.current.back());
    expect(result.current.step).toBe('month');
    act(() => result.current.next());
    expect(result.current.step).toBe('move');
    act(() => result.current.next());
    act(() => result.current.next());
    expect(result.current.step).toBe('future');
    act(() => result.current.finish());
    expect(result.current.finished).toBe(true);
    act(() => result.current.goTo('move'));
    expect(result.current).toMatchObject({ step: 'move', finished: false });
    act(() => result.current.restart());
    expect(result.current).toMatchObject({ step: 'month', finished: false });
  });

  it('with no committed move, offers the ranked moves; committing one shows its progress and the forecast with it', async () => {
    const { result } = await ready();
    const p = cloneProfileDemo();
    const ranked = rankMoves(p, { rates });
    const s = result.current.move.suggestions;
    expect(s.status === 'ready' && s.data.map((m) => m.id)).toEqual(ranked.map((m) => m.id));
    expect(result.current.move).toMatchObject({ committed: null, progress: null, answer: 'none', level: 1 });
    expect(result.current.future.status === 'ready' && result.current.future.data.withMove).toBeNull();

    const card = ranked.find((m) => m.kind === 'payCardFirst')!;
    act(() => result.current.move.commit(card.id));
    const move = result.current.move;
    expect(move.committed?.id).toBe(card.id);
    expect(move.level).toBe(movesLevel(useAppStore.getState().profile));
    expect(move.progress).toEqual({ status: 'ready', data: moveProgress(p, card, { latest: null, inProgress: false, source: 'sample' }) });

    const f = result.current.future;
    expect(f.status).toBe('ready');
    if (f.status !== 'ready') return;
    const base = forecast(p, 10, { todaysDollars: true, rates });
    const withMove = forecast(applyPatch(p, card.patch), 10, { todaysDollars: true, rates });
    expect(f.data.in10y).toEqual(base.in10y);
    expect(f.data.bandIsZero).toBe(false);
    expect(f.data.withMove?.in10y).toEqual(withMove.in10y);
    expect(f.data.withMove!.in10y.mid).toBeGreaterThan(f.data.in10y.mid);
  });

  it('"I did it" puts the move in the plan; "keep going" keeps it committed', async () => {
    const { result } = await ready();
    const ranked = rankMoves(cloneProfileDemo(), { rates });
    const first = ranked[0]!;
    act(() => result.current.move.commit(first.id));
    act(() => result.current.move.keepGoing());
    expect(result.current.move).toMatchObject({ answer: 'keepGoing' });
    expect(result.current.move.committed?.id).toBe(first.id);

    act(() => result.current.move.markDone());
    const s = useAppStore.getState();
    expect(s.profile.doneMoveIds).toEqual([first.id]);
    expect(s.committedMove).toBeNull();
    expect(result.current.move).toMatchObject({ answer: 'done', committed: null, level: 2 });
    expect(result.current.move.doneMove?.id).toBe(first.id);
    const f = result.current.future;
    expect(f.status === 'ready' && f.data.in10y).toEqual(forecast(applyPatch(cloneProfileDemo(), first.patch), 10, { todaysDollars: true, rates }).in10y);

    act(() => result.current.restart());
    expect(result.current.move).toMatchObject({ answer: 'none', doneMove: null });
  });

  it('shows the Pro preview note link', async () => {
    const { result } = await ready();
    expect(result.current.pro).toEqual({ isPro: false, href: '/pro' });
  });
});
