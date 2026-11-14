'use client';

// S10 You in 10 years + Next Moves (`/future`): thin route. The view-model hook feeds the screen.
import Link from 'next/link';
import { useGoal } from '@/features/forecast/model/useGoal';
import { GoalCard } from '@/features/forecast/ui/GoalCard';
import { useFuture } from '@/features/forecast/model/useFuture';
import { FutureScreen } from '@/features/forecast/ui/FutureScreen';
import { SCREEN_ROUTES } from '@/lib/screens';

const links = { today: SCREEN_ROUTES.S1, makeExact: SCREEN_ROUTES.S9 };

export default function FuturePage() {
  const vm = useFuture();
  const goal = useGoal();
  return <><FutureScreen vm={vm} links={links} Link={Link} /><div className="mx-auto max-w-(--container-md) px-lg pb-xl"><GoalCard vm={goal}/></div></>;
}
