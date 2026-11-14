'use client';

// P5 Budget (/budget): thin route. The view-model hook feeds the presentational screen.
import Link from 'next/link';
import { useBudget } from '@/features/budget/model/useBudget';
import { BudgetScreen } from '@/features/budget/ui/BudgetScreen';
import { PLANNER_ROUTES } from '@/features/dashboard/model/links';

const links = { guess: PLANNER_ROUTES.guessOwnMonth, upload: '/me/upload' };

export default function BudgetPage() {
  return <BudgetScreen vm={useBudget()} links={links} Link={Link} />;
}
