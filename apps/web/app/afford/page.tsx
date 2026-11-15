'use client';

// S11 Can I Afford It? (Y11): the view-model hooks feed the presentational screen. useAffordPlan measures the
// purchase on the active /plan scenario and adds it there as an Expense event ("Add to my plan").
import Link from 'next/link';
import { useAfford } from '@/features/afford/model/useAfford';
import { useAffordPlan } from '@/features/afford/model/planEvent';
import { AffordScreen } from '@/features/afford/ui/AffordScreen';
import { BackToTools } from '../_components/BackToTools';
import { MixedProfileNotice } from '../_components/MixedProfileNotice';

export default function AffordPage() {
  const vm = useAfford();
  const plan = useAffordPlan(vm.purchase);
  return (
    <>
      <BackToTools />
      <MixedProfileNotice />
      <AffordScreen vm={vm} plan={plan} Link={Link} />
    </>
  );
}
