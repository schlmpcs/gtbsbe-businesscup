'use client';

// S13 Decision, car example (`/decide`): thin route. The view-model hook feeds the presentational screen.
import Link from 'next/link';
import { useDecide } from '@/features/mocks/model/useDecide';
import { DecideScreen } from '@/features/mocks/ui/DecideScreen';

export default function DecidePage() {
  return <DecideScreen vm={useDecide()} Link={Link} />;
}
