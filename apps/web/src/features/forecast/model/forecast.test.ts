// @vitest-environment jsdom
import {
  applyPatch, cardAprDefault, deflateForecast, estimateSpread, forecast, hasEstimates, inflationAnnualFallback,
  inflationAnnualOf, monthEnd, moveCandidates, rankMoves, returnAnnualNominal,
} from '@lifeguessr/engine';
import type * as Engine from '@lifeguessr/engine';
import {
  COST_CATEGORIES, type CostCategory, type Forecast, type ForecastBundle, type ForecastSource, type Move, type Profile,
} from '@lifeguessr/types';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/http';
import { areaByZip, cloneProfileDemo } from '@/fixtures';
import { useAppStore } from '@/state';
import { resetClientState, waitForReady } from '@/test/clientState';
import { aiAnswer, mockForecastRoute, rulesAnswer } from '@/test/forecastApi';
import { howWeCalculate } from './howWeCalculate';
import { useFuture } from './useFuture';
import { FORECAST_DEBOUNCE_MS } from './useForecastBundle';
import { useMoveExplain } from './useMoveExplain';
import { moveTarget } from './useNextMoves';
import { useToday } from './useToday';

// The local rules engine can be made to fail, for the "route down and engine down" screens.
const control = vi.hoisted(() => ({ rulesFails: false }));
vi.mock('@lifeguessr/engine', async (importOriginal) => {
  const engine = await importOriginal<typeof Engine>();
  return {
    ...engine,
    rulesBundle: (...args: Parameters<typeof engine.rulesBundle>) => {
      if (control.rulesFails) throw new RangeError('engine broke');
      return engine.rulesBundle(...args);
    },
  };
});

/** The route stub of the running test (tests that need another answer replace it). */
let route: ReturnType<typeof mockForecastRoute>;

beforeEach(() => {
  resetClientState();
  control.rulesFails = false;
  route = mockForecastRoute();
});

const rates = { inflationAnnual: inflationAnnualOf(areaByZip('75206')) };
const totals = (over: Partial<Record<CostCategory, number>>) =>
  Object.fromEntries(COST_CATEGORIES.map((c) => [c, over[c] ?? 0])) as Record<CostCategory, number>;
const AFTER_CHANGE = { timeout: FORECAST_DEBOUNCE_MS + 1_000 };

/** Wait until S10 shows an answer for the current profile (after a change: the debounce and the request). */
const waitForSettled = (result: { current: { status: string; isRefreshing: boolean } }) =>
  waitFor(() => {
    expect(result.current.status).toBe('ready');
    expect(result.current.isRefreshing).toBe(false);
  }, AFTER_CHANGE);

/** The same profile with every input measured: no estimates, so the rules band is zero. */
function measured(p: Profile): Profile {
  const sure = <T>(e: { value: T }) => ({ value: e.value, isEstimate: false });
  return {
    ...p,
    age: sure(p.age), takeHomePay: sure(p.takeHomePay), cash: sure(p.cash), retirement: sure(p.retirement),
    retirementShare: sure(p.retirementShare),
    spending: Object.fromEntries(COST_CATEGORIES.map((c) => [c, sure(p.spending[c])])) as Profile['spending'],
    debts: p.debts.map((d) => ({ ...d, minPayment: sure(d.minPayment) })),
  };
}

/** The forecast with its band set to mid ± halfWidth (0 = the model gave a single number). */
const withBand = (f: Forecast, halfWidth: number): Forecast => {
  const points = f.points.map((p) => ({ ...p, low: p.mid - halfWidth, high: p.mid + halfWidth }));
  return { ...f, points, in10y: points[120]! };
};
const bundleWithBand = (bundle: ForecastBundle, halfWidth: number): ForecastBundle => ({
  ...bundle,
  base: withBand(bundle.base, halfWidth),
  scenarios: Object.fromEntries(Object.entries(bundle.scenarios).map(([id, f]) => [id, withBand(f, halfWidth)])),
});

