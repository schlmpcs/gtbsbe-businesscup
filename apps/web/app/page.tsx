'use client';

// "/" (S1): the landing for a new visitor (features/onboarding: one Start into the story at /start, a
// hint of its chapters, "See a sample plan"). A visitor who finished the story, or built a profile on
// the old /me ladder, is sent to /dashboard. Home's numbers live on /dashboard now.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useLanding } from '@/features/onboarding/model/useLanding';
import { Landing } from '@/features/onboarding/ui/Landing';

export default function LandingPage() {
  const vm = useLanding();
  const router = useRouter();
  useEffect(() => {
    if (vm.mode === 'redirect') router.replace(vm.redirectTo);
  }, [vm.mode, vm.redirectTo, router]);
  return <Landing vm={vm} Link={Link} homeHref="/" />;
}
