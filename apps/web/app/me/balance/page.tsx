'use client';

import { useBalanceSheet } from '@/features/ladder/model/useBalanceSheet';
import { useGuessPayoff } from '@/features/ladder/model/useGuessPayoff';
import { useLadderProgress } from '@/features/ladder/model/useLadderProgress';
import { BalanceSheet } from '@/features/ladder/ui/BalanceSheet';

// S8 Balance sheet (ladder, Y9), with the S5 guess paid off against the month (useGuessPayoff).
export default function BalanceSheetPage() {
  return <BalanceSheet vm={useBalanceSheet()} progress={useLadderProgress()} payoff={useGuessPayoff()} />;
}
