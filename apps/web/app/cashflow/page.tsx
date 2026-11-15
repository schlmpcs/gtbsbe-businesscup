'use client';

// P4 Cash Flow (/cashflow, also served at /cash-flow): thin route. The view-model hook feeds the presentational screen.
import Link from 'next/link';
import { useCashFlow } from '@/features/cashflow/model/useCashFlow';
import { CashFlowScreen } from '@/features/cashflow/ui/CashFlowScreen';
import { PLANNER_ROUTES } from '@/features/dashboard/model/links';

const links = { guess: PLANNER_ROUTES.guessOwnMonth, upload: '/me/upload', transactions: PLANNER_ROUTES.transactions };

export default function CashFlowPage() {
  return <CashFlowScreen vm={useCashFlow()} links={links} Link={Link} />;
}
