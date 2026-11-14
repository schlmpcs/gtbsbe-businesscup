'use client';

// S1 Today (`/`): thin route. The view-model hook feeds the presentational screen.
import Link from 'next/link';
import { useToday } from '@/features/forecast/model/useToday';
import { TodayScreen, type TodayLinks } from '@/features/forecast/ui/TodayScreen';
import { SCREEN_IDS, SCREEN_ROUTES } from '@/lib/screens';

const screens = SCREEN_IDS.map((id) => ({ id, href: SCREEN_ROUTES[id] }));

const links: TodayLinks = {
  play: SCREEN_ROUTES.S2,
  future: SCREEN_ROUTES.S10,
  afford: SCREEN_ROUTES.S11,
  loan: SCREEN_ROUTES.S12,
  decide: SCREEN_ROUTES.S13,
  checkin: SCREEN_ROUTES.S14,
  profile: SCREEN_ROUTES.S5,
  upload: SCREEN_ROUTES.S9,
};

export default function TodayPage() {
  const vm = useToday();
  return <TodayScreen vm={vm} links={links} screens={screens} Link={Link} />;
}
