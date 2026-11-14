// S23 Overpaying check: design preview with sample numbers. Not linked from the app.
import type { Metadata } from 'next';
import { overpayingSample } from '@/features/preview-b/model/samples';
import { OverpayingCheck } from '@/features/preview-b/ui/OverpayingCheck';

export const metadata: Metadata = { robots: { index: false } };

export default function Page() {
  return <OverpayingCheck vm={overpayingSample()} />;
}
