'use client';

// S12 Loan Lab (Y11): the view-model hook feeds the presentational screen. The debt payoff planner (M13) is
// composed beside it: usePayoffWiring() hands it the real payoff engine, the saved picks, the event sender and the clock.
// useLoanPlan measures the selected offer on the active /plan scenario and adds it there ("Add to my plan").
import Link from 'next/link';
import { useLoanPlan } from '@/features/loan/model/planEvent';
import { usePayoffWiring } from '@/features/loan/model/wiring';
import { usePayoffPlanner } from '@/features/loan/model/usePayoffPlanner';
import { useLoanLab } from '@/features/loan/model/useLoanLab';
import { LoanLabScreen } from '@/features/loan/ui/LoanLabScreen';
import { BackToTools } from '../_components/BackToTools';

export default function LoanLabPage() {
  const vm = useLoanLab();
  const payoff = usePayoffPlanner(vm, usePayoffWiring());
  const plan = useLoanPlan(vm);
  return (
    <>
      <BackToTools />
      <LoanLabScreen vm={vm} payoff={payoff} plan={plan} Link={Link} />
    </>
  );
}
