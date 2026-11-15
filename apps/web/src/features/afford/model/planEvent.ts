// "Add to my plan" from /afford: the purchase as a plan Expense event (docs/ENGINEERING.md → plan events).
//   one-time, cash or card → Expense, once (the plan pays it from savings; a card paid off fast is the same money)
//   one-time, loan         → Expense, once, financed: the down payment now, the rest (fees rolled in, as the
//                            loan math does) amortized at the offer's APR and term
//   monthly                → Expense, monthly, at that amount
//   yearly                 → Expense, monthly, at 1/12 of it (the plan has no yearly cadence)
// Recurring costs run to the end of the plan; the person can set an end year on /plan.
import type { Purchase } from '@lifeguessr/types';
import { useMemo } from 'react';
import { useToolPlanEvent, type ToolEventDraft, type ToolPlanEventVM } from '@/features/plan/model/useToolPlanEvent';

export function planEventFromPurchase(p: Purchase): ToolEventDraft {
  const name = p.label;
  if (p.recurring !== false) {
    return { type: 'expense', name, amount: p.recurring === 'monthly' ? p.amount : p.amount / 12, cadence: 'monthly' };
  }
  if (typeof p.payWith === 'object') {
    const l = p.payWith.loan;
    const fees = l.fees ?? 0;
    return {
      type: 'expense',
      name,
      amount: p.amount + fees,
      cadence: 'once',
      financing: { downPayment: l.downPayment ?? 0, apr: l.apr, termMonths: l.termMonths },
    };
  }
  return { type: 'expense', name, amount: p.amount, cadence: 'once' };
}

/** The purchase on the form measured on the active plan scenario, and the "Add to my plan" action. */
export function useAffordPlan(purchase: Purchase | null): ToolPlanEventVM {
  const draft = useMemo(() => (purchase ? planEventFromPurchase(purchase) : null), [purchase]);
  return useToolPlanEvent(draft);
}
