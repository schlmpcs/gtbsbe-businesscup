'use client';

// S14 Monthly check-in (`/checkin`): thin route. The view-model hook feeds the presentational screen.
import Link from 'next/link';
import { useCheckin } from '@/features/mocks/model/useCheckin';
import { CheckinScreen, type CheckinLinks } from '@/features/mocks/ui/CheckinScreen';
import { SCREEN_ROUTES } from '@/lib/screens';

const links: CheckinLinks = { upload: SCREEN_ROUTES.S9, future: SCREEN_ROUTES.S10 };

export default function CheckinPage() {
  return <CheckinScreen vm={useCheckin()} links={links} Link={Link} />;
}
