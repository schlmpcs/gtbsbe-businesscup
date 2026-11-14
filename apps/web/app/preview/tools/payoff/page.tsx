// S24 Debt payoff: design preview with sample numbers. Not linked from the app.
import type { Metadata } from 'next';
import { payoffSample } from '@/features/preview-b/model/samples';
import { DebtPayoff } from '@/features/preview-b/ui/DebtPayoff';

export const metadata: Metadata = { robots: { index: false } };

export default function Page() {
  return <DebtPayoff vm={payoffSample()} />;
}
