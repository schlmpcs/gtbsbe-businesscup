'use client';

// P3 Transactions (/transactions): thin route. The view-model hook feeds the presentational screen.
// The ledger lives in this browser (IndexedDB); a CSV import sends only masked labels to be categorized.
// `?import=1` (the dashboard's "Import CSV") opens the import panel on arrival.
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useTransactions } from '@/features/transactions/model/useTransactions';
import { TransactionsScreen } from '@/features/transactions/ui/TransactionsScreen';
import { usEasternDate } from '@/lib/dates';
import { SCREEN_ROUTES } from '@/lib/screens';

function Transactions({ openImport }: { openImport: boolean }) {
  return <TransactionsScreen vm={useTransactions()} links={{ upload: SCREEN_ROUTES.S9 }} Link={Link} today={usEasternDate()} openImport={openImport} />;
}

function WithParams() {
  return <Transactions openImport={useSearchParams().get('import') === '1'} />;
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<Transactions openImport={false} />}>
      <WithParams />
    </Suspense>
  );
}