describe('useFuture (S10)', () => {
  it('shows the engine forecast in today’s dollars with area inflation, labeled, and the band inputs', async () => {
    const { result } = renderHook(() => useFuture());
    await waitForReady(result);
    const expected = forecast(cloneProfileDemo(), 10, { todaysDollars: true, rates });
    expect(result.current.status).toBe('ready');
    expect(result.current.in10y).toEqual(expected.in10y);
    expect(result.current.points).toHaveLength(121);
    expect(result.current.yearly.map((p) => p.month)).toEqual([0, 12, 24, 36, 48, 60, 72, 84, 96, 108, 120]);
    expect(result.current.band.isZero).toBe(false);
    expect(result.current.band.kind).toBe('inputs');
    expect(result.current.source).toBe('rules');
    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.band.estimatedFields).toContainEqual({ field: 'spending', category: 'eatingOut' });
    expect(result.current.band.estimatedFields).toContainEqual({ field: 'debtMinPayment', debtId: 'card-1' });

    act(() => result.current.setTodaysDollars(false));
    expect(result.current.in10y).toEqual(forecast(cloneProfileDemo(), 10, { rates }).in10y);
    act(() => result.current.setTodaysDollars(true));
    expect(route.calls).toHaveLength(1); // the toggle only changes the dollars
  });

  it('asks the route once for the profile and its candidate moves, with the area inflation', async () => {
    const { result } = renderHook(() => useFuture());
    await waitForReady(result);
    expect(route.calls).toEqual([{
      profile: cloneProfileDemo(),
      rates,
      scenarios: moveCandidates(cloneProfileDemo(), { rates }).map(({ id, patch }) => ({ id, patch })),
    }]);
  });

  it('ranks moves with the same rates, commits, and marks done', async () => {
    const { result } = renderHook(() => useFuture());
    await waitForReady(result);
    const expected = rankMoves(cloneProfileDemo(), { rates });
    expect(result.current.moves.status).toBe('ready');
    if (result.current.moves.status !== 'ready') return;
    expect(result.current.moves.data.map((m) => m.id)).toEqual(expected.map((m) => m.id));
    expect(result.current.moves.data.every((m) => m.source === 'rules')).toBe(true);
    for (const [i, m] of result.current.moves.data.entries()) expect(m.effect10y).toBe(expected[i]!.effect10y);
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
    expect(route.calls).toHaveLength(1); // the preview was part of the answer: no new request

    act(() => result.current.markDone(first.id));
    expect(useAppStore.getState().profile.doneMoveIds).toEqual([first.id]);
    // At once: the move is gone and its preview with it, while the numbers behind the list are refreshed.
    expect(result.current.committedPreview).toBeNull();
    expect(result.current.doneCount).toBe(1);
    expect(result.current.isRefreshing).toBe(true);
    if (result.current.moves.status === 'ready') {
      expect(result.current.moves.data.map((m) => m.id)).not.toContain(first.id);
    }

    await waitForSettled(result);
    expect(route.calls).toHaveLength(2);
    const after = rankMoves(useAppStore.getState().profile, { rates });
    expect(result.current.moves.status === 'ready' && result.current.moves.data.map((m) => m.id)).toEqual(after.map((m) => m.id));
    expect(result.current.moves.status === 'ready' && result.current.moves.data.map((m) => m.effect10y)).toEqual(after.map((m) => m.effect10y));
  });

  it('drops a done move from the list at once, even when it was not the committed one', async () => {
    const { result } = renderHook(() => useFuture());
    await waitForReady(result);
    if (result.current.moves.status !== 'ready') throw new Error('moves not ready');
    const [first, second] = result.current.moves.data;
    act(() => result.current.markDone(second!.id));
    expect(result.current.isRefreshing).toBe(true);
    if (result.current.moves.status !== 'ready') throw new Error('moves not ready');
    expect(result.current.moves.data.map((m) => m.id)).toEqual([first!.id]);
    await waitForSettled(result);
  });

  it('ranks by the order of the AI answer, labeled as the AI estimate', async () => {
    const order = rankMoves(cloneProfileDemo(), { rates }).map((m) => m.id);
    const effects = Object.fromEntries(order.map((id, i) => [id, 1_000 * (i + 1)])); // the rules' last is the AI's first
    route = mockForecastRoute((body) => aiAnswer(body, { effects }));
    const { result } = renderHook(() => useFuture());
    await waitForReady(result);
    if (result.current.moves.status !== 'ready') throw new Error('moves not ready');
    expect(result.current.moves.data.map((m) => m.id)).toEqual([...order].reverse());
    expect(result.current.moves.data.every((m) => m.source === 'ai')).toBe(true);
    const deflator = (1 + rates.inflationAnnual) ** 10;
    expect(result.current.moves.data[0]!.effect10y).toBeCloseTo(effects[order.at(-1)!]! / deflator, 6);
    expect(result.current.source).toBe('ai');
    expect(result.current.band).toMatchObject({ kind: 'model', isZero: false });
  });

  it('cancelSubscriptions appears only after a statement found subscriptions, and no ranking mixes two answers', async () => {
    const { result } = renderHook(() => useFuture());
    await waitForReady(result);
    const kinds = () => (result.current.moves.status === 'ready' ? result.current.moves.data.map((m) => m.kind) : []);
    const effects = () => (result.current.moves.status === 'ready' ? result.current.moves.data.map((m) => m.effect10y) : []);
    expect(kinds()).not.toContain('cancelSubscriptions');
    const before = { kinds: kinds(), effects: effects() };
    act(() => useAppStore.getState().applyStatementTotals([
      { month: '2026-10', totals: totals({ ...Object.fromEntries(COST_CATEGORIES.map((c) => [c, cloneProfileDemo().spending[c].value])), subscriptions: 120 }), oneOffs: [] },
    ]));
    expect(useAppStore.getState().subscriptionsDetected).toBe(true);
    // New candidate, new patches: until its answer arrives the screen shows the previous ranking, as it was.
    expect(result.current.isRefreshing).toBe(true);
    expect({ kinds: kinds(), effects: effects() }).toEqual(before);
    expect(effects().every(Number.isFinite)).toBe(true);

    await waitFor(() => {
      expect(rankMoves(useAppStore.getState().profile, { rates, subscriptionsDetected: true }).map((m) => m.kind)).toEqual(kinds());
    }, AFTER_CHANGE);
    expect(result.current.isRefreshing).toBe(false);
    expect(kinds()).toContain('cancelSubscriptions');
  });

  it('keeps the previous answer while a refresh is under way, then switches', async () => {
    const { result } = renderHook(() => useFuture());
    await waitForReady(result);
    const before = result.current.in10y;
    act(() => useAppStore.getState().setSpending('eatingOut', 100));
    expect(result.current.isRefreshing).toBe(true);
    expect(result.current.status).toBe('ready');
    expect(result.current.in10y).toEqual(before);
    await waitForSettled(result);
    expect(result.current.in10y.mid).toBeGreaterThan(before.mid);
  });

  it('asks again for a committed move whose stored patch no longer matches its candidate, and previews it', async () => {
    const order = rankMoves(cloneProfileDemo(), { rates }).map((m) => m.id);
    const stale = { id: 'cutCategory:other', kind: 'cutCategory' as const, level: 1 as const, category: 'other' as const, effect10y: 1, patch: { spending: { other: 100 } } };
    expect(order).toContain(stale.id);
    // The answer for the committed scenario is recognizable: a distinct effect, not the candidate's.
    route = mockForecastRoute((body) => aiAnswer(body, { effects: { [`committed:${stale.id}`]: 77_777 } }));
    const { result } = renderHook(() => useFuture());
    await waitForReady(result);
    expect(result.current.committedPreview).toBeNull();

    act(() => useAppStore.getState().commitMove(stale));
    await waitFor(() => expect(result.current.committedPreview?.moveId).toBe(stale.id), AFTER_CHANGE);
    const asked = route.calls.at(-1) as { scenarios: { id: string; patch: unknown }[] };
    expect(asked.scenarios.filter((s) => s.id.startsWith('committed:'))).toEqual([{ id: `committed:${stale.id}`, patch: stale.patch }]);
    expect(route.calls).toHaveLength(2); // one request for the commit, not one per render
    const deflator = (1 + rates.inflationAnnual) ** 10;
    expect(result.current.committedPreview!.in10y.mid - result.current.in10y.mid).toBeCloseTo(77_777 / deflator, 6);
  });

  it('sends no committed scenario, and shows no preview, once the committed move’s debt is gone', async () => {
    const { result } = renderHook(() => useFuture());
    await waitForReady(result);
    if (result.current.moves.status !== 'ready') throw new Error('moves not ready');
    const card = result.current.moves.data.find((m) => m.kind === 'payCardFirst')!;
    act(() => result.current.commit(card.id));
    expect(result.current.committedPreview?.moveId).toBe(card.id);

    act(() => useAppStore.getState().removeDebt('card-1')); // the store keeps committedMove; its patch now names a debt that is gone
    expect(useAppStore.getState().committedMove?.id).toBe(card.id);
    await waitForSettled(result);
    expect(route.calls).toHaveLength(2);
    const asked = route.calls[1] as { profile: Profile; scenarios: { id: string }[] };
    expect(asked.profile.debts.map((d) => d.id)).not.toContain('card-1');
    expect(asked.scenarios.some((s) => s.id.startsWith('committed:'))).toBe(false);
    expect(result.current.committedPreview).toBeNull();
    expect(result.current.status).toBe('ready');
  });

  it('band.isZero follows the inputs when the answer is the rules forecast', async () => {
    useAppStore.setState({ profile: measured(cloneProfileDemo()) });
    expect(hasEstimates(useAppStore.getState().profile)).toBe(false);
    const { result } = renderHook(() => useFuture());
    await waitForReady(result);
    expect(result.current.band).toEqual({ isZero: true, kind: 'inputs', estimatedFields: [] });
  });

  it('band.isZero follows the bundle when the answer is the model’s: a range, even with every input measured', async () => {
    useAppStore.setState({ profile: measured(cloneProfileDemo()) });
    route = mockForecastRoute((body) => bundleWithBand(aiAnswer(body), 5_000));
    const { result } = renderHook(() => useFuture());
    await waitForReady(result);
    expect(result.current.band).toEqual({ isZero: false, kind: 'model', estimatedFields: [] });
    expect(result.current.in10y.high - result.current.in10y.low).toBeGreaterThan(1);
  });

  it('band.isZero is true when the model gave a single number, even with estimated inputs', async () => {
    route = mockForecastRoute((body) => bundleWithBand(aiAnswer(body), 0));
    const { result } = renderHook(() => useFuture());
    await waitForReady(result);
    expect(hasEstimates(useAppStore.getState().profile)).toBe(true);
    expect(result.current.band).toMatchObject({ isZero: true, kind: 'model' });
  });

  it('falls back to the rules forecast, labeled, when the route fails', async () => {
    route = mockForecastRoute(() => new Response('{}', { status: 503 }));
    const { result } = renderHook(() => useFuture());
    await waitForReady(result);
    expect(result.current.source).toBe('rules');
    expect(result.current.in10y).toEqual(forecast(cloneProfileDemo(), 10, { todaysDollars: true, rates }).in10y);
  });

  it('is an error when the route and the local engine both fail', async () => {
    control.rulesFails = true;
    route = mockForecastRoute(() => new Response('{}', { status: 503 }));
    const { result } = renderHook(() => useFuture());
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toEqual({ kind: 'unknown', message: 'engine broke' });
    expect(result.current.moves).toEqual({ status: 'error', error: { kind: 'unknown', message: 'engine broke' } });
    expect(result.current.source).toBeNull();
    expect(result.current.points).toEqual([]);
  });
});

