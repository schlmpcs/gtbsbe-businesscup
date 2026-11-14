// S26 Yearly bills: design preview with sample numbers. Not linked from the app.
import type { Metadata } from 'next';
import { yearlySample } from '@/features/preview-b/model/samples';
import { YearlyBills } from '@/features/preview-b/ui/YearlyBills';

export const metadata: Metadata = { robots: { index: false } };

export default function Page() {
  return <YearlyBills vm={yearlySample} />;
}
