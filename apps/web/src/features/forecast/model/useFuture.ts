// S10 You in 10 years + Next Moves: the range-band forecast (AI, else rules; see useForecastBundle),
// which inputs are estimates, the top 3 moves and commit / done. Every number on screen is read from
// the one answered bundle, so the headline, the chart, the comparison and the moves agree.
import { hasEstimates } from '@lifeguessr/engine';
import type { Forecast, ForecastPoint } from '@lifeguessr/types';
import { useMemo, useState } from 'react';
import { runEngine } from '@/lib/model/errors';
import { estimatedFields } from '@/lib/model/profile';
import type { Loadable } from '@/lib/model/types';
import { useAppStore } from '@/state';
import { howWeCalculate } from './howWeCalculate';
import type { BandKind, FutureVM, MoveVM } from './types';
import { answerDollars, committedScenario } from './useForecastBundle';
import { useMoveExplain, type ExplainFn } from './useMoveExplain';
import { useNextMoves } from './useNextMoves';

const NO_MOVES: MoveVM[] = [];
const NO_POINTS: ForecastPoint[] = [];
const EMPTY: ForecastPoint = { month: 0, low: 0, mid: 0, high: 0 };

export function useFuture(opts: { explain?: ExplainFn } = {}): FutureVM {
  const profile = useAppStore((s) => s.profile);
  const committedMove = useAppStore((s) => s.committedMove);
  const [todaysDollars, setTodaysDollars] = useState(true);
  const [compareOn, setCompareOn] = useState(false);
  const nextMoves = useNextMoves(profile);
  const { forecast } = nextMoves;
  const rankedMoves = nextMoves.moves.status === 'ready' ? nextMoves.moves.data : NO_MOVES;
  const { explanations, explain } = useMoveExplain(rankedMoves, opts.explain);

  // The base forecast in the dollars on screen. Switching dollars is arithmetic on the answer: no request.
  const base: Loadable<Forecast> | null = useMemo(() => {
    if (forecast.status !== 'ready') return null;
    const { answer } = forecast;
    return runEngine(() => answerDollars(answer, todaysDollars)(answer.bundle.base));
  }, [forecast, todaysDollars]);

  const committedPreview = useMemo(() => {
    if (forecast.status !== 'ready' || !committedMove || profile.committedMoveId !== committedMove.id) return null;
    const { answer } = forecast;
    const scenario = committedScenario(answer, committedMove);
    if (!scenario) return null; // not in this answer (yet): no preview rather than a wrong one
    const preview = runEngine(() => answerDollars(answer, todaysDollars)(scenario));
    return preview.status === 'ready' ? { moveId: committedMove.id, in10y: preview.data.in10y } : null;
  }, [forecast, committedMove, profile.committedMoveId, todaysDollars]);

  // Compare with the committed move while it is ranked (the ranking always keeps it while it helps),
  // else with the best move.
  const compareMove = rankedMoves.find((m) => m.isCommitted) ?? rankedMoves[0] ?? null;

  // Ranked moves come from the answer's own candidates, so their scenarios are in it.
  const withMove = useMemo(() => {
    if (!compareOn || !compareMove || forecast.status !== 'ready') return null;
    const { answer } = forecast;
    const scenario = answer.bundle.scenarios[compareMove.id];
    if (!scenario) return null;
    const r = runEngine(() => answerDollars(answer, todaysDollars)(scenario));
    return r.status === 'ready' ? { moveId: compareMove.id, points: r.data.points, in10y: r.data.in10y } : null;
  }, [compareOn, compareMove, forecast, todaysDollars]);

  const assumptionsVM = useMemo(() => howWeCalculate(profile), [profile]);
  const estimated = useMemo(() => estimatedFields(profile), [profile]);

  const points = base?.status === 'ready' ? base.data.points : NO_POINTS;
  const yearly = useMemo(() => points.filter((p) => p.month % 12 === 0), [points]);
  const in10y = base?.status === 'ready' ? base.data.in10y : EMPTY;

  // The AI band is the model's own: zero only when it gave a single number. The rules band comes from
  // the estimated inputs: zero when nothing is estimated.
  const source = forecast.status === 'ready' ? forecast.source : null;
  const kind: BandKind = source === 'ai' ? 'model' : 'inputs';
  const isZero = source === 'ai' ? in10y.high - in10y.low < 1 : !hasEstimates(profile);
  const band = useMemo(() => ({ isZero, kind, estimatedFields: estimated }), [isZero, kind, estimated]);

  const failure = forecast.status === 'error' ? forecast.error : base?.status === 'error' ? base.error : null;

  return {
    ...nextMoves,
    status: failure ? 'error' : base?.status === 'ready' ? 'ready' : 'loading',
    error: failure,
    todaysDollars,
    setTodaysDollars,
    points,
    yearly,
    today: points[0] ?? EMPTY,
    in10y,
    source,
    isRefreshing: forecast.status === 'ready' && forecast.isRefreshing,
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
