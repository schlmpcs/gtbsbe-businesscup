'use client';

// S12 Loan Lab (Y11): the view-model hook feeds the presentational screen. The debt payoff planner (M13) is
// composed beside it: usePayoffWiring() answers null until its engine is bound, and then the screen is unchanged.
import Link from 'next/link';
import { usePayoffWiring } from '@/features/loan/model/wiring';
import { usePayoffPlanner } from '@/features/loan/model/usePayoffPlanner';
import { useLoanLab } from '@/features/loan/model/useLoanLab';
import { LoanLabScreen } from '@/features/loan/ui/LoanLabScreen';

export default function LoanLabPage() {
  const vm = useLoanLab();
  const payoff = usePayoffPlanner(vm, usePayoffWiring());
  return <LoanLabScreen vm={vm} payoff={payoff} Link={Link} />;
}
