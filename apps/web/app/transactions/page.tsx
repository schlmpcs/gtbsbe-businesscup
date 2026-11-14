'use client';

// P3 Transactions (/transactions): thin route. The view-model hook feeds the presentational screen.
// The ledger lives in this browser (IndexedDB); a CSV import sends only masked labels to be categorized.
import Link from 'next/link';
import { useTransactions } from '@/features/transactions/model/useTransactions';
import { TransactionsScreen } from '@/features/transactions/ui/TransactionsScreen';
import { usEasternDate } from '@/lib/dates';
import { SCREEN_ROUTES } from '@/lib/screens';

export default function TransactionsPage() {
  return <TransactionsScreen vm={useTransactions()} links={{ upload: SCREEN_ROUTES.S9 }} Link={Link} today={usEasternDate()} />;
}
