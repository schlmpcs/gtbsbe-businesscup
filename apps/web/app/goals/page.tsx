'use client';

// P7 Goals (/goals): thin route. "Save up" is useGoals(); "Pay down" links to the Loan Lab (/loan).
import Link from 'next/link';
import { useGoals } from '@/features/goals/model/useGoals';
import { GoalsScreen } from '@/features/goals/ui/GoalsScreen';
import { PLANNER_ROUTES } from '@/features/dashboard/model/links';

const links = { loan: '/loan', guess: PLANNER_ROUTES.guessOwnMonth, upload: '/me/upload' };

export default function GoalsPage() {
  return <GoalsScreen vm={useGoals()} links={links} Link={Link} />;
}
