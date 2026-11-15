// "What it does to your plan" + "Add to my plan" for a What if? tool: a Next Move measured on the active
// /plan scenario (./planImpact, engine plan() with and without) and added to it through the plan store
// (applyMove), so /plan shows it on its Next Moves card and runs every number with it. A move of the same
// id already on the plan with another patch is "outdated": adding replaces it.
//
// The scenarios are seeded from the profile the same way /plan seeds them (useScenarios), so a tool
// opened before /plan measures on the same Baseline the person will see there.
import type { MoveCandidate } from '@lifeguessr/engine';
import type { Money, Move } from '@lifeguessr/types';
import { useCallback, useMemo } from 'react';
import { usePlanInputs } from '@/features/plan/model/planEngine';
import { usePlanStore } from '@/features/plan/model/planStore';
import { useScenarios } from '@/features/plan/model/useScenarios';
import { runEngine } from '@/lib/model/errors';
import { useAppStore } from '@/state';
import { asMove, planImpactOf, samePatch } from './planImpact';

export const PLAN_HREF = '/plan';

const NO_MOVES: readonly Move[] = [];

export type PlanImpactVM =
  | { status: 'none' }
  | { status: 'error' }
  | {
      status: 'ready';
      /** Net worth in `year10`, with the move − without. */
      in10y: Money;
      atRetirement: Money;
      year10: number;
      retireAge: number;
      /** The plan runs on the sample profile (nothing of the person's own yet). */
      isSample: boolean;
      /** Name of the /plan scenario it is measured on and added to. */
      scenarioName: string;
      /** new: not on the plan; added: on it as it stands; outdated: on it with an older patch. */
      state: 'new' | 'added' | 'outdated';
      add: () => void;
      remove: () => void;
      planHref: string;
    };

export type ReadyPlanImpactVM = Extract<PlanImpactVM, { status: 'ready' }>;

/** One move: its impact on the active scenario and the way to add it. */
export function usePlanImpact(candidate: MoveCandidate | null, opts: PlanImpactOptions = {}): PlanImpactVM {
  const list = useMemo(() => (candidate ? [candidate] : []), [candidate]);
  return usePlanImpacts(list, opts)[0] ?? NONE;
}

export type PlanImpactOptions = {
  /** Called after a move is added (the tool sends its `move_committed` event: the kind only). */
  onAdded?: (move: Move) => void;
};

const NONE: PlanImpactVM = { status: 'none' };

/** Several moves, each measured on its own against the active scenario (in the order given). */
export function usePlanImpacts(candidates: readonly MoveCandidate[], { onAdded }: PlanImpactOptions = {}): PlanImpactVM[] {
  useScenarios(); // seeds the scenarios from the profile, as /plan does
  const scenario = usePlanStore((s) => s.scenarios.find((x) => x.id === s.activeId));
  const applied = usePlanStore((s) => s.movesApplied[s.activeId] ?? NO_MOVES);
  const applyMove = usePlanStore((s) => s.applyMove);
  const removeMove = usePlanStore((s) => s.removeMove);
  const isSample = useAppStore((s) => s.profileOrigin === 'demo');
  const inputs = usePlanInputs();

  const measured = useMemo(
    () => (scenario ? candidates.map((c) => runEngine(() => planImpactOf(inputs, scenario, applied, c))) : []),
    [candidates, scenario, applied, inputs],
  );

  const scenarioId = scenario?.id;
  const add = useCallback(
    (candidate: MoveCandidate, effect: Money) => {
      if (!scenarioId) return;
      const move = asMove(candidate, effect);
      removeMove(scenarioId, candidate.id);
      applyMove(scenarioId, move);
      onAdded?.(move);
    },
    [scenarioId, applyMove, removeMove, onAdded],
  );
  const remove = useCallback((id: string) => scenarioId && removeMove(scenarioId, id), [scenarioId, removeMove]);

  return useMemo(() => {
    if (!scenario) return candidates.map(() => NONE);
    return candidates.map((candidate, i): PlanImpactVM => {
      const m = measured[i];
      if (!m) return NONE;
      if (m.status !== 'ready') return { status: 'error' };
      const onPlan = applied.find((x) => x.id === candidate.id);
      return {
        status: 'ready',
        ...m.data,
        isSample,
        scenarioName: scenario.name,
        state: onPlan === undefined ? 'new' : samePatch(onPlan.patch, candidate.patch) ? 'added' : 'outdated',
        add: () => add(candidate, m.data.in10y),
        remove: () => {
          remove(candidate.id);
        },
        planHref: PLAN_HREF,
      };
    });
  }, [candidates, measured, scenario, applied, isSample, add, remove]);
}
