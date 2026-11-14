'use client';

// The app shell (MP14) wired to the router: features/shell's view-model + presentational shell,
// with next/link as the Link. The root layout wraps every page in it.
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useShell } from '@/features/shell/model/useShell';
import { AppShell } from '@/features/shell/ui/AppShell';

export function Shell({ banner, footer, children }: { banner?: ReactNode; footer?: ReactNode; children: ReactNode }) {
  const vm = useShell();
  return (
    <AppShell vm={vm} Link={Link} banner={banner} footer={footer}>
      {children}
    </AppShell>
  );
}
