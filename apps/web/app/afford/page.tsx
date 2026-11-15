'use client';

// S11 Can I Afford It? (Y11): the view-model hook feeds the presentational screen.
import { useAfford } from '@/features/afford/model/useAfford';
import { AffordScreen } from '@/features/afford/ui/AffordScreen';
import { BackToTools } from '../_components/BackToTools';
import { MixedProfileNotice } from '../_components/MixedProfileNotice';

export default function AffordPage() {
  const vm = useAfford();
  return (
    <>
      <BackToTools />
      <MixedProfileNotice />
      <AffordScreen vm={vm} />
    </>
  );
}
