// @vitest-environment jsdom
import {
  applyPatch, cardAprDefault, deflateForecast, estimateSpread, forecast, goalStatus, hasEstimates, inflationAnnualFallback,
  inflationAnnualOf, monthEnd, moveCandidates, pointAt, rankMoves, returnAnnualNominal, type MoveCandidate,
} from '@lifeguessr/engine';
import type * as Engine from '@lifeguessr/engine';
import {
  COST_CATEGORIES, FORECAST_HORIZONS, type CostCategory, type Forecast, type ForecastBundle, type ForecastSource, type HorizonYears,
  type Move, type Profile,
} from '@lifeguessr/types';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/http';
import { getArea } from '@lifeguessr/data/areas';
import { cloneProfileDemo } from '@/fixtures';
import { FIXTURE_DUEL_LOG_KEY } from '@/features/game/model/duelProgress';
import { useAppStore, useGameStore } from '@/state';
import { currentMonth } from '@/state/profile';
import { resetClientState, waitForReady } from '@/test/clientState';
import { aiAnswer, mockForecastRoute, rulesAnswer } from '@/test/forecastApi';
import { howWeCalculate } from './howWeCalculate';
import { useFuture } from './useFuture';
import { FORECAST_DEBOUNCE_MS } from './useForecastBundle';
import { useMoveExplain } from './useMoveExplain';
import type { ForecastAnswer, MoveVM } from './types';
import { moveTarget, rankAnswer } from './useNextMoves';
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

