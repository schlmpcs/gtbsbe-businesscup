'use client';

// S1 Today (`/`): thin route. The view-model hook feeds the presentational screen.
import Link from 'next/link';
import { duel } from '@/copy';
import { useToday } from '@/features/forecast/model/useToday';
import { TodayScreen, type TodayLinks } from '@/features/forecast/ui/TodayScreen';
import { gameMode } from '@/lib/config';
import { linkedScreenIds, SCREEN_ROUTES } from '@/lib/screens';

// With the duel at /play (the default), S2/S3 are its round and reveal, and S4 (the slider's
// streamer mode) is not listed.
const duelTitles: Partial<Record<string, string>> = gameMode() === 'duel' ? duel.screens : {};
const screens = linkedScreenIds().map((id) => ({ id, href: SCREEN_ROUTES[id], title: duelTitles[id] }));

const links: TodayLinks = {
  play: SCREEN_ROUTES.S2,
  sample: `${SCREEN_ROUTES.S10}?sample=1`,
  future: SCREEN_ROUTES.S10,
  tools: '/tools',
  afford: SCREEN_ROUTES.S11,
  loan: SCREEN_ROUTES.S12,
  decide: SCREEN_ROUTES.S13,
  checkin: SCREEN_ROUTES.S14,
  profile: SCREEN_ROUTES.S5,
  upload: SCREEN_ROUTES.S9,
  bills: '/tools/bills',
};

export default function TodayPage() {
  const vm = useToday();
  return <TodayScreen vm={vm} links={links} screens={screens} Link={Link} />;
}
