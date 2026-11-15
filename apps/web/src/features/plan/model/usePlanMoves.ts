// Next Moves on /plan, ranked on the active scenario's plan (docs/ENGINEERING.md → "Scenarios, Compare
// and moves on the plan"). The candidates are the engine's level 1 moves for the person's profile
// (moveCandidates: pay the highest-rate card first, trim the largest flexible category, cancel unused
// subscriptions when a statement found them). Each one is measured by running plan() with and without
// its patch: effectAtRetirement = net worth at retirement with the move − without it. rankCandidates
// (the engine's rule) sorts them, drops effects under $1 and keeps the top 3.
//
// "Add to plan" adds the move to the active scenario (planStore.movesApplied): the scenario's plan then
// runs on the profile with the move's patch. The profile itself is not changed. An added move stays on
// the list, measured as the plan with all its moves minus the plan without this one.
//
// The change in Chance of success is not measured here yet (it needs a same-seed Monte Carlo before and
// after each move, MP6): successRateDelta is null and the card leaves it out.
import { moveCandidates, rankCandidates, type MoveCandidate } from '@lifeguessr/engine';
import type { Money, Move } from '@lifeguessr/types';
import { useCallback, useDeferredValue, useMemo } from 'react';
import { ai, common, forecast, plan as copy } from '@/copy';
import { useAppStore } from '@/state/store';
import { NO_MOVES, planOf, profileFor, usePlanInputs } from './planEngine';
import { signedMoney, toneOf } from './planFormat';
import { usePlanStore } from './planStore';
import type { PlanMoveVM, PlanMovesVM } from './types';

/** How many moves the card shows (applied ones always stay). */
const MOVES_SHOWN = 3;

export const movePts = (rate: number): string => {
  const n = Math.round(rate * 100);
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)} pts`;
};

function moveVM(m: Move | MoveCandidate, effect: Money, added: boolean): PlanMoveVM {
  const categoryLabel = m.category ? common.categories[m.category] : undefined;
  return {
    id: m.id,
    title: forecast.moves.title(m.kind, categoryLabel),
    effectAtRetirement: copy.moves.effectAtRetirement(signedMoney(effect)),
    effectAtRetirementRaw: effect,
    successRateDelta: null,
    successRateDeltaRaw: null,
    explanation: `${ai.moveSummary(m.kind, m.category)} ${copy.moves.measured}`,
    added,
    tone: toneOf(effect),
  };
}

export function usePlanMoves(): PlanMovesVM {
  const liveScenario = usePlanStore((s) => s.scenarios.find((x) => x.id === s.activeId));
  const liveApplied = usePlanStore((s) => s.movesApplied[s.activeId] ?? NO_MOVES);
  const applyMove = usePlanStore((s) => s.applyMove);
  const subscriptionsDetected = useAppStore((s) => s.subscriptionsDetected);
  const liveInputs = usePlanInputs();
  // Measuring the moves re-runs plan() a few times: let a drag on the chart paint first.
  const scenario = useDeferredValue(liveScenario);
  const applied = useDeferredValue(liveApplied);
  const inputs = useDeferredValue(liveInputs);

  const ranked = useMemo((): { vms: PlanMoveVM[]; byId: Map<string, Move> } => {
    const byId = new Map<string, Move>();
    if (!scenario) return { vms: [], byId };
    const retirementOf = (moves: readonly Move[]) => planOf(inputs, scenario, moves).kpis.netWorthAtRetirement;
    const withAll = retirementOf(applied);

    // Moves already in the plan: what each one adds on top of the others.
    const appliedVMs = applied.map((m) => moveVM(m, withAll - retirementOf(applied.filter((x) => x.id !== m.id)), true));

    // New candidates on the profile with the applied moves; the applied ones count as taken.
    const profile = profileFor(inputs, applied);
    const taken = { ...profile, doneMoveIds: [...profile.doneMoveIds, ...applied.map((m) => m.id)] };
    const candidates = moveCandidates(taken, { subscriptionsDetected });
    const measured = rankCandidates(taken, candidates, (c) => retirementOf([...applied, { ...c, effect10y: 0 }]) - withAll);
    for (const m of measured) byId.set(m.id, m);
    const fresh = measured.slice(0, Math.max(0, MOVES_SHOWN - appliedVMs.length)).map((m) => moveVM(m, m.effect10y, false));

    const vms = [...appliedVMs, ...fresh].sort((a, b) => b.effectAtRetirementRaw - a.effectAtRetirementRaw);
    return { vms, byId };
  }, [scenario, applied, inputs, subscriptionsDetected]);

  const scenarioId = liveScenario?.id;
  const addToPlan = useCallback(
    (moveId: string) => {
      const move = ranked.byId.get(moveId);
      if (!move || !scenarioId) return;
      // effect10y holds the effect it was ranked by (rankCandidates); the plan reads only the patch.
      applyMove(scenarioId, move);
    },
    [ranked, applyMove, scenarioId],
  );

  return useMemo(() => ({ moves: ranked.vms, addToPlan }), [ranked, addToPlan]);
}
