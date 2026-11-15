// S13 "Add to my plan": the chosen car path as a plan event on the active /plan scenario, through the
// What if? tools' shared hook (useToolPlanEvent: the engine's previewEvent with vs without, then the
// plan store /plan reads; it seeds the scenarios first, like /plan).
//
// - lease → an Expense, monthly: the lease payment plus the amount due at signing spread over the term
//   (the engine's cost per month), for the 10 years compared.
// - a new car on a loan → an Expense, once: the price, financed (down payment, APR, term).
// - keep → nothing to add: the car loan and the Car budget line are already in the plan.
// - no car → nothing to add as an event: it lowers the Car budget line (Budget), not a new cost.
import type { CarAlternative } from '@lifeguessr/engine';
import { useCallback, useMemo, useState } from 'react';
import { mocks as copy } from '@/copy';
import { useToolPlanEvent, type ToolEventDraft } from '@/features/plan/model/useToolPlanEvent';
import type { DecidePlanVM, DecideResultVM } from './types';

/** The plan event for a path, without its id, year and `enabled` (the hook adds them); null when the path adds none. */
export function carPlanDraft(
  path: 'keep' | 'alternative',
  alt: CarAlternative,
  result: Pick<DecideResultVM, 'alternativeCost'>,
  startYear: number,
  horizonYears = 10,
): ToolEventDraft | null {
  if (path === 'keep' || alt.kind === 'noCar') return null;
  if (alt.kind === 'lease') {
    return {
      type: 'expense',
      name: copy.decide.plan.eventName.lease,
      amount: result.alternativeCost.payment + result.alternativeCost.signing,
      cadence: 'monthly',
      endYear: startYear + horizonYears,
    };
  }
  return {
    type: 'expense',
    name: copy.decide.plan.eventName.buy,
    amount: alt.price,
    cadence: 'once',
    financing: { downPayment: alt.downPayment, apr: alt.apr, termMonths: alt.termMonths },
  };
}

export function useCarPlanLink({
  result,
  alternative,
  startYear,
}: {
  result: DecideResultVM | null;
  alternative: CarAlternative | null;
  startYear: number;
}): DecidePlanVM {
  const [chosen, setChosen] = useState<'keep' | 'alternative' | null>(null);
  const path = chosen ?? result?.better ?? 'keep';
  const draft = useMemo(
    () => (result && alternative ? carPlanDraft(path, alternative, result, startYear) : null),
    [result, alternative, path, startYear],
  );
  const tool = useToolPlanEvent(draft);
  const setPath = useCallback((p: 'keep' | 'alternative') => setChosen(p), []);

  const noEventReason: DecidePlanVM['noEventReason'] =
    draft !== null ? null : path === 'keep' ? 'keep' : alternative?.kind === 'noCar' ? 'noCar' : null;

  return {
    path,
    setPath,
    event:
      draft?.type === 'expense'
        ? { kind: draft.cadence === 'monthly' ? 'leaseExpense' : 'financedExpense', amount: draft.amount, year: startYear }
        : null,
    noEventReason,
    tool,
  };
}
