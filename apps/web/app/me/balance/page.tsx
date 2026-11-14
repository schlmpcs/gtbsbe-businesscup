'use client';

import { useBalanceSheet } from '@/features/ladder/model/useBalanceSheet';
import { useLadderProgress } from '@/features/ladder/model/useLadderProgress';
import { BalanceSheet } from '@/features/ladder/ui/BalanceSheet';

// S8 Balance sheet (ladder, Y9).
export default function BalanceSheetPage() {
  return <BalanceSheet vm={useBalanceSheet()} progress={useLadderProgress()} />;
}
