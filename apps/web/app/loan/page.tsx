'use client';

// S12 Loan Lab (Y11): the view-model hook feeds the presentational screen.
import { useLoanLab } from '@/features/loan/model/useLoanLab';
import { LoanLabScreen } from '@/features/loan/ui/LoanLabScreen';

export default function LoanLabPage() {
  return <LoanLabScreen vm={useLoanLab()} />;
}
