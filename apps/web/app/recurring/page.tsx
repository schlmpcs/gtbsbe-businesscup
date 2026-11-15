'use client';

// P6 Recurring (/recurring): thin route. The view-model hook feeds the presentational screen.
import Link from 'next/link';
import { useRecurring } from '@/features/recurring/model/useRecurring';
import { RecurringScreen } from '@/features/recurring/ui/RecurringScreen';
import { PLANNER_ROUTES } from '@/features/dashboard/model/links';

const links = { guess: PLANNER_ROUTES.guessOwnMonth, upload: '/me/upload' };

export default function RecurringPage() {
  return <RecurringScreen vm={useRecurring()} links={links} Link={Link} />;
}
