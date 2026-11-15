// "What it does to your plan" for a What if? tool (subscriptions, overpaying): one Next Move measured on
// the active /plan scenario by the engine's plan(), run with and without it (the same measure /plan's
// Next Moves card uses, usePlanMoves). Pure: the hook (./usePlanImpact) reads the stores.
//
//   in10y        net worth 10 calendar years from now, with the move − without (plan display unit)
//   atRetirement PlanKpis.netWorthAtRetirement, with − without
//
// Moves already on the scenario stay in both runs (a move of the same id is replaced, not stacked).
import type { MoveCandidate } from '@lifeguessr/engine';
import type { Money, Move, PlanResult, Scenario } from '@lifeguessr/types';
import { patchesEqual } from '@/features/forecast/model/forecastAnswer';
import { planOf, type PlanInputs } from '@/features/plan/model/planEngine';

/** How far ahead the "in 10 years" number looks. */
export const IMPACT_YEARS = 10;

export type PlanImpact = {
  in10y: Money;
  atRetirement: Money;
  /** The calendar year "in 10 years" reads (this year + 10, or the plan's last year when it ends sooner). */
  year10: number;
  retireAge: number;
};

/** Net worth at the end of `year`, or the plan's last year when the plan ends before it. */
export function netWorthIn(result: PlanResult, year: number): Money {
  const hit = result.years.find((y) => y.year === year) ?? result.years.at(-1);
  return hit?.netWorth ?? 0;
}

/** The move as the plan store holds it (effect10y is only a ranking aid; plan() reads the patch). */
export const asMove = (c: MoveCandidate, effect10y: Money = 0): Move => ({ ...c, effect10y });

/** The scenario's moves without `id`, then with the move appended: the two runs compared. */
export function movesAround(applied: readonly Move[], move: Move): { without: Move[]; with: Move[] } {
  const without = applied.filter((m) => m.id !== move.id);
  return { without, with: [...without, move] };
}

export function planImpactOf(inputs: PlanInputs, scenario: Scenario, applied: readonly Move[], candidate: MoveCandidate): PlanImpact {
  const move = asMove(candidate);
  const runs = movesAround(applied, move);
  const base = planOf(inputs, scenario, runs.without);
  const next = planOf(inputs, scenario, runs.with);
  const firstYear = base.years[0]?.year ?? Number((inputs.profile.asOf ?? '0').slice(0, 4));
  const year10 = Math.min(firstYear + IMPACT_YEARS, base.years.at(-1)?.year ?? firstYear + IMPACT_YEARS);
  return {
    in10y: netWorthIn(next, year10) - netWorthIn(base, year10),
    atRetirement: next.kpis.netWorthAtRetirement - base.kpis.netWorthAtRetirement,
    year10,
    retireAge: base.kpis.retireAge,
  };
}

/** Same patch (a move's patch is absolute, so a changed saving makes a different patch). */
export const samePatch = (a: Move['patch'], b: Move['patch']): boolean => patchesEqual(a, b);
