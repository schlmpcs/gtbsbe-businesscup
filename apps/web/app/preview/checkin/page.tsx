// S14 Monthly check-in design preview: sample props, no API, no events. Not linked from the app.
import type { Metadata } from 'next';
import { checkinSample } from '@/features/preview-a/model/samples';
import { CheckinPreview } from '@/features/preview-a/ui/CheckinPreview';
import { PreviewBanner } from '@/features/preview-a/ui/shared';

export const metadata: Metadata = { title: 'Design preview: Monthly check-in', robots: { index: false } };

export default function Page() {
  return (
    <>
      <PreviewBanner />
      <CheckinPreview {...checkinSample} />
    </>
  );
}
