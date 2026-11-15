'use client';
// "What if?" hub: every tool as the question it answers. Thin route: the view-model hook adds the live
// teasers (the next bill).
import Link from 'next/link';
import { useToolsHub } from '@/features/tools/model/useToolsHub';
import { ToolsHub } from '@/features/tools/ui/ToolsHub';
import { SCREEN_ROUTES } from '@/lib/screens';

const hrefs = {
  afford: SCREEN_ROUTES.S11,
  loan: SCREEN_ROUTES.S12,
  decide: SCREEN_ROUTES.S13,
  checkin: SCREEN_ROUTES.S14,
  subscriptions: SCREEN_ROUTES.S21,
  overpaying: SCREEN_ROUTES.S23,
  exact: SCREEN_ROUTES.S9,
  bills: '/tools/bills',
  spend: '/spend',
  together: '/together',
};

export default function ToolsPage() {
  return <ToolsHub hrefs={hrefs} vm={useToolsHub()} Link={Link} />;
}
