// S20 Tools hub: design preview with sample numbers. Not linked from the app.
import type { Metadata } from 'next';
import { hubSample } from '@/features/preview-b/model/samples';
import { ToolsHub } from '@/features/preview-b/ui/ToolsHub';

export const metadata: Metadata = { robots: { index: false } };

export default function Page() {
  return <ToolsHub vm={hubSample} />;
}