describe('useToday (S1)', () => {
  it('month-end card, in 10 years, top move and the game call to action on the demo profile', async () => {
    const { result } = renderHook(() => useToday({ now: new Date(2026, 10, 14) }));
    await waitFor(() => expect(result.current.forecastStatus).toBe('ready'));
    expect(result.current.status).toBe('ready');
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
    expect(result.current.in10yBandKind).toBe('inputs');
    expect(result.current.source).toBe('rules');
    expect(result.current.forecastError).toBeNull();
    const top = rankMoves(cloneProfileDemo(), { rates })[0]!;
    expect(result.current.topMove).toEqual({ status: 'ready', data: { ...top, isCommitted: false, target: moveTarget(top), source: 'rules' } });
    expect(result.current.committedMove).toBeNull();
    expect(result.current.game).toEqual({ date: null, played: 0, total: 0, finished: false });
  });

  it('shows the month-end card while the forecast is still on its way', async () => {
    let release!: (b: ForecastBundle) => void;
    route = mockForecastRoute(() => new Promise<ForecastBundle>((resolve) => (release = resolve)));
    const { result } = renderHook(() => useToday({ now: new Date(2026, 10, 14) }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.monthEnd.status).toBe('ready');
    expect(result.current.forecastStatus).toBe('loading');
    expect(result.current.source).toBeNull();
    expect(result.current.in10y).toEqual({ month: 120, low: 0, mid: 0, high: 0 });
    expect(result.current.topMove).toEqual({ status: 'loading' });

    act(() => release(aiAnswer(route.calls[0])));
    await waitFor(() => expect(result.current.forecastStatus).toBe('ready'));
    expect(result.current.source).toBe('ai');
    expect(result.current.in10yBandKind).toBe('model');
    expect(result.current.in10y.mid).toBeGreaterThan(0);
  });

  it('reports a forecast error, not a blank screen, when the route and the local engine both fail', async () => {
    control.rulesFails = true;
    route = mockForecastRoute(() => new Response('{}', { status: 503 }));
    const { result } = renderHook(() => useToday({ now: new Date(2026, 10, 14) }));
    await waitFor(() => expect(result.current.forecastStatus).toBe('error'));
    expect(result.current.forecastError).toEqual({ kind: 'unknown', message: 'engine broke' });
    expect(result.current.status).toBe('ready'); // the rest of the screen is unaffected
    expect(result.current.monthEnd.status).toBe('ready');
    expect(result.current.source).toBeNull();
    expect(result.current.topMove).toEqual({ status: 'error', error: { kind: 'unknown', message: 'engine broke' } });
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

  it('marks the committed move done, showing its current number and source while it is ranked', async () => {
    const { result } = renderHook(() => useToday());
    await waitFor(() => expect(result.current.forecastStatus).toBe('ready'));
    if (result.current.topMove.status !== 'ready' || !result.current.topMove.data) throw new Error('no move');
    const move = result.current.topMove.data;
    act(() => useAppStore.getState().commitMove({ id: move.id, kind: move.kind, level: move.level, category: move.category, effect10y: 1, patch: move.patch }));
    expect(result.current.committedMove).toEqual({ ...move, isCommitted: true }); // the ranked entry, not the frozen 1
    act(() => result.current.markCommittedDone());
    expect(result.current.committedMove).toBeNull();
    expect(useAppStore.getState().profile.doneMoveIds).toContain(move.id);
  });

  it('shows the ranked entry of a committed move whose stored numbers are out of date', async () => {
    const { result } = renderHook(() => useToday());
    await waitFor(() => expect(result.current.forecastStatus).toBe('ready'));
    const stored: Move = { id: 'payCardFirst:card-1', kind: 'payCardFirst', level: 1, effect10y: 4321, patch: { debts: [{ id: 'card-1', extraPayment: 5 }] } };
    act(() => useAppStore.getState().commitMove(stored));
    expect(result.current.committedMove).toMatchObject({ id: stored.id, isCommitted: true, source: 'rules' });
    expect(result.current.committedMove?.effect10y).not.toBe(4321);
  });

  it('shows a committed move that is not ranked as it was stored, with no source label', async () => {
    const { result } = renderHook(() => useToday());
    await waitFor(() => expect(result.current.forecastStatus).toBe('ready'));
    const stored: Move = { id: 'cutCategory:rentUtilities', kind: 'cutCategory', level: 1, effect10y: 4321, patch: { spending: { rentUtilities: 1 } } };
    act(() => useAppStore.getState().commitMove(stored));
    expect(result.current.committedMove).toEqual({
      ...stored, isCommitted: true, target: { kind: 'spendingTo', category: 'rentUtilities', monthly: 1 }, source: null,
    });
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
    expect(route.calls).toHaveLength(1); // everything above came from the one answer

    act(() => result.current.setCompareOn(false));
    expect(result.current.withMove).toBeNull();
  });

  it('reads the comparison from the answer, so it is the AI’s number when the headline is', async () => {
    const top = rankMoves(cloneProfileDemo(), { rates })[0]!;
    let served!: ForecastBundle;
    route = mockForecastRoute((body) => {
      const rules = rulesAnswer(body);
      const rulesEffect = rules.scenarios[top.id]!.in10y.mid - rules.base.in10y.mid;
      served = aiAnswer(body, { effects: { [top.id]: rulesEffect * 1.5 } });
      return served;
    });
    const { result } = renderHook(() => useFuture());
    await waitForReady(result);
    expect(result.current.compareMove?.id).toBe(top.id);
    act(() => result.current.setCompareOn(true));
    const inflation = rates.inflationAnnual;
    const expected = deflateForecast(served.scenarios[top.id]!, inflation);
    expect(result.current.withMove?.points).toHaveLength(121);
    expect(result.current.withMove?.in10y).toEqual(expected.in10y);
    expect(result.current.withMove?.in10y).not.toEqual(
      forecast(applyPatch(cloneProfileDemo(), top.patch), 10, { todaysDollars: true, rates }).in10y,
    );
    expect(result.current.withMove?.points).toEqual(expected.points);
  });

  it('keeps the move list identity between renders, and across the dollars toggle', async () => {
    const { result, rerender } = renderHook(() => useFuture());
    await waitForReady(result);
    const before = result.current.moves;
    rerender();
    expect(result.current.moves).toBe(before);
    act(() => result.current.setTodaysDollars(false));
    expect(result.current.moves).toBe(before); // effects are always in today's dollars
    act(() => result.current.setTodaysDollars(true));
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
    expect(move.source).toBe('rules');

    // A profile change moves the numbers, but not until the new answer is here: until then the
    // move on screen is the same one and so is its sentence.
    act(() => useAppStore.getState().setSpending('rentUtilities', 1500));
    expect(result.current.isRefreshing).toBe(true);
    expect(result.current.explanations[move.id]).toEqual({
      status: 'ready', data: { text: 'Two sentences. About the move.', fromAi: false },
    });
    await waitFor(() => expect(result.current.isRefreshing).toBe(false), AFTER_CHANGE);
    if (result.current.moves.status !== 'ready') throw new Error('moves not ready');
    expect(result.current.moves.data.find((m) => m.id === move.id)?.effect10y).not.toBe(move.effect10y);
    expect(result.current.explanations[move.id]).toBeUndefined();
  });

  it('does not reuse a sentence written for another source of the same number', async () => {
    const explain = vi.fn(async () => ({ text: 'Two sentences. About the move.', source: 'template' as const }));
    const move = { id: 'cutCategory:other', kind: 'cutCategory' as const, level: 1 as const, effect10y: 1234, patch: { spending: { other: 360 } } };
    const listed = (source: ForecastSource) => ({ moves: [{ ...move, source }] });
    const { result, rerender } = renderHook(({ moves }) => useMoveExplain(moves, explain), { initialProps: listed('rules') });
    act(() => result.current.explain(move.id));
    await waitFor(() => expect(result.current.explanations[move.id]?.status).toBe('ready'));
    rerender(listed('rules'));
    expect(result.current.explanations[move.id]?.status).toBe('ready');
    rerender(listed('ai')); // same dollars, but now the model's number: the old sentence is about another one
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
    const area = areaByZip('75206');
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
