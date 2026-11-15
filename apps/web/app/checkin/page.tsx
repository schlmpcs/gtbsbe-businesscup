'use client';

// S14 Monthly check-in (`/checkin`): thin route. The view-model hook feeds the presentational screen.
import Link from 'next/link';
import { useCheckin } from '@/features/mocks/model/useCheckin';
import { CheckinScreen } from '@/features/mocks/ui/CheckinScreen';
import { BackToTools } from '../_components/BackToTools';

export default function CheckinPage() {
  return (
    <>
      <BackToTools />
      <CheckinScreen vm={useCheckin()} Link={Link} />
    </>
  );
}
