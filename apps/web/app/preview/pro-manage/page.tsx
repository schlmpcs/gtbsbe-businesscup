// S27 Manage Pro design preview: sample props, no API, no events. Not linked from the app.
import type { Metadata } from 'next';
import { manageProSample } from '@/features/preview-a/model/samples';
import { ManageProPreview } from '@/features/preview-a/ui/ManageProPreview';
import { PreviewBanner } from '@/features/preview-a/ui/shared';

export const metadata: Metadata = { title: 'Design preview: Manage Pro', robots: { index: false } };

export default function Page() {
  return (
    <>
      <PreviewBanner />
      <ManageProPreview {...manageProSample} />
    </>
  );
}
