// S28 Money calendar design preview: sample props, no API, no events. Not linked from the app.
import type { Metadata } from 'next';
import { calendarSample } from '@/features/preview-a/model/samples';
import { CalendarPreview } from '@/features/preview-a/ui/CalendarPreview';
import { PreviewBanner } from '@/features/preview-a/ui/shared';

export const metadata: Metadata = { title: 'Design preview: Money calendar', robots: { index: false } };

export default function Page() {
  return (
    <>
      <PreviewBanner />
      <CalendarPreview {...calendarSample} />
    </>
  );
}
