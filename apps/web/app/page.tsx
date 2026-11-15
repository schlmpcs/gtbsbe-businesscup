'use client';

// S1 Today (`/`): thin route. The view-model hooks feed the presentational screens.
// The Life line hero (drag "Buy a home", the plan to 90 redraws) leads the page; the screen list for
// judges is at /screens (JF15: not on the production landing).
import Link from 'next/link';
import { lifeline as lifelineCopy } from '@/copy';
import { useToday } from '@/features/forecast/model/useToday';
import { TodayScreen, type TodayLinks } from '@/features/forecast/ui/TodayScreen';
import { useLifeLine } from '@/features/lifeline/model/useLifeLine';
import { LifeLineHero } from '@/features/lifeline/ui/LifeLineHero';
import { useQuickAdd } from '@/features/spend/model/useQuickAdd';
import { QuickAdd } from '@/features/spend/ui/QuickAdd';
import { SCREEN_ROUTES } from '@/lib/screens';
import { buttonClassName } from '@/ui-kit';

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
  onboarding: '/start',
  upload: SCREEN_ROUTES.S9,
  spend: '/spend',
  bills: '/tools/bills',
};

export default function TodayPage() {
  const vm = useToday();
  const lifeline = useLifeLine();
  const quickAdd = useQuickAdd({ ready: vm.status === 'ready' });
  const planLink = (
    <Link href={links.future} className={buttonClassName({ variant: 'ghost', size: 'lg' })}>
      {lifelineCopy.apply.open} <span aria-hidden="true">→</span>
    </Link>
  );
  return (
    <TodayScreen
      vm={vm}
      links={links}
      Link={Link}
      quickAdd={<QuickAdd vm={quickAdd} />}
      hero={<LifeLineHero vm={lifeline} planLink={planLink} />}
    />
  );
}
