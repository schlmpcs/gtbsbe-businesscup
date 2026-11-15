'use client';

// Daily spending log (`/spend`): thin route. The view-model hook feeds the presentational screen.
import Link from 'next/link';
import { useSpend } from '@/features/spend/model/useSpend';
import { SpendScreen } from '@/features/spend/ui/SpendScreen';
import { BackToTools } from '../_components/BackToTools';

export default function SpendPage() {
  return (
    <>
      <BackToTools width="5xl" />
      <SpendScreen vm={useSpend()} homeHref="/" Link={Link} />
    </>
  );
}
