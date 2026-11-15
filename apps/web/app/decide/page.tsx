'use client';

// S13 "Keep your car or switch?" (`/decide`): thin route. The view-model hook feeds the presentational screen.
import Link from 'next/link';
import { PLANNER_ROUTES } from '@/features/dashboard/model/links';
import { useDecide } from '@/features/mocks/model/useDecide';
import { DecideScreen } from '@/features/mocks/ui/DecideScreen';
import { BackToTools } from '../_components/BackToTools';

const links = { addCarLoan: PLANNER_ROUTES.addAccount, budget: PLANNER_ROUTES.budget };

export default function DecidePage() {
  return (
    <>
      <BackToTools />
      <DecideScreen vm={useDecide()} links={links} Link={Link} />
    </>
  );
}
