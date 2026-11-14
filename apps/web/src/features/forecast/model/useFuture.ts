// S10 You in 10 years + Next Moves: the range-band forecast, which inputs are estimates, the top 3
// moves (engine rankMoves) and commit / done.
import { applyPatch, hasEstimates } from '@lifeguessr/engine';
import { useMemo, useState } from 'react';
import { useTrackOnce } from '@/lib/events';
import { runEngine } from '@/lib/model/errors';
import { displayForecast, estimatedFields } from '@/lib/model/profile';
import { useAppReady, useAppStore } from '@/state';
import { howWeCalculate } from './howWeCalculate';
import type { FutureVM, MoveVM } from './types';
import { useMoveExplain, type ExplainFn } from './useMoveExplain';
import { useNextMoves } from './useNextMoves';

const NO_MOVES: MoveVM[] = [];

export function useFuture(opts: { explain?: ExplainFn } = {}): FutureVM {
  const ready = useAppReady();
  const profile = useAppStore((s) => s.profile);
  const committedMove = useAppStore((s) => s.committedMove);
  const [todaysDollars, setTodaysDollars] = useState(true);
  const [compareOn, setCompareOn] = useState(false);
  const nextMoves = useNextMoves(profile);
  const rankedMoves = nextMoves.moves.status === 'ready' ? nextMoves.moves.data : NO_MOVES;
  const { explanations, explain } = useMoveExplain(rankedMoves, opts.explain);

  const result = useMemo(() => runEngine(() => displayForecast(profile, todaysDollars)), [profile, todaysDollars]);

  const committedPreview = useMemo(() => {
    if (!committedMove || profile.committedMoveId !== committedMove.id) return null;
    const preview = runEngine(() => displayForecast(applyPatch(profile, committedMove.patch), todaysDollars));
    return preview.status === 'ready' ? { moveId: committedMove.id, in10y: preview.data.in10y } : null;
  }, [committedMove, profile, todaysDollars]);

  // Compare with the committed move while it is ranked (rankMoves always returns it while it helps),
  // else with the best move.
  const compareMove = rankedMoves.find((m) => m.isCommitted) ?? rankedMoves[0] ?? null;

  const withMove = useMemo(() => {
    if (!compareOn || !compareMove) return null;
    const r = runEngine(() => displayForecast(applyPatch(profile, compareMove.patch), todaysDollars));
    return r.status === 'ready' ? { moveId: compareMove.id, points: r.data.points, in10y: r.data.in10y } : null;
  }, [compareOn, compareMove, profile, todaysDollars]);

  const assumptionsVM = useMemo(() => howWeCalculate(profile), [profile]);

  const band = useMemo(
    () => ({ isZero: !hasEstimates(profile), estimatedFields: estimatedFields(profile) }),
    [profile],
  );

  const points = useMemo(() => (result.status === 'ready' ? result.data.points : []), [result]);
  const yearly = useMemo(() => points.filter((p) => p.month % 12 === 0), [points]);
  const empty = { month: 0, low: 0, mid: 0, high: 0 };

  const status: FutureVM['status'] = !ready ? 'loading' : result.status === 'ready' ? 'ready' : 'error';
  useTrackOnce(status === 'ready', 'forecast_viewed', { name: 'forecast_viewed' });

  return {
    ...nextMoves,
    status,
    error: result.status === 'error' ? result.error : null,
    todaysDollars,
    setTodaysDollars,
    points,
    yearly,
    today: points[0] ?? empty,
    in10y: result.status === 'ready' ? result.data.in10y : empty,
    band,
    committedPreview,
    compareMove,
    compareOn,
    setCompareOn,
    withMove,
    explanations,
    explain,
    howWeCalculate: assumptionsVM,
  };
}
