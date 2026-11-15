// The person's transactions as monthly averages by category (engine statementAverages over the ledger's
// statementTotals, the same numbers Budget and Cash flow read), to prefill rent, groceries and childcare.
import { statementAverages } from '@lifeguessr/engine';
import { useMemo } from 'react';
import { useLedger } from '@/features/transactions/model/transactionsStore';
import { transactionTotals } from '@/lib/model/transactions';
import type { LedgerAverages } from './inputs';

export function useLedgerAverages(): LedgerAverages | null {
  const { lines, ready } = useLedger();
  return useMemo(() => {
    if (!ready || lines.length === 0) return null;
    const { spending, months } = statementAverages(transactionTotals(lines));
    return months.length > 0 ? spending : null;
  }, [lines, ready]);
}
