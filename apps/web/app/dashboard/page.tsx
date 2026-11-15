'use client';

// P1 Dashboard (/dashboard): thin route. The view-model hooks feed the presentational screens. The Life
// line hero (drag "Buy a home", the plan to 90 redraws) leads the cards.
import Link from 'next/link';
import { lifeline as lifelineCopy } from '@/copy';
import { useDashboard } from '@/features/dashboard/model/useDashboard';
import { DashboardScreen } from '@/features/dashboard/ui/DashboardScreen';
import { useLifeLine } from '@/features/lifeline/model/useLifeLine';
import { LifeLineHero } from '@/features/lifeline/ui/LifeLineHero';
import { buttonClassName } from '@/ui-kit';

export default function DashboardPage() {
  const lifeline = useLifeLine();
  const planLink = (
    <Link href="/plan" className={buttonClassName({ variant: 'ghost', size: 'lg' })}>
      {lifelineCopy.apply.open} <span aria-hidden="true">→</span>
    </Link>
  );
  return <DashboardScreen vm={useDashboard()} Link={Link} hero={<LifeLineHero vm={lifeline} planLink={planLink} />} />;
}
