// @vitest-environment jsdom
import { applyPatch, monthEnd, movesLevel, rankMoves, simulate } from '@lifeguessr/engine';
import type { CategoryTotals, CostCategory, ForecastBundle } from '@lifeguessr/types';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { cloneProfileDemo, statementTotalsSample } from '@/fixtures';
import { areaRates } from '@/lib/model/profile';
import { useAppStore } from '@/state';
import { resetClientState, waitForReady } from '@/test/clientState';
import { aiAnswer, mockForecastRoute, rulesAnswer } from '@/test/forecastApi';
import { resetProState } from '@/test/pro';
import { checkinMonthInputs, compareOf, daysInMonth, moveProgress, nextMonth, TILE_CATEGORIES, useCheckin } from './useCheckin';

beforeEach(() => {
  resetClientState();
  resetProState();
});

/** The demo profile's area rates, from the real area data (what the hooks use). */
const rates = areaRates(cloneProfileDemo());
const NOW = new Date(2026, 10, 14); // 14 Nov 2026, local time

const totals = (over: Partial<Record<CostCategory, number>> = {}): Record<CostCategory, number> => ({
  rentUtilities: 1950, car: 300, childcare: 0, groceries: 500, eatingOut: 300, subscriptions: 60, debtPayments: 600, other: 300, ...over,
});
const monthOf = (month: string, over?: Partial<Record<CostCategory, number>>): CategoryTotals => ({ month, totals: totals(over), oneOffs: [] });

async function ready() {
  const hook = renderHook(() => useCheckin({ now: NOW }));
  await waitForReady(hook.result);
  // The ranked moves come from the forecast answer: wait for it, so the move buttons are live.
  await waitFor(() => expect(hook.result.current.move.actionsDisabled).toBe(false));
  return hook;
}

