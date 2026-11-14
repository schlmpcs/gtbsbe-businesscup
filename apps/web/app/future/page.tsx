'use client';

// S10 You in 10 years + Next Moves (`/future`): thin route. The view-model hooks feed the screen.
// `?sample=1` ("See a sample life" on S1) loads the sample life first.
import Link from 'next/link';
import { use } from 'react';
import { useFuture } from '@/features/forecast/model/useFuture';
import { useGoal } from '@/features/forecast/model/useGoal';
import { useNumberHero } from '@/features/forecast/model/useYourNumber';
import { FutureScreen } from '@/features/forecast/ui/FutureScreen';
import { GoalCard } from '@/features/forecast/ui/GoalCard';
import { SCREEN_ROUTES } from '@/lib/screens';
import { whatIf } from '@/copy';
import { Card, buttonClassName } from '@/ui-kit';

const links = { today: SCREEN_ROUTES.S1, makeExact: SCREEN_ROUTES.S9 };

export default function FuturePage({ searchParams }: { searchParams: Promise<{ sample?: string | string[] }> }) {
  const { sample } = use(searchParams);
  const vm = useFuture({ sample: sample === '1' });
  const hero = useNumberHero();
  const goal = useGoal();
  const goalAndWhatIf = (
    <>
      <GoalCard vm={goal} />
      <Card title={whatIf.entry.title}>
        <p className="mb-md text-text-muted">{whatIf.entry.body}</p>
        <Link href="/what-if" className={buttonClassName({ variant: 'primary' })}>
          {whatIf.entry.cta}
        </Link>
      </Card>
    </>
  );
  return <FutureScreen vm={vm} hero={hero} goal={goalAndWhatIf} links={links} Link={Link} />;
}
