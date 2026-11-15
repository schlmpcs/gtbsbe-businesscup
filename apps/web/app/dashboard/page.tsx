'use client';

// P1 Dashboard (/dashboard): thin route. The view-model hook feeds the presentational screen.
import Link from 'next/link';
import { useDashboard } from '@/features/dashboard/model/useDashboard';
import { DashboardScreen } from '@/features/dashboard/ui/DashboardScreen';

export default function DashboardPage() {
  return <DashboardScreen vm={useDashboard()} Link={Link} />;
}
