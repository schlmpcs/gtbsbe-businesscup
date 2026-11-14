// S10 You in 10 years + Next Moves: the range-band forecast (AI, else rules; see useForecastBundle),
// which inputs are estimates, the top 3 moves and commit / done. Every number on screen is read from
// the one answered bundle, so the headline, the chart, the comparison, the band and the moves agree.
import type { ForecastPoint } from '@lifeguessr/types';
import { useMemo, useState } from 'react';
import { runEngine } from '@/lib/model/errors';
import { estimatedFields } from '@/lib/model/profile';
import { useAppStore } from '@/state';
import { answerDollars, committedScenario, shownForecast } from './forecastAnswer';
import { howWeCalculate } from './howWeCalculate';
import type { FutureVM, MoveVM } from './types';
import { useMoveExplain, type ExplainFn } from './useMoveExplain';
import { useNextMoves } from './useNextMoves';

const NO_MOVES: MoveVM[] = [];
const NO_POINTS: ForecastPoint[] = [];
const TODAY_EMPTY: ForecastPoint = { month: 0, low: 0, mid: 0, high: 0 };

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
  const shown = useMemo(() => shownForecast(forecast, todaysDollars), [forecast, todaysDollars]);

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

  // Which inputs were estimates in the profile the numbers were made for, not in the live one: during a
  // refresh the user may have just made one exact, and the band on screen still has it in it.
  const bandProfile = forecast.status === 'ready' ? forecast.answer.profile : profile;
  const estimated = useMemo(() => estimatedFields(bandProfile), [bandProfile]);
  const band = useMemo(() => ({ ...shown.band, estimatedFields: estimated }), [shown.band, estimated]);

  const points = shown.base?.points ?? NO_POINTS;
  const yearly = useMemo(() => points.filter((p) => p.month % 12 === 0), [points]);

  return {
    ...nextMoves,
    status: shown.status,
    error: shown.error,
    todaysDollars,
    setTodaysDollars,
    points,
    yearly,
    today: points[0] ?? TODAY_EMPTY,
    in10y: shown.in10y,
    source: shown.source,
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
