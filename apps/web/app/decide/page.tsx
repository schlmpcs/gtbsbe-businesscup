'use client';

// S13 Decision: the car (`/decide`): thin route. The view-model hook feeds the presentational screen.
import Link from 'next/link';
import { useDecision } from '@/features/mocks/model/useDecision';
import { DecisionScreen, type DecisionLinks } from '@/features/mocks/ui/DecisionScreen';
import { SCREEN_ROUTES } from '@/lib/screens';

const links: DecisionLinks = { loan: SCREEN_ROUTES.S12, afford: SCREEN_ROUTES.S11 };

export default function DecidePage() {
  return <DecisionScreen vm={useDecision()} links={links} Link={Link} />;
}
