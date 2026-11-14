// Next Moves shared by S1 and S10: the engine's candidate moves, measured by the forecast bundle
// (AI or rules) at the chosen horizon and ranked by the engine's rankCandidates, plus commit / done and
// the horizon itself (one for the app, in the store).
import { MOVE_LEVELS, moveCandidates, movesLevel, pointAt, rankCandidates, type MoveCandidate } from '@lifeguessr/engine';
import {
  FORECAST_HORIZONS, type CostCategory, type ForecastSource, type HorizonYears, type Money, type Move, type MoveKind,
  type Profile,
} from '@lifeguessr/types';
import { useCallback, useMemo } from 'react';
import { track } from '@/lib/events';
import { runEngine } from '@/lib/model/errors';
import { areaRates } from '@/lib/model/profile';
import type { Loadable } from '@/lib/model/types';
import { useAppStore } from '@/state';
import type { ForecastAnswer, MoveTarget, MoveVM, NextMovesVM } from './types';
import { answerDollars, forecastIsBusy } from './forecastAnswer';
import { useForecastBundle } from './useForecastBundle';

const LEVEL_2_KINDS = (Object.keys(MOVE_LEVELS) as MoveKind[]).filter((k) => MOVE_LEVELS[k] === 2);
const NO_CANDIDATES: MoveCandidate[] = [];

/** The change a move's patch makes, for display (no math: values are read from the patch). */
export function moveTarget(move: Move): MoveTarget | null {
  const debt = move.patch.debts?.find((d) => d.extraPayment !== undefined);
  if (debt?.extraPayment !== undefined) return { kind: 'extraPayment', debtId: debt.id, monthly: debt.extraPayment };
  const spending = move.patch.spending ?? {};
  const category = move.category && spending[move.category] !== undefined
    ? move.category
    : (Object.keys(spending) as CostCategory[])[0];
  const monthly = category === undefined ? undefined : spending[category];
  return category !== undefined && monthly !== undefined ? { kind: 'spendingTo', category, monthly } : null;
}

/**
 * The move as the UI shows it. `at` is its effect at the shown year; without it (a stored committed move
 * that is not ranked) the move shows its frozen `effect10y`, a 10-year number.
 */
export function toMoveVM(
  move: Move,
  p: Pick<Profile, 'committedMoveId'>,
  source: ForecastSource | null,
  at: { effect: Money; years: HorizonYears } = { effect: move.effect10y, years: 10 },
): MoveVM {
  return {
    ...move, isCommitted: move.id === p.committedMoveId, target: moveTarget(move), source,
    effect: at.effect, horizonYears: at.years,
  };
}

/** A ranked move (a plain Move, what a commit stores) and its effect at the year it was ranked at. */
export type RankedMove = { move: Move; effect: Money };

/**
 * The answer's candidates ranked by the answer's own scenarios at `years`: effect = scenario − base at
 * month 12·years, in today's dollars, and the move's `effect10y` the same at month 120 (both read once
 * per candidate, the base's once). The candidates and the bundle are one request's pair, so ids and
 * patches always match; only what the user did since (committed, done) comes from the live profile, and
 * a move that is done is left out at once, before the next answer arrives.
 */
export function rankAnswer(
  answer: ForecastAnswer,
  live: Pick<Profile, 'committedMoveId' | 'doneMoveIds'>,
  years: HorizonYears,
): RankedMove[] {
  const dollars = answerDollars(answer, true);
  const base = dollars(answer.bundle.base);
  const baseAtHorizon = pointAt(base, years).mid;
  const base10 = pointAt(base, 10).mid;
  const effects = new Map<string, { atHorizon: Money; at10: Money }>();
  const effectOf = (c: MoveCandidate): Money => {
    const raw = answer.bundle.scenarios[c.id];
    if (!raw) throw new RangeError(`the forecast has no scenario for ${c.id}`);
    const scenario = dollars(raw);
    const e = { atHorizon: pointAt(scenario, years).mid - baseAtHorizon, at10: pointAt(scenario, 10).mid - base10 };
    effects.set(c.id, e);
    return e.atHorizon;
  };
  const open = answer.candidates.filter((c) => !live.doneMoveIds.includes(c.id));
  // rankCandidates puts what effectOf returns (the horizon's effect) into effect10y; the 10-year one goes back here.
  return rankCandidates({ ...answer.profile, ...live }, open, effectOf).map((ranked) => {
    const e = effects.get(ranked.id)!;
    return { move: { ...ranked, effect10y: e.at10 }, effect: e.atHorizon };
  });
}

