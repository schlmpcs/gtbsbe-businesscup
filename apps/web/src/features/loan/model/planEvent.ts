// "Add to my plan" from Loan Lab: the selected offer as a financed Expense on the active plan scenario.
// The loan math rolls fees into the loan (financed = amount − down payment + fees), and the plan event
// finances amount − down payment, so the event's amount is the price plus the fees.
import type { LoanInput } from '@lifeguessr/types';
import { useMemo } from 'react';
import { loan as copy } from '@/copy';
import { useToolPlanEvent, type ToolEventDraft, type ToolPlanEventVM } from '@/features/plan/model/useToolPlanEvent';
import type { LoanLabVM } from './types';

export function planEventFromOffer(input: LoanInput, name: string): ToolEventDraft {
  return {
    type: 'expense',
    name,
    amount: input.amount + (input.fees ?? 0),
    cadence: 'once',
    financing: { downPayment: input.downPayment ?? 0, apr: input.apr, termMonths: input.termMonths },
  };
}

/** The selected valid offer measured on the plan, and the "Add to my plan" action. */
export function useLoanPlan(vm: Pick<LoanLabVM, 'offers' | 'selectedOfferId'>): ToolPlanEventVM {
  const index = vm.offers.findIndex((o) => o.id === vm.selectedOfferId);
  const offer = index >= 0 ? vm.offers[index]! : null;
  const input = offer?.result ? offer.input : null;
  const draft = useMemo(
    () => (input ? planEventFromOffer(input, copy.plan.eventName(copy.offerName(index + 1))) : null),
    [input, index],
  );
  return useToolPlanEvent(draft);
}
