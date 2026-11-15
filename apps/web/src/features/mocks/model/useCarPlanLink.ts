// S13 "Add to my plan": the chosen car path as a plan event on the active /plan scenario, through the
// plan store (the same store /plan reads), with its effect on net worth at retirement from the engine's
// plan() (with the event − without it).
//
// - lease → an Expense, monthly: the lease payment plus the amount due at signing spread over the term
//   (the engine's cost per month), from this year for the 10 years compared.
// - a new car on a loan → an Expense, once: the price, financed (down payment, APR, term).
// - keep → nothing to add: the car loan and the Car budget line are already in the plan.
// - no car → nothing to add as an event: it lowers the Car budget line (Budget), not a new cost.
//
// The scenarios are seeded first (useScenarios, as /plan does), so the event lands on the person's
// own plan and is not replaced by the seed when they open /plan.
import type { CarAlternative } from '@lifeguessr/engine';
import type { PlanEvent, PlanEventOf } from '@lifeguessr/types';
import { useCallback, useMemo, useState } from 'react';
import { mocks as copy } from '@/copy';
import { runEngine } from '@/lib/model/errors';
import { NO_MOVES, planOf, usePlanInputs } from '@/features/plan/model/planEngine';
import { usePlanStore } from '@/features/plan/model/planStore';
import { useScenarios } from '@/features/plan/model/useScenarios';
import type { DecidePlanVM, DecideResultVM } from './types';

export const PLAN_HREF = '/plan';
const PREVIEW_ID = 'ev-car-preview';

export type CarPlanEvent = Omit<PlanEventOf<'expense'>, 'id'>;

/** The plan event for a path, or null when the path adds none. `year` = the plan's first year. */
export function carPlanEvent(
  path: 'keep' | 'alternative',
  alt: CarAlternative,
  result: Pick<DecideResultVM, 'alternativeCost'>,
  year: number,
  horizonYears = 10,
): CarPlanEvent | null {
  if (path === 'keep' || alt.kind === 'noCar') return null;
  if (alt.kind === 'lease') {
    return {
      type: 'expense',
      year,
      enabled: true,
      name: copy.decide.plan.eventName.lease,
      amount: result.alternativeCost.payment + result.alternativeCost.signing,
      cadence: 'monthly',
      endYear: year + horizonYears,
    };
  }
  return {
    type: 'expense',
    year,
    enabled: true,
    name: copy.decide.plan.eventName.buy,
    amount: alt.price,
    cadence: 'once',
    financing: { downPayment: alt.downPayment, apr: alt.apr, termMonths: alt.termMonths },
  };
}

export function useCarPlanLink({ result, alternative }: { result: DecideResultVM | null; alternative: CarAlternative | null }): DecidePlanVM {
  useScenarios(); // seeds the scenarios for this profile, like /plan
  const inputs = usePlanInputs();
  const scenario = usePlanStore((s) => s.scenarios.find((x) => x.id === s.activeId));
  const moves = usePlanStore((s) => s.movesApplied[s.activeId] ?? NO_MOVES);
  const edit = usePlanStore((s) => s.edit);

  const [chosen, setChosen] = useState<'keep' | 'alternative' | null>(null);
  /** The event added from this screen, and the draft it was added from (a changed draft can be added again). */
  const [addedFrom, setAddedFrom] = useState<{ id: string; draft: CarPlanEvent } | null>(null);
  const path = chosen ?? result?.better ?? 'keep';

  const firstYear = Number((inputs.profile.asOf ?? `${new Date().getFullYear()}`).slice(0, 4));
  const draft = useMemo(
    () => (result && alternative ? carPlanEvent(path, alternative, result, firstYear) : null),
    [result, alternative, path, firstYear],
  );

  const addedId = addedFrom?.id ?? null;
  const impact = useMemo(() => {
    if (!draft || !scenario) return null;
    return runEngine(() => {
      // Measured on the plan without the event this screen added (so it is not counted twice).
      const base = addedId && scenario.events.some((e) => e.id === addedId)
        ? { ...scenario, events: scenario.events.filter((e) => e.id !== addedId) }
        : scenario;
      const without = planOf(inputs, base, moves);
      const withEvent = planOf(inputs, { ...base, events: [...base.events, { ...draft, id: PREVIEW_ID }] }, moves);
      return {
        atRetirement: withEvent.kpis.netWorthAtRetirement - without.kpis.netWorthAtRetirement,
        retireAge: without.kpis.retireAge,
      };
    });
  }, [draft, scenario, inputs, moves, addedId]);

  const added =
    addedFrom !== null && addedFrom.draft === draft && (scenario?.events.some((e) => e.id === addedFrom.id) ?? false);

  const add = useCallback(() => {
    const active = usePlanStore.getState().scenarios.find((s) => s.id === usePlanStore.getState().activeId);
    if (!draft || !active) return;
    const id = `ev-${crypto.randomUUID()}`;
    const event: PlanEvent = { ...draft, id };
    edit(active.id, (s) => ({ ...s, events: [...s.events, event] }));
    setAddedFrom({ id, draft });
  }, [draft, edit]);

  const setPath = useCallback((p: 'keep' | 'alternative') => setChosen(p), []);

  const noEventReason: DecidePlanVM['noEventReason'] =
    draft !== null ? null : path === 'keep' ? 'keep' : alternative?.kind === 'noCar' ? 'noCar' : null;

  return {
    path,
    setPath,
    event: draft
      ? { kind: draft.cadence === 'monthly' ? 'leaseExpense' : 'financedExpense', amount: draft.amount, year: draft.year }
      : null,
    noEventReason,
    impact,
    scenarioName: scenario?.name ?? '',
    added,
    add,
    href: PLAN_HREF,
  };
}
