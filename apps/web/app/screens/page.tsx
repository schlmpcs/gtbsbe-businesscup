// /screens: every screen the app links to, so judges and reviewers can reach each one. Moved off the
// landing (JF15); not linked from the nav and not indexed by search engines.
import type { Metadata } from 'next';
import Link from 'next/link';
import { common, duel, forecast } from '@/copy';
import { ScreensIndex } from '@/features/forecast/ui/ScreensIndex';
import { gameMode } from '@/lib/config';
import { linkedScreenIds, SCREEN_ROUTES } from '@/lib/screens';

export const metadata: Metadata = {
  title: `${forecast.today.allScreens} · ${common.appName}`,
  robots: { index: false, follow: false },
};

// With the duel at /play (the default), S2/S3 are its round and reveal, and S4 (the slider's
// streamer mode) is not listed.
const duelTitles: Partial<Record<string, string>> = gameMode() === 'duel' ? duel.screens : {};
const screens = linkedScreenIds().map((id) => ({ id, href: SCREEN_ROUTES[id], title: duelTitles[id] }));

export default function ScreensPage() {
  return <ScreensIndex screens={screens} Link={Link} />;
}
