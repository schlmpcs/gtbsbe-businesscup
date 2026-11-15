// The three best next moves of the active scenario, measured on its plan (planMoveEffects, MP6): the
// engine's move candidates for this profile (moveCandidates, with debt ids = account ids), ranked by the
// change in net worth at retirement. The change in the chance of success (same seed before and after)
// takes four Monte Carlo runs, so it is measured in the Web Worker and arrives after the ranking.
// "Add to my plan" commits the move, as on the forecast screen. The explanation is the move's standard
// sentence (copy.ai.moveSummary, the same text /api/ai/explain starts from); no number comes from a model.
import {
  applyPatch, forecast, moveCandidates, MOVES_SHOWN, planMoveEffects, type MoveCandidate,
} from '@lifeguessr/engine';
import type { Move, MoveKind, PlanMoveEffect, Rate } from '@lifeguessr/types';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ai, common, forecast as forecastCopy, plan as copy } from '@/copy';
import { track } from '@/lib/events';
import { useAppStore } from '@/state/store';
import { startMonteCarloJob } from './monteCarloJob';
import { signedMoney, toneOf } from './planFormat';
import { planProfileOf, usePlanInputs, type PlanInputs } from './planInputs';
import { usePlanStore } from './planStore';
import type { PlanMoveVM, PlanMovesVM } from './types';

export const movePts = (rate: Rate): string => {
  const n = Math.round(rate * 100);
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)} pts`;
};

type Ranked = { candidate: MoveCandidate; effect: PlanMoveEffect };

/** The candidates for this plan's profile and their effect on the scenario's plan, best first, at most three that help. */
function rankedMoves(inputs: PlanInputs, scenario: Parameters<typeof planMoveEffects>[2], subscriptionsDetected: boolean): Ranked[] {
  const candidates = moveCandidates(planProfileOf(inputs), { rates: { inflationAnnual: scenario.assumptions.inflation }, subscriptionsDetected });
  const byId = new Map(candidates.map((c) => [c.id, c]));
  return planMoveEffects(inputs.profile, inputs.accounts, scenario, candidates, inputs.area)
    .filter((e) => e.effectAtRetirement > 0)
    .slice(0, MOVES_SHOWN)
    .map((effect) => ({ candidate: byId.get(effect.moveId)!, effect }));
}

const titleOf = (kind: MoveKind, category: Move['category']) =>
  forecastCopy.moves.title(kind, category ? common.categories[category] : undefined);

export function usePlanMoves(): PlanMovesVM {
  const inputs = usePlanInputs();
  const scenario = usePlanStore((s) => s.scenarios.find((x) => x.id === s.activeId));
  const chanceSettings = usePlanStore((s) => s.chanceSettings);
  const fixedSeed = usePlanStore((s) => s.fixedSeed);
  const subscriptionsDetected = useAppStore((s) => s.subscriptionsDetected);
  const committedId = useAppStore((s) => s.profile.committedMoveId);
  const commitMove = useAppStore((s) => s.commitMove);

  const ranked = useMemo(() => (scenario ? rankedMoves(inputs, scenario, subscriptionsDetected) : []), [inputs, scenario, subscriptionsDetected]);

  // successRateDelta: the same seed with and without each move (the fixed seed, also when it is off for
  // the Chance run, so the deltas compare like with like).
  const [deltas, setDeltas] = useState<{ of: Ranked[]; byId: Record<string, Rate> | null } | null>(null);
  useEffect(() => {
    if (!scenario || ranked.length === 0) return;
    const settings = { ...chanceSettings, seed: chanceSettings.seed ?? fixedSeed };
    return startMonteCarloJob({ kind: 'moveEffects', inputs, scenario, moves: ranked.map((r) => r.candidate), settings }, (res) => {
      const byId = res.kind === 'moveEffects'
        ? Object.fromEntries(res.effects.flatMap((e) => (e.successRateDelta === undefined ? [] : [[e.moveId, e.successRateDelta]])))
        : null;
      setDeltas({ of: ranked, byId });
    });
  }, [inputs, scenario, ranked, chanceSettings, fixedSeed]);

  const addToPlan = useCallback(
    (moveId: string) => {
      const r = ranked.find((x) => x.candidate.id === moveId);
      if (!r) return;
      // The Move the forecast screen commits: its 10-year effect from the rules forecast, today's dollars.
      const p = planProfileOf(inputs);
      const opts = { todaysDollars: true, rates: { inflationAnnual: scenario?.assumptions.inflation } };
      const effect10y = forecast(applyPatch(p, r.candidate.patch), 10, opts).in10y.mid - forecast(p, 10, opts).in10y.mid;
      commitMove({ ...r.candidate, effect10y });
      track({ name: 'move_committed', props: { kind: r.candidate.kind } });
    },
    [ranked, inputs, scenario, commitMove],
  );

  const moves = useMemo((): PlanMoveVM[] => {
    const measured = deltas && deltas.of === ranked ? deltas.byId : undefined;
    return ranked.map(({ candidate, effect }) => {
      const delta = measured ? measured[candidate.id] : undefined;
      const status = measured === undefined ? 'measuring' : delta === undefined ? 'unavailable' : 'done';
      return {
        id: candidate.id,
        title: titleOf(candidate.kind, candidate.category),
        effectAtRetirement: copy.moves.effectAtRetirement(signedMoney(effect.effectAtRetirement)),
        effectAtRetirementRaw: effect.effectAtRetirement,
        successRateDelta: delta === undefined ? copy.planMoves.successRate[status === 'measuring' ? 'measuring' : 'unavailable'] : copy.moves.successRateDelta(movePts(delta)),
        successRateDeltaRaw: delta ?? 0,
        successRateStatus: status,
        explanation: ai.moveSummary(candidate.kind, candidate.category),
        added: committedId === candidate.id,
        tone: toneOf(effect.effectAtRetirement),
      };
    });
  }, [ranked, deltas, committedId]);

  return useMemo(() => ({ moves, addToPlan }), [moves, addToPlan]);
}