describe('checkin helpers', () => {
  it('review the latest month: finished months use their last day, the current month today’s day', () => {
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

  it('know month lengths and the next month', () => {
    expect([daysInMonth('2026-02'), daysInMonth('2028-02'), daysInMonth('2026-09'), daysInMonth('2026-12')]).toEqual([28, 29, 30, 31]);
    expect([nextMonth('2026-10'), nextMonth('2026-12')]).toEqual(['2026-11', '2027-01']);
  });

  it('compareOf reads monthEnd: average = projection − vsAverage; non-drifting tiles are on track', () => {
    expect(compareOf({ projectedSpend: 3000, vsAverage: null, drifts: [] })).toBeNull();
    const c = compareOf({ projectedSpend: 3000, vsAverage: 120, drifts: [{ category: 'eatingOut', delta: 90 }] });
    expect(c).toEqual({
      projected: 3000, average: 2880, difference: 120, direction: 'over',
      drifts: [{ category: 'eatingOut', delta: 90 }],
      onTrack: TILE_CATEGORIES.filter((x) => x !== 'eatingOut'),
    });
    expect(compareOf({ projectedSpend: 3000, vsAverage: -0.4, drifts: [] })?.direction).toBe('even');
    expect(compareOf({ projectedSpend: 3000, vsAverage: -50, drifts: [] })?.direction).toBe('under');
  });
});

describe('moveProgress', () => {
  it('a card move: this month’s payment with the move and the payoff with vs without it (engine simulate)', () => {
    const p = cloneProfileDemo();
    const move = rankMoves(p, { rates }).find((m) => m.kind === 'payCardFirst')!;
    const progress = moveProgress(p, move, { latest: null, inProgress: false, source: 'sample' });
    const without = simulate(p, 120, { rates });
    const withMove = simulate(applyPatch(p, move.patch), 120, { rates });
    const balance = p.debts.find((d) => d.id === 'card-1')!.balance;
    const paid = balance - withMove.path[1]!.debts['card-1']!;
    expect(progress).toEqual({
      kind: 'cardPayoff',
      debtId: 'card-1',
      balance,
      paidThisMonth: paid,
      share: paid / balance,
      payoffMonthWith: withMove.payoffMonth['card-1'] ?? null,
      payoffMonthWithout: without.payoffMonth['card-1'] ?? null,
    });
    expect(paid).toBeGreaterThan(0);
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
    expect(m).toMatchObject({
      source: 'sample', hasUploads: false, month: '2026-10', inProgress: false, nextStatementMonth: '2026-11', historyMonths: 3, historyNeeded: 3,
    });
    const expected = monthEnd(cloneProfileDemo(), statementTotalsSample.slice(0, 3), {
      month: '2026-10', day: 31, totals: statementTotalsSample[3]!.totals,
    });
    expect(m.result).toEqual({ status: 'ready', data: expected });
    expect(expected.vsAverage).not.toBeNull(); // the real monthEnd (T9) compares with the average
    expect(result.current.compare).toEqual(compareOf(expected));
    expect(result.current.uploadHref).toBe('/me/upload');
  });

  it('with uploads, reviews them by default; the sample is one tap away', async () => {
    const { result } = await ready();
    const uploads = [monthOf('2026-08'), monthOf('2026-09'), monthOf('2026-10'), monthOf('2026-11', { eatingOut: 90 })];
    act(() => useAppStore.getState().applyStatementTotals(uploads));
    const m = result.current.month;
    expect(m).toMatchObject({ source: 'uploads', hasUploads: true, month: '2026-11', inProgress: true, nextStatementMonth: '2026-12', historyMonths: 3 });
    const s = useAppStore.getState();
    expect(m.result).toEqual({
      status: 'ready',
      data: monthEnd(s.profile, s.statementMonths.slice(0, 3), { month: '2026-11', day: 14, totals: totals({ eatingOut: 90 }) }),
    });
    act(() => result.current.setSource('sample'));
    expect(result.current.month).toMatchObject({ source: 'sample', month: '2026-10' });
  });

  it('with no committed move, offers the ranked moves; committing one shows its progress', async () => {
    const { result } = await ready();
    const p = cloneProfileDemo();
    const ranked = rankMoves(p, { rates });
    const s = result.current.move.suggestions;
    expect(s.status === 'ready' && s.data.map((m) => m.id)).toEqual(ranked.map((m) => m.id));
    expect(result.current.move).toMatchObject({ committed: null, progress: null, answer: 'none', level: 1 });
    // No model in tests: the answer is the local rules forecast, and the list says so. Not busy once it is in.
    expect(s.status === 'ready' && s.data.every((m) => m.source === 'rules')).toBe(true);
    expect(result.current.move.actionsDisabled).toBe(false);

    const card = ranked.find((m) => m.kind === 'payCardFirst')!;
    act(() => result.current.move.commit(card.id));
    const move = result.current.move;
    expect(move.committed?.id).toBe(card.id);
    expect(move.level).toBe(movesLevel(useAppStore.getState().profile));
    expect(move.progress).toEqual({ status: 'ready', data: moveProgress(p, card, { latest: statementTotalsSample[3]!, inProgress: false, source: 'sample' }) });
  });

  it('"I did it" puts the move in the plan; "not yet" keeps it committed', async () => {
    const { result } = await ready();
    const first = rankMoves(cloneProfileDemo(), { rates })[0]!;
    act(() => result.current.move.commit(first.id));
    act(() => result.current.move.keepGoing());
    expect(result.current.move.answer).toBe('keepGoing');
    expect(result.current.move.committed?.id).toBe(first.id);

    act(() => result.current.move.markDone());
    const s = useAppStore.getState();
    expect(s.profile.doneMoveIds).toEqual([first.id]);
    expect(s.committedMove).toBeNull();
    expect(result.current.move).toMatchObject({ answer: 'done', committed: null, level: 2 });
    expect(result.current.move.doneMove?.id).toBe(first.id);
  });

  it('shows the committed move as ranked now, with its source, and measures progress on the stored move', async () => {
    mockForecastRoute((body) => aiAnswer(body));
    const { result } = await ready();
    const p = cloneProfileDemo();
    const card = rankMoves(p, { rates }).find((m) => m.kind === 'payCardFirst')!;
    // Stored at commit time with another number and a larger extra payment than the ranking has now.
    const stored = {
      ...card,
      effect10y: 1,
      patch: { debts: card.patch.debts!.map((d) => ({ ...d, extraPayment: (d.extraPayment ?? 0) + 50 })) },
    };
    act(() => useAppStore.getState().commitMove(stored));
    await waitFor(() => expect(result.current.move.committed).toMatchObject({ id: card.id, source: 'ai' }));
    const { committed, progress } = result.current.move;
    expect(committed).toMatchObject({ id: card.id, source: 'ai', isCommitted: true });
    expect(committed?.effect10y).not.toBe(1); // the current ranked number, not the stored one
    expect(committed?.patch).toEqual(card.patch); // the ranked move's patch...
    const review = { latest: statementTotalsSample[3]!, inProgress: false, source: 'sample' as const };
    const storedProgress = moveProgress(useAppStore.getState().profile, stored, review);
    expect(storedProgress).not.toEqual(moveProgress(useAppStore.getState().profile, card, review));
    expect(progress).toEqual({ status: 'ready', data: storedProgress }); // ...but progress uses the stored patch
  });

  it('a committed move that is not on the ranked list is shown as stored, without a source', async () => {
    const { result } = await ready();
    const stored = { ...rankMoves(cloneProfileDemo(), { rates })[0]!, id: 'cutCategory:gone', kind: 'cutCategory' as const };
    act(() => useAppStore.getState().commitMove(stored));
    await waitFor(() => expect(result.current.move.committed?.id).toBe('cutCategory:gone'));
    expect(result.current.move.committed).toMatchObject({ source: null, effect10y: stored.effect10y });
  });

  it('"I did it" works at once, like S1: the rules forecast for this profile is on screen while the answer is on its way', async () => {
    let release: (() => void) | undefined;
    mockForecastRoute((body) => new Promise<ForecastBundle>((resolve) => (release = () => resolve(rulesAnswer(body)))));
    const { result } = renderHook(() => useCheckin({ now: NOW }));
    await waitForReady(result);
    await waitFor(() => expect(release).toBeDefined());
    expect(result.current.move.actionsDisabled).toBe(false);
    const first = rankMoves(cloneProfileDemo(), { rates })[0]!;
    act(() => useAppStore.getState().commitMove(first));
    expect(result.current.move.committed).toMatchObject({ id: first.id, source: 'rules' });
    act(() => result.current.move.markDone());
    expect(useAppStore.getState().profile.doneMoveIds).toEqual([first.id]);
    expect(result.current.move.answer).toBe('done');
    await act(async () => release?.());
  });

  it('links the preview note to Pro', async () => {
    const { result } = await ready();
    expect(result.current.pro).toEqual({ isPro: false, href: '/pro' });
  });
});
