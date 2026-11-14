// The three best next moves of the active scenario, ranked by net worth at retirement. Fixture-backed:
// the move list, the success-rate deltas and the explanations are stand-ins until moves come from the
// engine (MP6) and /api/ai/explain writes the explanation; the retirement effect is the fixture plan
// with and without the move's event.
import type { PlanEvent, Rate } from '@lifeguessr/types';
import { useCallback, useMemo } from 'react';
import { plan as copy } from '@/copy';
import { FIXTURE_FIRST_YEAR, fixturePlan } from './fixturePlan';
import { signedMoney, toneOf } from './planFormat';
import { usePlanStore } from './planStore';
import type { PlanMoveVM, PlanMovesVM } from './types';

type FixtureMove = { id: string; event: (year: number) => PlanEvent; successRateDelta: Rate };

const MOVES: readonly FixtureMove[] = [
  { id: 'move-extra-income', successRateDelta: 0.06, event: (year) => ({ id: 'ev-move-extra-income', type: 'income', year, enabled: true, monthly: 400 }) },
  { id: 'move-windfall', successRateDelta: 0.04, event: (year) => ({ id: 'ev-move-windfall', type: 'windfall', year, enabled: true, amount: 10_000 }) },
  { id: 'move-side-income', successRateDelta: 0.03, event: (year) => ({ id: 'ev-move-side-income', type: 'income', year, enabled: true, monthly: 250 }) },
];

export const movePts = (rate: Rate): string => {
  const n = Math.round(rate * 100);
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)} pts`;
};

export function usePlanMoves(): PlanMovesVM {
  const scenario = usePlanStore((s) => s.scenarios.find((x) => x.id === s.activeId));
  const edit = usePlanStore((s) => s.edit);
  const scenarioId = scenario?.id;

  const addToPlan = useCallback(
    (moveId: string) => {
      const move = MOVES.find((m) => m.id === moveId);
      if (!move || !scenarioId) return;
      const event = move.event(FIXTURE_FIRST_YEAR + 1);
      edit(scenarioId, (s) => (s.events.some((e) => e.id === event.id) ? s : { ...s, events: [...s.events, event] }));
    },
    [edit, scenarioId],
  );

  const moves = useMemo((): PlanMoveVM[] => {
    if (!scenario) return [];
    return MOVES.map((m) => {
      const event = m.event(FIXTURE_FIRST_YEAR + 1);
      const added = scenario.events.some((e) => e.id === event.id);
      const withMove = added ? scenario : { ...scenario, events: [...scenario.events, event] };
      const effect = fixturePlan(withMove).kpis.netWorthAtRetirement - fixturePlan(scenario, added ? event.id : undefined).kpis.netWorthAtRetirement;
      const text = copy.moves.items[m.id]!;
      return {
        id: m.id,
        title: text.title,
        effectAtRetirement: copy.moves.effectAtRetirement(signedMoney(effect)),
        effectAtRetirementRaw: effect,
        successRateDelta: copy.moves.successRateDelta(movePts(m.successRateDelta)),
        successRateDeltaRaw: m.successRateDelta,
        explanation: text.explanation,
        added,
        tone: toneOf(effect),
      };
    })
      .sort((a, b) => b.effectAtRetirementRaw - a.effectAtRetirementRaw)
      .slice(0, 3);
  }, [scenario]);

  return useMemo(() => ({ moves, addToPlan }), [moves, addToPlan]);
}
