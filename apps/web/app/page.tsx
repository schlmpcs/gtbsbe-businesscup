'use client';

// S1 Today (`/`): thin route. The view-model hook feeds the presentational screen.
// The screen list for judges is at /screens (JF15: not on the production landing).
import Link from 'next/link';
import { useToday } from '@/features/forecast/model/useToday';
import { TodayScreen, type TodayLinks } from '@/features/forecast/ui/TodayScreen';
import { useQuickAdd } from '@/features/spend/model/useQuickAdd';
import { QuickAdd } from '@/features/spend/ui/QuickAdd';
import { SCREEN_ROUTES } from '@/lib/screens';

const links: TodayLinks = {
  play: SCREEN_ROUTES.S2,
  sample: `${SCREEN_ROUTES.S10}?sample=1`,
  future: SCREEN_ROUTES.S10,
  tools: '/tools',
  afford: SCREEN_ROUTES.S11,
  loan: SCREEN_ROUTES.S12,
  decide: SCREEN_ROUTES.S13,
  checkin: SCREEN_ROUTES.S14,
  // First visit: the no-typing onboarding (a statement: generated, a ready-made life's, or your CSV).
  profile: '/start',
  upload: '/start',
  spend: '/spend',
  bills: '/tools/bills',
};

export default function TodayPage() {
  const vm = useToday();
  const quickAdd = useQuickAdd({ ready: vm.status === 'ready' });
  return <TodayScreen vm={vm} links={links} Link={Link} quickAdd={<QuickAdd vm={quickAdd} />} />;
}
