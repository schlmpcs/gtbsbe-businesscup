// S22 Household: design preview with sample numbers. Not linked from the app.
import type { Metadata } from 'next';
import { householdSample } from '@/features/preview-b/model/samples';
import { Household } from '@/features/preview-b/ui/Household';

export const metadata: Metadata = { robots: { index: false } };

export default function Page() {
  return <Household vm={householdSample} />;
}