const rates = { inflationAnnual: inflationAnnualOf(getArea('75206')) };
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
    expect(result.current.atHorizon).toEqual(expected.in10y);
    expect(result.current.points).toHaveLength(121);
    expect(result.current.yearly.map((p) => p.month)).toEqual([0, 12, 24, 36, 48, 60, 72, 84, 96, 108, 120]);
    expect(result.current.band.isZero).toBe(false);
    expect(result.current.band.kind).toBe('inputs');
    expect(result.current.source).toBe('rules');
    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.band.estimatedFields).toContainEqual({ field: 'spending', category: 'eatingOut' });
    expect(result.current.band.estimatedFields).toContainEqual({ field: 'debtMinPayment', debtId: 'card-1' });

    act(() => result.current.setTodaysDollars(false));
    expect(result.current.atHorizon).toEqual(forecast(cloneProfileDemo(), 10, { rates }).in10y);
    act(() => result.current.setTodaysDollars(true));
    expect(route.calls).toHaveLength(1); // the toggle only changes the dollars
  });

  it('asks the route once for the profile and its candidate moves, with the area inflation', async () => {
    const { result } = renderHook(() => useFuture());
    await waitForReady(result);
    expect(route.calls).toEqual([{
      profile: { ...cloneProfileDemo(), asOf: currentMonth() }, // stamped with this month (state/profile.ts)
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
    expect(result.current.committedPreview!.point.mid).toBeGreaterThan(result.current.atHorizon.mid);
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

  it('keeps the moves usable on a profile change: the numbers on screen are the new profile’s rules forecast', async () => {
    const { result } = renderHook(() => useFuture());
    await waitForReady(result);
    act(() => useAppStore.getState().setSpending('eatingOut', 100));
    expect(result.current.isRefreshing).toBe(true);
    expect(result.current.forecast).toMatchObject({ status: 'ready', source: 'rules', isStale: false });
    expect(result.current.actionsDisabled).toBe(false);
    if (result.current.moves.status !== 'ready') throw new Error('moves not ready');
    const expected = rankMoves(useAppStore.getState().profile, { rates });
    expect(result.current.moves.data.map((m) => m.id)).toEqual(expected.map((m) => m.id)); // the new profile's ranking
    const id = result.current.moves.data[0]!.id;
    act(() => result.current.commit(id));
    expect(useAppStore.getState().profile.committedMoveId).toBe(id);
    await waitForSettled(result);
  });

  it('does not commit or mark done while the numbers on screen are the previous profile’s (the local engine failed), and does again once they are current', async () => {
    const { result } = renderHook(() => useFuture());
    await waitForReady(result);
    expect(result.current.actionsDisabled).toBe(false);
    if (result.current.moves.status !== 'ready') throw new Error('moves not ready');
    const [first, second] = result.current.moves.data;

    control.rulesFails = true; // no rules forecast for the new profile: the previous answer stays up
    act(() => useAppStore.getState().setSpending('eatingOut', 100));
    control.rulesFails = false;
    expect(result.current.isRefreshing).toBe(true);
    expect(result.current.forecast).toMatchObject({ status: 'ready', isStale: true }); // the previous profile's answer
    expect(result.current.actionsDisabled).toBe(true);
    const before = useAppStore.getState();
    act(() => result.current.commit(first!.id));
    act(() => result.current.markDone(second!.id));
    expect(useAppStore.getState().profile).toBe(before.profile); // nothing happened
    expect(useAppStore.getState().committedMove).toBeNull();

    await waitForSettled(result);
    expect(result.current.actionsDisabled).toBe(false);
    if (result.current.moves.status !== 'ready') throw new Error('moves not ready');
    const id = result.current.moves.data[0]!.id;
    act(() => result.current.commit(id));
    expect(useAppStore.getState().profile.committedMoveId).toBe(id);
  });

  it('keeps the moves enabled while this profile’s remembered rules answer is asked for again, and commit works', async () => {
    const first = renderHook(() => useFuture());
    await waitForReady(first.result);
    expect(first.result.current.source).toBe('rules');
    first.unmount();

    // A later visit: the route is slow (or the provider is down). The remembered answer is for this very profile.
    let release!: (b: ForecastBundle) => void;
    route = mockForecastRoute((body) => new Promise<ForecastBundle>((resolve) => (release = () => resolve(aiAnswer(body)))));
    const { result } = renderHook(() => useFuture());
    await waitFor(() => expect(route.calls).toHaveLength(1));
    expect(result.current.status).toBe('ready'); // at once, no skeleton
    expect(result.current.isRefreshing).toBe(true); // "Updating the forecast…"
    expect(result.current.forecast).toMatchObject({ status: 'ready', isRefreshing: true, isStale: false });
    expect(result.current.actionsDisabled).toBe(false);
    if (result.current.moves.status !== 'ready') throw new Error('moves not ready');
    const id = result.current.moves.data[0]!.id;
    act(() => result.current.commit(id));
    expect(useAppStore.getState().profile.committedMoveId).toBe(id);
    expect(result.current.committedPreview?.moveId).toBe(id);
    expect(route.calls).toHaveLength(1); // committing a ranked move asks nothing new, and the revalidation goes on

    act(() => release(aiAnswer(route.calls[0])));
    await waitFor(() => expect(result.current.source).toBe('ai'));
    expect(result.current.isRefreshing).toBe(false);
    expect(useAppStore.getState().profile.committedMoveId).toBe(id);
  });

  it('shows the rules forecast and its ranked moves at once, usable, while the first answer is on its way', async () => {
    let release!: (b: ForecastBundle) => void;
    route = mockForecastRoute(() => new Promise<ForecastBundle>((resolve) => (release = resolve)));
    const { result } = renderHook(() => useFuture());
    await waitFor(() => expect(route.calls).toHaveLength(1));
    expect(result.current).toMatchObject({ status: 'ready', source: 'rules', isRefreshing: true, actionsDisabled: false });
    expect(result.current.atHorizon).toEqual(forecast(cloneProfileDemo(), 10, { todaysDollars: true, rates }).in10y);
    expect(result.current.moves.status === 'ready' && result.current.moves.data.every((m) => m.source === 'rules')).toBe(true);
    act(() => release(aiAnswer(route.calls[0])));
    await waitFor(() => expect(result.current.source).toBe('ai'));
    expect(result.current).toMatchObject({ isRefreshing: false, actionsDisabled: false });
  });

  it('keeps the band as the shown numbers have it: the new rules forecast at once, then the new answer', async () => {
    // One estimated input: the rules band is the width of that one estimate.
    const oneEstimate: Profile = { ...measured(cloneProfileDemo()), cash: { ...cloneProfileDemo().cash, isEstimate: true } };
    useAppStore.setState({ profile: oneEstimate });
    const { result } = renderHook(() => useFuture());
    await waitForReady(result);
    expect(result.current.band).toEqual({ isZero: false, kind: 'inputs', estimatedFields: [{ field: 'cash' }] });
    const shownBand = result.current.atHorizon.high - result.current.atHorizon.low;
    expect(shownBand).toBeGreaterThan(1);

    act(() => useAppStore.getState().setField('cash', oneEstimate.cash.value)); // typed in: now exact
    expect(hasEstimates(useAppStore.getState().profile)).toBe(false);
    expect(result.current.isRefreshing).toBe(true);
    // The numbers on screen are already the exact profile's rules forecast: no band, and the flags say so.
    expect(result.current.atHorizon.high - result.current.atHorizon.low).toBeLessThan(1);
    expect(result.current.band).toEqual({ isZero: true, kind: 'inputs', estimatedFields: [] });

    await waitForSettled(result);
    expect(result.current.band).toEqual({ isZero: true, kind: 'inputs', estimatedFields: [] });
    expect(result.current.atHorizon.high - result.current.atHorizon.low).toBeLessThan(1);
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
    // New candidate, new patches: at once the rules ranking of the new candidates, all from one answer.
    expect(result.current.isRefreshing).toBe(true);
    const rulesNow = rankMoves(useAppStore.getState().profile, { rates, subscriptionsDetected: true });
    expect(kinds()).toEqual(rulesNow.map((m) => m.kind));
    expect(effects()).toEqual(rulesNow.map((m) => m.effect10y));
    expect({ kinds: kinds(), effects: effects() }).not.toEqual(before);

    await waitForSettled(result);
    expect(kinds()).toEqual(rulesNow.map((m) => m.kind)); // the route's answer (rules here) for the same candidates
    expect(kinds()).toContain('cancelSubscriptions');
  });

  it('moves the numbers at once with the rules forecast while a refresh is under way, then takes the answer', async () => {
    route = mockForecastRoute((body) => aiAnswer(body, { baseShift: 5_000 }));
    const { result } = renderHook(() => useFuture());
    await waitFor(() => expect(result.current.source).toBe('ai'));
    const before = result.current.atHorizon;
    act(() => useAppStore.getState().setSpending('eatingOut', 100));
    expect(result.current).toMatchObject({ status: 'ready', source: 'rules', isRefreshing: true });
    const rulesNow = forecast(useAppStore.getState().profile, 10, { todaysDollars: true, rates }).in10y;
    expect(result.current.atHorizon).toEqual(rulesNow);
    expect(result.current.atHorizon).not.toEqual(before);
    await waitForSettled(result);
    expect(result.current.source).toBe('ai');
    expect(result.current.atHorizon.mid).toBeGreaterThan(rulesNow.mid); // the model's answer (here: rules + $5,000)
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
    expect(result.current.committedPreview?.moveId).toBe(stale.id); // at once, from the rules forecast
    await waitFor(() => expect(route.calls).toHaveLength(2), AFTER_CHANGE);
    await waitForSettled(result);
    const asked = route.calls.at(-1) as { scenarios: { id: string; patch: unknown }[] };
    expect(asked.scenarios.filter((s) => s.id.startsWith('committed:'))).toEqual([{ id: `committed:${stale.id}`, patch: stale.patch }]);
    expect(route.calls).toHaveLength(2); // one request for the commit, not one per render
    const deflator = (1 + rates.inflationAnnual) ** 10;
    expect(result.current.committedPreview!.point.mid - result.current.atHorizon.mid).toBeCloseTo(77_777 / deflator, 6);
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
    expect(result.current.atHorizon.high - result.current.atHorizon.low).toBeGreaterThan(1);
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
    expect(result.current.atHorizon).toEqual(forecast(cloneProfileDemo(), 10, { todaysDollars: true, rates }).in10y);
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
    expect(result.current.atHorizon).toEqual(forecast(cloneProfileDemo(), 10, { todaysDollars: true, rates }).in10y);
    expect(result.current.bandIsZero).toBe(false);
    expect(result.current.bandKind).toBe('inputs');
    expect(result.current.source).toBe('rules');
    expect(result.current.forecastError).toBeNull();
    const top = rankMoves(cloneProfileDemo(), { rates })[0]!;
    expect(result.current.topMove).toEqual({
      status: 'ready', data: { ...top, isCommitted: false, target: moveTarget(top), source: 'rules', effect: top.effect10y, horizonYears: 10 },
    });
    expect(result.current.committedMove).toBeNull();
    // The duel is /play by default: nothing picked today yet.
    expect(result.current.game).toEqual({ kind: 'duel', date: null, played: 0, total: 5, finished: false, homes: [] });
  });

  it('passes the goal verdict (engine goalStatus), the estimates flag and the plan actions through', async () => {
    const { result } = renderHook(() => useToday({ now: new Date(2026, 10, 14) }));
    await waitFor(() => expect(result.current.forecastStatus).toBe('ready'));
    expect(result.current.goal).toBeNull();
    expect(result.current.hasEstimates).toBe(hasEstimates(cloneProfileDemo()));

    const goal = { target: 250_000, years: 10 };
    act(() => useAppStore.getState().setGoal(goal));
    expect(result.current.goal).toEqual({ ...goal, verdict: goalStatus(cloneProfileDemo(), goal, { rates }).verdict });

    act(() => useAppStore.setState({ profile: measured(useAppStore.getState().profile) }));
    expect(result.current.hasEstimates).toBe(false);
  });

  it('adds the top move to the plan from Today, and takes it out', async () => {
    const { result } = renderHook(() => useToday({ now: new Date(2026, 10, 14) }));
    await waitFor(() => expect(result.current.topMove.status).toBe('ready'));
    const top = result.current.topMove.status === 'ready' ? result.current.topMove.data! : null;
    act(() => result.current.commit(top!.id));
    expect(useAppStore.getState().profile.committedMoveId).toBe(top!.id);
    expect(result.current.committedMove?.id).toBe(top!.id);
    act(() => result.current.uncommit());
    expect(useAppStore.getState().profile.committedMoveId).toBeUndefined();
    expect(result.current.committedMove).toBeNull();
  });

  it('counts today’s duel rounds from the duel log, with no home tiles', async () => {
    const pick = { choice: 'A', result: {} };
    localStorage.setItem(FIXTURE_DUEL_LOG_KEY, JSON.stringify({ date: '2026-11-14', resultId: 'r', picks: { 1: pick, 2: pick }, hints: {} }));
    const { result } = renderHook(() => useToday({ now: new Date(2026, 10, 14, 12) }));
    await waitForReady(result);
    expect(result.current.game).toEqual({ kind: 'duel', date: '2026-11-14', played: 2, total: 5, finished: false, homes: [] });
    expect(result.current.firstVisit).toBe(false);
  });

  it('a duel log from another day counts as nothing played today; five picks finish the day', async () => {
    const pick = { choice: 'B', result: {} };
    localStorage.setItem(FIXTURE_DUEL_LOG_KEY, JSON.stringify({ date: '2026-11-13', resultId: 'r', picks: { 1: pick }, hints: {} }));
    const first = renderHook(() => useToday({ now: new Date(2026, 10, 14, 12) }));
    await waitForReady(first.result);
    expect(first.result.current.game).toMatchObject({ played: 0, finished: false });
    expect(first.result.current.firstVisit).toBe(true);
    first.unmount();

    const picks = Object.fromEntries([1, 2, 3, 4, 5].map((r) => [r, pick]));
    localStorage.setItem(FIXTURE_DUEL_LOG_KEY, JSON.stringify({ date: '2026-11-14', resultId: 'r', picks, hints: {} }));
    const { result } = renderHook(() => useToday({ now: new Date(2026, 10, 14, 12) }));
    await waitForReady(result);
    expect(result.current.game).toMatchObject({ played: 5, total: 5, finished: true });
  });

  it('with the duel on the server (NEXT_PUBLIC_DUEL_SOURCE=api), reads no browser log', async () => {
    vi.stubEnv('NEXT_PUBLIC_DUEL_SOURCE', 'api');
    try {
      const pick = { choice: 'A', result: {} };
      localStorage.setItem(FIXTURE_DUEL_LOG_KEY, JSON.stringify({ date: '2026-11-14', resultId: 'r', picks: { 1: pick }, hints: {} }));
      const { result } = renderHook(() => useToday({ now: new Date(2026, 10, 14, 12) }));
      await waitForReady(result);
      expect(result.current.game).toMatchObject({ kind: 'duel', played: 0 });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('slider game (NEXT_PUBLIC_GAME_MODE=slider): lists today’s homes in play order with which ones were guessed', async () => {
    const card = (id: string, metro: string) => ({ id, metro, layout: '1bed' as const, caption: '', decor: [] });
    act(() => {
      useGameStore.getState().startDay('2026-11-14', [card('a', 'Austin, TX'), card('b', 'Boise, ID')]);
      useGameStore.setState({ reveals: { a: {} as never } });
    });
    const { result } = renderHook(() => useToday({ now: new Date(2026, 10, 14), mode: 'slider' }));
    await waitForReady(result);
    expect(result.current.game).toEqual({
      kind: 'slider', date: '2026-11-14', played: 1, total: 2, finished: false,
      homes: [{ id: 'a', metro: 'Austin, TX', played: true }, { id: 'b', metro: 'Boise, ID', played: false }],
    });
  });

  it('is a first visit until the user has a profile, a guess, a played home or the sample life', async () => {
    const { result } = renderHook(() => useToday({ now: new Date(2026, 10, 14) }));
    await waitForReady(result);
    expect(result.current.firstVisit).toBe(true);
    expect(result.current.isSample).toBe(false);

    act(() => void useAppStore.getState().loadSample());
    expect(result.current.firstVisit).toBe(false);
    expect(result.current.isSample).toBe(true);
    expect(result.current.isDemoProfile).toBe(true);

    act(() => useAppStore.getState().clearSample());
    expect(result.current.firstVisit).toBe(true);
    act(() => useAppStore.getState().setSelfGuess(3000));
    expect(result.current.firstVisit).toBe(false);
  });

  it('slider game: is not a first visit once a home was played today', async () => {
    const card = (id: string, metro: string) => ({ id, metro, layout: '1bed' as const, caption: '', decor: [] });
    act(() => {
      useGameStore.getState().startDay('2026-11-14', [card('a', 'Austin, TX'), card('b', 'Boise, ID')]);
      useGameStore.setState({ reveals: { a: {} as never } });
    });
    const { result } = renderHook(() => useToday({ now: new Date(2026, 10, 14), mode: 'slider' }));
    await waitForReady(result);
    expect(result.current.firstVisit).toBe(false);
  });

  it('shows the month-end card and the rules forecast at once while the model’s answer is on its way', async () => {
    let release!: (b: ForecastBundle) => void;
    route = mockForecastRoute(() => new Promise<ForecastBundle>((resolve) => (release = resolve)));
    const { result } = renderHook(() => useToday({ now: new Date(2026, 10, 14) }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.monthEnd.status).toBe('ready');
    expect(result.current.forecastStatus).toBe('ready');
    expect(result.current.source).toBe('rules');
    expect(result.current.isRefreshing).toBe(true);
    expect(result.current.atHorizon.mid).toBeGreaterThan(0);
    expect(result.current.topMove.status).toBe('ready');

    act(() => release(aiAnswer(route.calls[0])));
    await waitFor(() => expect(result.current.forecastStatus).toBe('ready'));
    expect(result.current.source).toBe('ai');
    expect(result.current.bandKind).toBe('model');
    expect(result.current.atHorizon.mid).toBeGreaterThan(0);
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

  it('does not mark the committed move done while the numbers on screen are the previous profile’s (the local engine failed)', async () => {
    const { result } = renderHook(() => useToday());
    await waitFor(() => expect(result.current.forecastStatus).toBe('ready'));
    if (result.current.topMove.status !== 'ready' || !result.current.topMove.data) throw new Error('no move');
    const move = result.current.topMove.data;
    act(() => useAppStore.getState().commitMove({ id: move.id, kind: move.kind, level: move.level, category: move.category, effect10y: move.effect10y, patch: move.patch }));
    expect(result.current.actionsDisabled).toBe(false);

    control.rulesFails = true; // no rules forecast for the new profile: the previous answer stays up
    act(() => useAppStore.getState().setSpending('rentUtilities', 1500));
    control.rulesFails = false;
    expect(result.current.actionsDisabled).toBe(true);
    act(() => result.current.markCommittedDone());
    expect(useAppStore.getState().profile.doneMoveIds).toEqual([]);

    await waitFor(() => expect(result.current.actionsDisabled).toBe(false), AFTER_CHANGE);
    act(() => result.current.markCommittedDone());
    expect(useAppStore.getState().profile.doneMoveIds).toHaveLength(1);
  });

  it('keeps “I did it” working while this profile’s remembered rules answer is asked for again', async () => {
    const first = renderHook(() => useToday());
    await waitFor(() => expect(first.result.current.forecastStatus).toBe('ready'));
    first.unmount();
    route = mockForecastRoute(() => new Promise<ForecastBundle>(() => {})); // slow: never answers in this test
    const { result } = renderHook(() => useToday());
    await waitFor(() => expect(route.calls).toHaveLength(1));
    expect(result.current.forecastStatus).toBe('ready');
    expect(result.current.actionsDisabled).toBe(false);
    if (result.current.topMove.status !== 'ready' || !result.current.topMove.data) throw new Error('no move');
    const move = result.current.topMove.data;
    act(() => useAppStore.getState().commitMove({ id: move.id, kind: move.kind, level: move.level, category: move.category, effect10y: move.effect10y, patch: move.patch }));
    act(() => result.current.markCommittedDone());
    expect(useAppStore.getState().profile.doneMoveIds).toEqual([move.id]);
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
    expect(result.current.monthEnd.data.noAverage).toBe('history');
  });

  it('3 past months and no rows this month: the history is enough, only this month is missing', async () => {
    useAppStore.getState().applyStatementTotals([
      { month: '2026-08', totals: totals({ groceries: 450 }), oneOffs: [] },
      { month: '2026-09', totals: totals({ groceries: 500 }), oneOffs: [] },
      { month: '2026-10', totals: totals({ groceries: 550 }), oneOffs: [] },
    ]);
    const { result } = renderHook(() => useToday({ now: new Date(2026, 10, 14) }));
    await waitForReady(result);
    if (result.current.monthEnd.status !== 'ready') throw new Error('monthEnd not ready');
    const profile = useAppStore.getState().profile;
    expect(result.current.monthEnd.data).toMatchObject({
      // The engine's contract without a current month: the profile's monthly spend (here measured
      // from the statements: groceries = mean of 450, 500, 550), no comparison, no drift flags.
      projectedSpend: monthEnd(profile, []).projectedSpend,
      vsAverage: null,
      drifts: [],
      historyMonths: 3,
      fromStatement: false,
      noAverage: 'thisMonth',
      month: '2026-11',
      asOfDay: null,
    });
    expect(profile.spending.groceries).toEqual({ value: 500, isEstimate: false });
  });

  it('projects this month as of the statement’s last line, not today', async () => {
    const history = [
      { month: '2026-08', totals: totals({ groceries: 500, eatingOut: 200 }), oneOffs: [] },
      { month: '2026-09', totals: totals({ groceries: 500, eatingOut: 200 }), oneOffs: [] },
      { month: '2026-10', totals: totals({ groceries: 500, eatingOut: 200 }), oneOffs: [] },
    ];
    const current = { month: '2026-11', totals: totals({ groceries: 160, eatingOut: 70 }), oneOffs: [], lastDay: 8 };
    useAppStore.getState().applyStatementTotals([...history, current]);
    const { result } = renderHook(() => useToday({ now: new Date(2026, 10, 14) }));
    await waitForReady(result);
    if (result.current.monthEnd.status !== 'ready') throw new Error('monthEnd not ready');
    const profile = useAppStore.getState().profile;
    const asOf8 = monthEnd(profile, history, { month: '2026-11', day: 8, totals: current.totals });
    const asOf14 = monthEnd(profile, history, { month: '2026-11', day: 14, totals: current.totals });
    expect(result.current.monthEnd.data).toMatchObject({
      projectedSpend: asOf8.projectedSpend, vsAverage: asOf8.vsAverage, fromStatement: true, noAverage: null, asOfDay: 8,
    });
    // (160 + 70) / 8 × 30 = $862.50 for the two daily categories, not (160 + 70) / 14 × 30 ≈ $492.86.
    expect(result.current.monthEnd.data.projectedSpend - asOf14.projectedSpend).toBeCloseTo(862.5 - (230 / 14) * 30, 6);
  });

  it('without the statement’s last day (older saved data), falls back to today as the as-of day', async () => {
    useAppStore.getState().applyStatementTotals([{ month: '2026-11', totals: totals({ groceries: 140 }), oneOffs: [] }]);
    const { result } = renderHook(() => useToday({ now: new Date(2026, 10, 14) }));
    await waitForReady(result);
    if (result.current.monthEnd.status !== 'ready') throw new Error('monthEnd not ready');
    const profile = useAppStore.getState().profile;
    expect(result.current.monthEnd.data.asOfDay).toBe(14);
    expect(result.current.monthEnd.data.projectedSpend)
      .toBe(monthEnd(profile, [], { month: '2026-11', day: 14, totals: totals({ groceries: 140 }) }).projectedSpend);
  });

  it('a statement month later than today is not this month', async () => {
    useAppStore.getState().applyStatementTotals([{ month: '2026-12', totals: totals({ groceries: 140 }), oneOffs: [], lastDay: 3 }]);
    const { result } = renderHook(() => useToday({ now: new Date(2026, 10, 14) }));
    await waitForReady(result);
    if (result.current.monthEnd.status !== 'ready') throw new Error('monthEnd not ready');
    expect(result.current.monthEnd.data).toMatchObject({ fromStatement: false, historyMonths: 0, noAverage: 'history', asOfDay: null });
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
      effect: 4321, horizonYears: 10, // its frozen number is a 10-year one
    });
  });
});

describe('rankAnswer: Next Moves at the chosen year', () => {
  const profile = cloneProfileDemo();
  const base = forecast(profile, 10, { rates }); // nominal, as a bundle has it
  /** The base moved up by `gain(month)` dollars (nominal). */
  const lifted = (gain: (month: number) => number): Forecast => {
    const points = base.points.map((p) => ({ ...p, low: p.low + gain(p.month), mid: p.mid + gain(p.month), high: p.high + gain(p.month) }));
    return { points, in10y: points[120]!, todaysDollars: false };
  };
  const cut = (category: CostCategory): MoveCandidate => ({
    id: `cutCategory:${category}`, kind: 'cutCategory', level: 1, category, patch: { spending: { [category]: 1 } },
  });
  // Nominal gains at 1 year / 10 years: A 120 / 1,200 (builds up), B 600 / 600 (all in the first year),
  // C 0 / 540 (starts after a year), E 480 / 480, D 10 / 100 (small at both).
  const A = cut('eatingOut');
  const B: MoveCandidate = { id: 'payCardFirst:card-1', kind: 'payCardFirst', level: 1, patch: { debts: [{ id: 'card-1', extraPayment: 100 }] } };
  const C = cut('other');
  const E: MoveCandidate = { id: 'cancelSubscriptions', kind: 'cancelSubscriptions', level: 1, patch: { spending: { subscriptions: 0 } } };
  const D = cut('groceries');
  const gains: Record<string, (m: number) => number> = {
    [A.id]: (m) => 10 * m,
    [B.id]: (m) => 50 * Math.min(m, 12),
    [C.id]: (m) => 5 * Math.max(0, m - 12),
    [E.id]: (m) => 40 * Math.min(m, 12),
    [D.id]: (m) => (10 * m) / 12,
  };
  const candidates = [A, B, C, E, D];
  const scenarios = Object.fromEntries(candidates.map((c) => [c.id, lifted(gains[c.id]!)]));
  const answer: ForecastAnswer = { profile, candidates, bundle: { source: 'ai', model: 'test-model', base, scenarios } };
  const ids = (years: HorizonYears, committedMoveId?: string) =>
    rankAnswer(answer, { doneMoveIds: [], ...(committedMoveId ? { committedMoveId } : {}) }, years).map((r) => r.move.id);
  /** The effect the screen shows: scenario − base at that year, today's dollars. */
  const effectAt = (id: string, years: HorizonYears) =>
    pointAt(deflateForecast(scenarios[id]!, rates.inflationAnnual), years).mid - pointAt(deflateForecast(base, rates.inflationAnnual), years).mid;

  it('ranks by the gain at the chosen year: the one that builds up wins at 10 years, the quick one at 1', () => {
    expect(ids(10)).toEqual([A.id, B.id, C.id]);
    expect(ids(1)).toEqual([B.id, E.id, A.id]);
  });

  it('drops a move worth less than $1 at the chosen year, and keeps it where it is worth more', () => {
    expect(ids(1)).not.toContain(C.id);
    expect(ids(10)).toContain(C.id);
  });

  it('keeps the committed move in the third slot at either year when it ranks lower', () => {
    expect(ids(10, D.id)).toEqual([A.id, B.id, D.id]);
    expect(ids(1, D.id)).toEqual([B.id, E.id, D.id]);
  });

  it('puts the chosen year’s effect on `effect` and keeps the 10-year effect on the move', () => {
    for (const years of FORECAST_HORIZONS) {
      for (const { move, effect } of rankAnswer(answer, { doneMoveIds: [] }, years)) {
        expect(effect).toBeCloseTo(effectAt(move.id, years), 6);
        expect(move.effect10y).toBeCloseTo(effectAt(move.id, 10), 6);
        expect(move).not.toHaveProperty('effect'); // a plain Move: this is what commitMove stores
      }
    }
    const [b] = rankAnswer(answer, { doneMoveIds: [] }, 1);
    expect(b!.effect).not.toBeCloseTo(b!.move.effect10y, 0); // 600 nominal at both years, deflated by 1 vs 10 years
  });
});

describe('the horizon (picked on S10, S1 follows)', () => {
  const rulesNow = () => forecast(useAppStore.getState().profile, 10, { todaysDollars: true, rates });
  /** The rules effect of a move at a year, today's dollars (what the local rules answer holds). */
  const rulesEffect = (move: Pick<Move, 'patch'>, years: HorizonYears) =>
    pointAt(forecast(applyPatch(useAppStore.getState().profile, move.patch), 10, { todaysDollars: true, rates }), years).mid -
    pointAt(rulesNow(), years).mid;

  it('starts at the remembered 10 years and offers 1, 3, 5 and 10', async () => {
    const { result } = renderHook(() => useFuture());
    await waitForReady(result);
    expect(result.current.horizonYears).toBe(10);
    expect(result.current.horizons).toEqual([1, 3, 5, 10]);
    if (result.current.moves.status !== 'ready') throw new Error('moves not ready');
    for (const m of result.current.moves.data) {
      expect(m.horizonYears).toBe(10);
      expect(m.effect).toBe(m.effect10y);
    }
  });

  it('switching asks nothing new; while the model’s answer is on its way it reads the rules answer at the new year', async () => {
    let release!: (b: ForecastBundle) => void;
    route = mockForecastRoute(() => new Promise<ForecastBundle>((resolve) => (release = resolve)));
    const { result } = renderHook(() => useFuture());
    await waitFor(() => expect(route.calls).toHaveLength(1));
    expect(result.current).toMatchObject({ status: 'ready', source: 'rules', isRefreshing: true, horizonYears: 10 });
    const tenYear = result.current.moves.status === 'ready' ? result.current.moves.data : [];

    act(() => result.current.setHorizonYears(3));
    expect(useAppStore.getState().horizonYears).toBe(3);
    expect(result.current).toMatchObject({ status: 'ready', source: 'rules', isRefreshing: true, horizonYears: 3 });
    const rules = rulesNow();
    expect(result.current.atHorizon).toEqual(rules.points[36]);
    expect(result.current.points).toEqual(rules.points.slice(0, 37));
    expect(result.current.yearly.map((p) => p.month)).toEqual([0, 12, 24, 36]);
    expect(result.current.today).toEqual(rules.points[0]);
    if (result.current.moves.status !== 'ready') throw new Error('moves not ready');
    const moves = result.current.moves.data;
    expect(moves.length).toBeGreaterThan(0);
    for (const m of moves) {
      expect(m).toMatchObject({ horizonYears: 3, source: 'rules' });
      expect(m.effect).toBeCloseTo(rulesEffect(m, 3), 6);
      expect(m.effect10y).toBeCloseTo(rulesEffect(m, 10), 6);
      expect(m.effect10y).toBe(tenYear.find((t) => t.id === m.id)?.effect10y);
    }
    expect(moves.map((m) => m.effect)).toEqual([...moves.map((m) => m.effect)].sort((a, b) => b - a));
    expect(route.calls).toHaveLength(1);

    act(() => release(aiAnswer(route.calls[0], { baseShift: 5_000 })));
    await waitFor(() => expect(result.current.source).toBe('ai'));
    expect(result.current.atHorizon.month).toBe(36);
    expect(result.current.atHorizon.mid).toBeGreaterThan(rules.points[36]!.mid); // the model's answer at 3 years
    expect(route.calls).toHaveLength(1);
  });

  it('reads the committed preview and the compare line at the chosen year', async () => {
    const { result } = renderHook(() => useFuture());
    await waitForReady(result);
    if (result.current.moves.status !== 'ready') throw new Error('moves not ready');
    const first = result.current.moves.data[0]!;
    act(() => result.current.commit(first.id));
    act(() => result.current.setCompareOn(true));
    act(() => result.current.setHorizonYears(5));
    const withFirst = forecast(applyPatch(cloneProfileDemo(), first.patch), 10, { todaysDollars: true, rates });
    expect(result.current.committedPreview).toEqual({ moveId: first.id, point: withFirst.points[60] });
    expect(result.current.withMove?.moveId).toBe(first.id);
    expect(result.current.withMove?.point).toEqual(withFirst.points[60]);
    expect(result.current.withMove?.points).toEqual(withFirst.points.slice(0, 61));

    act(() => result.current.setTodaysDollars(false));
    const nominal = forecast(applyPatch(cloneProfileDemo(), first.patch), 10, { rates });
    expect(result.current.committedPreview?.point).toEqual(nominal.points[60]);
    expect(result.current.atHorizon).toEqual(forecast(cloneProfileDemo(), 10, { rates }).points[60]);
    expect(route.calls).toHaveLength(1);
  });

  it('S1 reads the year in the store: its number and its top move follow it', async () => {
    act(() => useAppStore.getState().setHorizonYears(1));
    const { result } = renderHook(() => useToday({ now: new Date(2026, 10, 14) }));
    await waitFor(() => expect(result.current.forecastStatus).toBe('ready'));
    expect(result.current.horizonYears).toBe(1);
    expect(result.current.atHorizon).toEqual(rulesNow().points[12]);
    if (result.current.topMove.status !== 'ready' || !result.current.topMove.data) throw new Error('no move');
    const top = result.current.topMove.data;
    expect(top.horizonYears).toBe(1);
    expect(top.effect).toBeCloseTo(rulesEffect(top, 1), 6);
    expect(top.effect10y).toBeCloseTo(rulesEffect(top, 10), 6);

    act(() => useAppStore.getState().setHorizonYears(10));
    expect(result.current.horizonYears).toBe(10);
    expect(result.current.atHorizon).toEqual(rulesNow().in10y);
    if (result.current.topMove.status !== 'ready' || !result.current.topMove.data) throw new Error('no move');
    expect(result.current.topMove.data).toMatchObject({ id: rankMoves(cloneProfileDemo(), { rates })[0]!.id, horizonYears: 10 });
    expect(result.current.topMove.data.effect).toBe(result.current.topMove.data.effect10y);
    expect(route.calls).toHaveLength(1);
  });

  it('an explanation belongs to the year it was asked at: hidden at another, back on return, kept per year; the request names the year', async () => {
    const explain = vi.fn(async () => ({ text: 'Two sentences. About the move.', source: 'template' as const }));
    const { result } = renderHook(() => useFuture({ explain }));
    await waitForReady(result);
    const movesNow = () => {
      if (result.current.moves.status !== 'ready') throw new Error('moves not ready');
      return result.current.moves.data;
    };
    const at10 = movesNow()[0]!;
    act(() => result.current.explain(at10.id));
    await waitFor(() => expect(result.current.explanations[at10.id]?.status).toBe('ready'));
    expect((explain.mock.calls[0] as unknown[])[0]).toEqual({ move: at10, horizon: { years: 10, effect: at10.effect } });

    act(() => result.current.setHorizonYears(3));
    expect(result.current.explanations[at10.id]).toBeUndefined();
    act(() => result.current.setHorizonYears(10));
    expect(result.current.explanations[at10.id]?.status).toBe('ready');

    act(() => result.current.setHorizonYears(3));
    const at3 = movesNow().find((m) => m.id === at10.id)!;
    act(() => result.current.explain(at3.id));
    await waitFor(() => expect(result.current.explanations[at3.id]?.status).toBe('ready'));
    expect(explain).toHaveBeenCalledTimes(2);
    expect((explain.mock.calls[1] as unknown[])[0]).toEqual({ move: at3, horizon: { years: 3, effect: at3.effect } });
    expect(at3.effect).not.toBe(at10.effect);

    // Asking at 3 years kept the 10-year sentence: both come back without a new request.
    act(() => result.current.setHorizonYears(10));
    expect(result.current.explanations[at10.id]?.status).toBe('ready');
    act(() => result.current.setHorizonYears(3));
    expect(result.current.explanations[at3.id]?.status).toBe('ready');
    expect(explain).toHaveBeenCalledTimes(2);
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
    expect(result.current.withMove?.point).toEqual(forecast(top, 10, { todaysDollars: true, rates }).in10y);
    expect(result.current.withMove!.point.mid).toBeGreaterThan(result.current.atHorizon.mid);

    act(() => result.current.setTodaysDollars(false));
    expect(result.current.withMove?.point).toEqual(forecast(top, 10, { rates }).in10y);

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
    expect(result.current.withMove?.point).toEqual(expected.in10y);
    expect(result.current.withMove?.point).not.toEqual(
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
    expect((explain.mock.calls[0] as unknown[])[0]).toEqual({ move, horizon: { years: 10, effect: move.effect } });
    expect(move.source).toBe('rules');
    // The server words the sentence by this: the default route is the rules forecast.
    expect(((explain.mock.calls[0] as unknown[])[0] as { move: { source: unknown } }).move.source).toBe('rules');

    // A profile change moves the numbers at once (the new profile's rules forecast): the sentence
    // was about the old number, so it goes with it.
    act(() => useAppStore.getState().setSpending('rentUtilities', 1500));
    expect(result.current.isRefreshing).toBe(true);
    expect(result.current.explanations[move.id]).toBeUndefined();
    await waitFor(() => expect(result.current.isRefreshing).toBe(false), AFTER_CHANGE);
    if (result.current.moves.status !== 'ready') throw new Error('moves not ready');
    expect(result.current.moves.data.find((m) => m.id === move.id)?.effect10y).not.toBe(move.effect10y);
    expect(result.current.explanations[move.id]).toBeUndefined();
  });

  it('does not reuse a sentence written for another source of the same number', async () => {
    const explain = vi.fn(async () => ({ text: 'Two sentences. About the move.', source: 'template' as const }));
    const move = { id: 'cutCategory:other', kind: 'cutCategory' as const, level: 1 as const, effect10y: 1234, patch: { spending: { other: 360 } } };
    const listed = (source: ForecastSource): { moves: MoveVM[] } => ({
      moves: [{ ...move, source, effect: 1234, horizonYears: 10, isCommitted: false, target: null }],
    });
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
