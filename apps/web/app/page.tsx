'use client';

// "/" (S1): the landing for a new visitor (features/onboarding: the life road with one milestone to move,
// one Start into the story at /start, how it works, what you get, the FAQ, "See a sample plan"). A visitor who finished the story, or built a profile on
// the old /me ladder, is sent to /dashboard. Home's numbers live on /dashboard now.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useLanding } from '@/features/onboarding/model/useLanding';
import { useLifeLine } from '@/features/lifeline/model/useLifeLine';
import { LifeRoad } from '@/features/lifeline/ui/LifeRoad';
import { Landing } from '@/features/onboarding/ui/Landing';

export default function LandingPage() {
  const vm = useLanding();
  const lifeline = useLifeLine();
  const router = useRouter();
  useEffect(() => {
    if (vm.mode === 'redirect') router.replace(vm.redirectTo);
  }, [vm.mode, vm.redirectTo, router]);
  return <Landing vm={vm} Link={Link} homeHref="/" demo={<LifeRoad vm={lifeline} />} />;
}
