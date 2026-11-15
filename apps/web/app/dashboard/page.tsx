'use client';

// P1 Dashboard (/dashboard): thin route. The view-model hook feeds the presentational screen. (The Life
// line decision lives in the onboarding's last step and on /plan, not here.)
import Link from 'next/link';
import { useDashboard } from '@/features/dashboard/model/useDashboard';
import { DashboardScreen } from '@/features/dashboard/ui/DashboardScreen';

export default function DashboardPage() {
  return <DashboardScreen vm={useDashboard()} Link={Link} />;
}
