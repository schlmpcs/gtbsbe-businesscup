// S25 Runway: design preview with sample numbers. Not linked from the app.
import type { Metadata } from 'next';
import { runwaySample } from '@/features/preview-b/model/samples';
import { Runway } from '@/features/preview-b/ui/Runway';

export const metadata: Metadata = { robots: { index: false } };

export default function Page() {
  return <Runway vm={runwaySample} />;
}
