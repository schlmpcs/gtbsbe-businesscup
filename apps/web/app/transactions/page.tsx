'use client';

// P3 Transactions (/transactions): thin route. The view-model hook feeds the presentational screen.
// The ledger lives in this browser (IndexedDB); a CSV import sends only masked labels to be categorized.
// `?import=1` (the dashboard's "Import CSV") opens the import panel on arrival. "Connect your bank (demo)"
// is the demo bank link (features/bankDemo, labelled a demo): its statement goes through the same CSV
// import, and also fills the accounts, budget, goals and the plan (bankDemo/model/fillAll). `?bank=<id>`
// is a demo bank connected on /accounts, imported on arrival.
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback } from 'react';
import type { DemoBankId } from '@/features/bankDemo/model/banks';
import { demoBankImporter } from '@/features/bankDemo/model/fillAll';
import { DEMO_BANK_PARAM, useBankDemo, useBankDemoHandoff } from '@/features/bankDemo/model/useBankDemo';
import { BankDemoSheet } from '@/features/bankDemo/ui/BankDemoSheet';
import { useTransactions } from '@/features/transactions/model/useTransactions';
import { TransactionsScreen } from '@/features/transactions/ui/TransactionsScreen';
import { usEasternDate } from '@/lib/dates';
import { SCREEN_ROUTES } from '@/lib/screens';

function Transactions({ openImport, demoBank }: { openImport: boolean; demoBank: string | null }) {
  const router = useRouter();
  const vm = useTransactions();
  const { importCsv } = vm;
  // A demo bank's statement fills every screen, not only this list (bankDemo/model/fillAll).
  const importDemo = useCallback((file: File, bankId: DemoBankId) => void importCsv(file, demoBankImporter(bankId)), [importCsv]);
  const bank = useBankDemo({ onUse: importDemo });
  const clearHandoff = useCallback(() => router.replace('/transactions'), [router]);
  useBankDemoHandoff(demoBank, importDemo, clearHandoff);
  return (
    <>
      <TransactionsScreen
        vm={vm}
        links={{ upload: SCREEN_ROUTES.S9 }}
        Link={Link}
        today={usEasternDate()}
        openImport={openImport}
        onConnectBank={bank.start}
      />
      <BankDemoSheet vm={bank} />
    </>
  );
}

function WithParams() {
  const params = useSearchParams();
  return <Transactions openImport={params.get('import') === '1'} demoBank={params.get(DEMO_BANK_PARAM)} />;
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<Transactions openImport={false} demoBank={null} />}>
      <WithParams />
    </Suspense>
  );
}
