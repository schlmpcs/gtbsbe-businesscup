// S10 You in N years + Next Moves: the range-band forecast (AI, else rules; see useForecastBundle) at
// the picked horizon, which inputs are estimates, the top 3 moves and commit / done. Every number on
// screen is read from the one answered bundle at that year, so the headline, the chart, the comparison,
// the band and the moves agree; picking another year re-reads it (no request).
import { pointAt } from '@lifeguessr/engine';
import type { ForecastPoint, HorizonYears } from '@lifeguessr/types';
import { useMemo, useState } from 'react';
import { useTrackOnce } from '@/lib/events';
import { runEngine } from '@/lib/model/errors';
import { areaRates, estimatedFields } from '@/lib/model/profile';
import { useAppStore, useProfile } from '@/state';
import { answerDollars, committedScenario, shownForecast } from './forecastAnswer';
import { howWeCalculate } from './howWeCalculate';
import type { FutureVM, MoveVM } from './types';
import { useMoveExplain, type ExplainFn } from './useMoveExplain';
import { useNextMoves } from './useNextMoves';
import { useSampleRequest } from './useSampleRequest';
import { whyLine } from './whyLine';

const NO_MOVES: MoveVM[] = [];
const NO_POINTS: ForecastPoint[] = [];
const TODAY_EMPTY: ForecastPoint = { month: 0, low: 0, mid: 0, high: 0 };

/** The monthly points from today to the horizon (months 0..12·years): what the chart shows. */
const throughYear = (points: readonly ForecastPoint[], years: HorizonYears): ForecastPoint[] =>
  points.filter((p) => p.month <= 12 * years);

/** `sample`: the page was opened as /future?sample=1 ("Try with sample data"): load the sample life. */
export function useFuture(opts: { explain?: ExplainFn; sample?: boolean } = {}): FutureVM {
  useSampleRequest(opts.sample ?? false);
  const profile = useProfile();
  const committedMove = useAppStore((s) => s.committedMove);
  const [todaysDollars, setTodaysDollars] = useState(true);
  const [compareOn, setCompareOn] = useState(false);
  const nextMoves = useNextMoves(profile);
  const { forecast, horizonYears } = nextMoves;
  const rankedMoves = nextMoves.moves.status === 'ready' ? nextMoves.moves.data : NO_MOVES;
  const { explanations, explain } = useMoveExplain(rankedMoves, opts.explain);

  // The base forecast in the dollars on screen, at the chosen year. Switching dollars or year is reading
  // the answer again: no request.
  const shown = useMemo(() => shownForecast(forecast, todaysDollars, horizonYears), [forecast, todaysDollars, horizonYears]);

  const committedPreview = useMemo(() => {
    if (forecast.status !== 'ready' || !committedMove || profile.committedMoveId !== committedMove.id) return null;
    const { answer } = forecast;
    const scenario = committedScenario(answer, committedMove);
    if (!scenario) return null; // not in this answer (yet): no preview rather than a wrong one
    const point = runEngine(() => pointAt(answerDollars(answer, todaysDollars)(scenario), horizonYears));
    return point.status === 'ready' ? { moveId: committedMove.id, point: point.data } : null;
  }, [forecast, committedMove, profile.committedMoveId, todaysDollars, horizonYears]);

  // Compare with the committed move while it is ranked (the ranking always keeps it while it helps),
  // else with the best move.
  const compareMove = rankedMoves.find((m) => m.isCommitted) ?? rankedMoves[0] ?? null;

  // Ranked moves come from the answer's own candidates, so their scenarios are in it.
  const withMove = useMemo(() => {
    if (!compareOn || !compareMove || forecast.status !== 'ready') return null;
    const { answer } = forecast;
    const scenario = answer.bundle.scenarios[compareMove.id];
    if (!scenario) return null;
    const r = runEngine(() => {
      const shownScenario = answerDollars(answer, todaysDollars)(scenario);
      return { points: throughYear(shownScenario.points, horizonYears), point: pointAt(shownScenario, horizonYears) };
    });
    return r.status === 'ready' ? { moveId: compareMove.id, ...r.data } : null;
  }, [compareOn, compareMove, forecast, todaysDollars, horizonYears]);

  // JF14 "why" line: the first simulated month's flows (rules engine; same for AI and rules answers).
  const why = useMemo(() => {
    const r = runEngine(() => whyLine(profile, areaRates(profile)));
    return r.status === 'ready' ? r.data : null;
  }, [profile]);

  const assumptionsVM = useMemo(() => howWeCalculate(profile), [profile]);

  // Which inputs were estimates in the profile the numbers were made for, not in the live one: during a
  // refresh the user may have just made one exact, and the band on screen still has it in it.
  const bandProfile = forecast.status === 'ready' ? forecast.answer.profile : profile;
  const estimated = useMemo(() => estimatedFields(bandProfile), [bandProfile]);
  const band = useMemo(() => ({ ...shown.band, estimatedFields: estimated }), [shown.band, estimated]);

  const points = useMemo(() => (shown.base ? throughYear(shown.base.points, horizonYears) : NO_POINTS), [shown.base, horizonYears]);
  const yearly = useMemo(() => points.filter((p) => p.month % 12 === 0), [points]);

  // Counted once the numbers are on screen (the AI answer or the rules fallback), not when the page opens.
  useTrackOnce(shown.status === 'ready', 'forecast_viewed', { name: 'forecast_viewed' });

  return {
    ...nextMoves,
    status: shown.status,
    error: shown.error,
    todaysDollars,
    setTodaysDollars,
    points,
    yearly,
    today: points[0] ?? TODAY_EMPTY,
    atHorizon: shown.atHorizon,
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
    why,
  };
}
