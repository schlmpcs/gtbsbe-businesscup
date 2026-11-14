'use client';

// S1 Today (`/`): thin route. The view-model hooks feed the presentational screen; the first visit
// shows a sample life computed by the engine and opens the 2-minute tour.
import Link from 'next/link';
import { useToday } from '@/features/forecast/model/useToday';
import { useSampleLife } from '@/features/forecast/model/useYourNumber';
import { useTourOpen } from '@/features/tour/model/useTour';
import { TodayScreen, type TodayLinks } from '@/features/forecast/ui/TodayScreen';
import { SCREEN_IDS, SCREEN_ROUTES } from '@/lib/screens';

const screens = SCREEN_IDS.map((id) => ({ id, href: SCREEN_ROUTES[id] }));

const links: TodayLinks = {
  play: SCREEN_ROUTES.S2,
  sample: `${SCREEN_ROUTES.S10}?sample=1`,
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
  const sample = useSampleLife();
  const { show: openTour } = useTourOpen();
  return <TodayScreen vm={vm} sample={sample} onTour={openTour} links={links} screens={screens} Link={Link} />;
}
