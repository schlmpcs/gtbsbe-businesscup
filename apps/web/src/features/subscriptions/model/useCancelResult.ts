// The cancel plan's 10-year number and its "add as my next move" (M5, issue #81).
//
// Kept apart from `useSubscriptions` on purpose: this is the one part that asks the forecast route (the
// model's forecast, else the rules), and `useForecastBundle` cannot be switched off. A cold visit, a guess,
// ticks, or a plan with nothing marked must not cost a forecast request, so the screen mounts a component
// that calls this hook only while the plan step shows at least one mark (`SubscriptionsTool`). Called with
// no candidate it still asks for the base forecast: do not mount it then.
//
// The measurement is not a new formula: it is the one Next Moves uses (`useNextMoves.rankAnswer`), the
// answer's own scenario minus its base at month 120 in today's dollars, ranked by the engine's
// `rankCandidates`; `addAsMove` is the existing `commitMove`.
import { rankCandidates, type MoveCandidate } from '@lifeguessr/engine';
import type { Move, Profile } from '@lifeguessr/types';
import { useCallback, useMemo } from 'react';
import { answerDollars, forecastIsBusy } from '@/features/forecast/model/forecastAnswer';
import { useForecastBundle } from '@/features/forecast/model/useForecastBundle';
import { track as defaultTrack } from '@/lib/events';
import { runEngine } from '@/lib/model/errors';
import { useAppStore } from '@/state';
import type { CancelEffectVM, CancelResultVM, Loadable } from './types';

const NO_CANDIDATES: MoveCandidate[] = [];

export type CancelResultDeps = {
  /** The event sender (lib/events `track`). */
  track?: typeof defaultTrack;
};

export function useCancelResult(profile: Profile, candidate: MoveCandidate | null, deps: CancelResultDeps = {}): CancelResultVM {
  const track = deps.track ?? defaultTrack;
  const commitMove = useAppStore((s) => s.commitMove);

  const candidates = useMemo(() => (candidate ? [candidate] : NO_CANDIDATES), [candidate]);
  const forecast = useForecastBundle(profile, candidates);

  const measured: Loadable<{ move: Move | null; source: CancelEffectVM['source'] }> | null = useMemo(() => {
    if (!candidate) return null;
    if (forecast.status === 'error') return { status: 'error', error: forecast.error };
    if (forecast.status === 'loading' || forecast.isStale) return { status: 'loading' };
    const { answer, source } = forecast;
    const asked = answer.candidates.filter((c) => c.id === candidate.id);
    if (asked.length === 0) return { status: 'loading' }; // an answer for another set of candidates
    return runEngine(() => {
      const dollars = answerDollars(answer, true);
      const base = dollars(answer.bundle.base).in10y.mid;
      const effectOf = (c: MoveCandidate) => {
        const scenario = answer.bundle.scenarios[c.id];
        if (!scenario) throw new RangeError(`the forecast has no scenario for ${c.id}`);
        return dollars(scenario).in10y.mid - base;
      };
      const [ranked] = rankCandidates(answer.profile, asked, effectOf);
      return { move: ranked ?? null, source };
    });
  }, [candidate, forecast]);

  const effect: CancelResultVM['effect'] = useMemo(
    () => (measured?.status === 'ready'
      ? { status: 'ready', data: { effect10y: measured.data.move?.effect10y ?? 0, source: measured.data.source } }
      : measured),
    [measured],
  );
  const busy = forecastIsBusy(forecast);
  const moveToAdd = measured?.status === 'ready' ? measured.data.move : null;

  const addAsMove = useCallback(() => {
    if (!moveToAdd || busy) return;
    commitMove(moveToAdd);
    track({ name: 'move_committed', props: { kind: moveToAdd.kind } });
  }, [moveToAdd, busy, commitMove, track]);

  return { effect, canAddAsMove: moveToAdd !== null && !busy, addAsMove };
}
