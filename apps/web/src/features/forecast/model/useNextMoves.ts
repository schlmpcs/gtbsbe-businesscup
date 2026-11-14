// Next Moves shared by S1 and S10: the engine's candidate moves, measured by the forecast bundle
// (AI or rules) and ranked by the engine's rankCandidates, plus commit / done.
import { MOVE_LEVELS, moveCandidates, movesLevel, rankCandidates, type MoveCandidate } from '@lifeguessr/engine';
import type { CostCategory, ForecastSource, Money, Move, MoveKind, Profile } from '@lifeguessr/types';
import { useCallback, useMemo } from 'react';
import { runEngine } from '@/lib/model/errors';
import { areaRates } from '@/lib/model/profile';
import type { Loadable } from '@/lib/model/types';
import { useAppStore } from '@/state';
import type { ForecastAnswer, MoveTarget, MoveVM, NextMovesVM } from './types';
import { answerDollars, useForecastBundle } from './useForecastBundle';

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

export function toMoveVM(move: Move, p: Pick<Profile, 'committedMoveId'>, source: ForecastSource | null): MoveVM {
  return { ...move, isCommitted: move.id === p.committedMoveId, target: moveTarget(move), source };
}

/**
 * The answer's candidates ranked by the answer's own scenarios: effect10y = scenario − base at month
 * 120, in today's dollars. The candidates and the bundle are one request's pair, so ids and patches
 * always match; only what the user did since (committed, done) comes from the live profile, and a
 * move that is done is left out at once, before the next answer arrives.
 */
function rankAnswer(answer: ForecastAnswer, live: Pick<Profile, 'committedMoveId' | 'doneMoveIds'>): Move[] {
  const dollars = answerDollars(answer, true);
  const base = dollars(answer.bundle.base).in10y.mid;
  const effectOf = (c: MoveCandidate): Money => {
    const scenario = answer.bundle.scenarios[c.id];
    if (!scenario) throw new RangeError(`the forecast has no scenario for ${c.id}`);
    return dollars(scenario).in10y.mid - base;
  };
  const open = answer.candidates.filter((c) => !live.doneMoveIds.includes(c.id));
  return rankCandidates({ ...answer.profile, ...live }, open, effectOf);
}

export function useNextMoves(profile: Profile): NextMovesVM {
  const subscriptionsDetected = useAppStore((s) => s.subscriptionsDetected);
  const committedMove = useAppStore((s) => s.committedMove);
  const commitMove = useAppStore((s) => s.commitMove);
  const uncommit = useAppStore((s) => s.uncommitMove);
  const markMoveDone = useAppStore((s) => s.markMoveDone);

  const candidates = useMemo(
    () => runEngine(() => moveCandidates(profile, { rates: areaRates(profile), subscriptionsDetected })),
    [profile, subscriptionsDetected],
  );
  // The committed move is measured on its own only while it is the profile's (see useForecastBundle).
  const preview = committedMove && committedMove.id === profile.committedMoveId ? committedMove : undefined;
  const forecast = useForecastBundle(profile, candidates.status === 'ready' ? candidates.data : NO_CANDIDATES, preview);

  const { committedMoveId, doneMoveIds } = profile;
  const candidatesError = candidates.status === 'error' ? candidates.error : null;
  const ranked: Loadable<Move[]> = useMemo(() => {
    if (candidatesError) return { status: 'error', error: candidatesError };
    if (forecast.status !== 'ready') return forecast;
    return runEngine(() => rankAnswer(forecast.answer, { committedMoveId, doneMoveIds }));
  }, [candidatesError, forecast, committedMoveId, doneMoveIds]);

  const find = useCallback(
    (id: string): Move | undefined =>
      (ranked.status === 'ready' ? ranked.data.find((m) => m.id === id) : undefined) ??
      (committedMove?.id === id ? committedMove : undefined),
    [ranked, committedMove],
  );

  const commit = useCallback(
    (id: string) => {
      const move = find(id);
      if (move) commitMove(move);
    },
    [find, commitMove],
  );
  const markDone = useCallback(
    (id: string) => {
      const move = find(id);
      if (move) markMoveDone(move);
    },
    [find, markMoveDone],
  );

  // Memoized so the list (and anything derived from it, like S10's comparison) keeps its identity
  // between renders while the ranking is unchanged.
  const source = forecast.status === 'ready' ? forecast.source : null;
  const moves: NextMovesVM['moves'] = useMemo(
    () =>
      ranked.status === 'ready'
        ? { status: 'ready', data: ranked.data.map((m) => toMoveVM(m, { committedMoveId }, source)) }
        : ranked,
    [ranked, committedMoveId, source],
  );

  return {
    moves, forecast, level: movesLevel(profile), level2Kinds: LEVEL_2_KINDS, doneCount: doneMoveIds.length,
    commit, uncommit, markDone,
  };
}
