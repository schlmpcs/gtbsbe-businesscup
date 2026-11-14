// S29 Shared decision (/d/[id]) design preview: sample props, no API, no events. Not linked from the app.
import type { Metadata } from 'next';
import { sharedDecisionSample } from '@/features/preview-a/model/samples';
import { SharedDecisionPreview } from '@/features/preview-a/ui/SharedDecisionPreview';
import { PreviewBanner } from '@/features/preview-a/ui/shared';

export const metadata: Metadata = { title: 'Design preview: Shared decision', robots: { index: false } };

export default function Page() {
  return (
    <>
      <PreviewBanner />
      <SharedDecisionPreview {...sharedDecisionSample} />
    </>
  );
}
