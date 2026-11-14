'use client';

// S10 You in N years + Next Moves (`/future`): thin route. The view-model hook feeds the screen.
// `?sample=1` ("Try with sample data" on S1) loads the sample life first.
import Link from 'next/link';
import { use } from 'react';
import { useGoal } from '@/features/forecast/model/useGoal';
import { GoalCard } from '@/features/forecast/ui/GoalCard';
import { useFuture } from '@/features/forecast/model/useFuture';
import { FutureScreen } from '@/features/forecast/ui/FutureScreen';
import { SCREEN_ROUTES } from '@/lib/screens';

const links = { today: SCREEN_ROUTES.S1, makeExact: SCREEN_ROUTES.S9 };

export default function FuturePage({ searchParams }: { searchParams: Promise<{ sample?: string | string[] }> }) {
  const { sample } = use(searchParams);
  const vm = useFuture({ sample: sample === '1' });
  const goal = useGoal();
  return (
    <FutureScreen
      vm={vm}
      links={links}
      Link={Link}
      goal={<GoalCard vm={goal} makeExactHref={links.makeExact} Link={Link} />}
    />
  );
}