export function useNextMoves(profile: Profile): NextMovesVM {
  const subscriptionsDetected = useAppStore((s) => s.subscriptionsDetected);
  const committedMove = useAppStore((s) => s.committedMove);
  const commitMove = useAppStore((s) => s.commitMove);
  const uncommit = useAppStore((s) => s.uncommitMove);
  const markMoveDone = useAppStore((s) => s.markMoveDone);
  const horizonYears = useAppStore((s) => s.horizonYears);
  const storeHorizonYears = useAppStore((s) => s.setHorizonYears);

  const candidates = useMemo(
    () => runEngine(() => moveCandidates(profile, { rates: areaRates(profile), subscriptionsDetected })),
    [profile, subscriptionsDetected],
  );
  // The committed move is measured on its own only while it is the profile's (see useForecastBundle).
  const preview = committedMove && committedMove.id === profile.committedMoveId ? committedMove : undefined;
  const forecast = useForecastBundle(profile, candidates.status === 'ready' ? candidates.data : NO_CANDIDATES, preview);

  const { committedMoveId, doneMoveIds } = profile;
  const candidatesError = candidates.status === 'error' ? candidates.error : null;
  const ranked: Loadable<RankedMove[]> = useMemo(() => {
    if (candidatesError) return { status: 'error', error: candidatesError };
    if (forecast.status !== 'ready') return forecast;
    return runEngine(() => rankAnswer(forecast.answer, { committedMoveId, doneMoveIds }, horizonYears));
  }, [candidatesError, forecast, committedMoveId, doneMoveIds, horizonYears]);

  // Until an answer for the current profile is here, the list on screen is the previous profile's: a click
  // would act on its patches (a move's patch is absolute, sized for the profile it was measured on).
  const actionsDisabled = forecastIsBusy(forecast);

  const find = useCallback(
    (id: string): Move | undefined =>
      (ranked.status === 'ready' ? ranked.data.find((r) => r.move.id === id)?.move : undefined) ??
      (committedMove?.id === id ? committedMove : undefined),
    [ranked, committedMove],
  );

  const commit = useCallback(
    (id: string) => {
      if (actionsDisabled) return;
      const move = find(id);
      if (!move) return;
      commitMove(move);
      track({ name: 'move_committed', props: { kind: move.kind } });
    },
    [actionsDisabled, find, commitMove],
  );
  const markDone = useCallback(
    (id: string) => {
      if (actionsDisabled) return;
      const move = find(id);
      if (move) markMoveDone(move);
    },
    [actionsDisabled, find, markMoveDone],
  );

  // Picking a year re-reads the same answer (the ranking above): no request. Counted only when it changes.
  const setHorizonYears = useCallback(
    (years: HorizonYears) => {
      if (years === useAppStore.getState().horizonYears) return;
      storeHorizonYears(years);
      track({ name: 'forecast_horizon_changed', props: { years } });
    },
    [storeHorizonYears],
  );

  // Memoized so the list (and anything derived from it, like S10's comparison) keeps its identity
  // between renders while the ranking is unchanged.
  const source = forecast.status === 'ready' ? forecast.source : null;
  const moves: NextMovesVM['moves'] = useMemo(
    () =>
      ranked.status === 'ready'
        ? {
            status: 'ready',
            data: ranked.data.map((r) => toMoveVM(r.move, { committedMoveId }, source, { effect: r.effect, years: horizonYears })),
          }
        : ranked,
    [ranked, committedMoveId, source, horizonYears],
  );

  return {
    moves, forecast, actionsDisabled, level: movesLevel(profile), level2Kinds: LEVEL_2_KINDS,
    doneCount: doneMoveIds.length, commit, uncommit, markDone,
    horizonYears, horizons: FORECAST_HORIZONS, setHorizonYears,
  };
}
