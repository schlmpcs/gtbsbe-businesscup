// S16 Leaderboard design preview: sample props, no API, no events. Not linked from the app.
import type { Metadata } from 'next';
import { leaderboardSample } from '@/features/preview-a/model/samples';
import { LeaderboardPreview } from '@/features/preview-a/ui/LeaderboardPreview';
import { PreviewBanner } from '@/features/preview-a/ui/shared';

export const metadata: Metadata = { title: 'Design preview: Leaderboard', robots: { index: false } };

export default function Page() {
  return (
    <>
      <PreviewBanner />
      <LeaderboardPreview {...leaderboardSample} />
    </>
  );
}
