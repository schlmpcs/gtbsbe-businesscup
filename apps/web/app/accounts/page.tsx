'use client';

// P2 Accounts (/accounts): thin route. The view-model hooks feed the presentational screen.
// Accounts live in this browser's store; nothing here reaches a server. The add sheet's "Connect your
// bank (demo)" opens the demo bank link (features/bankDemo, labelled a demo); its transactions go to
// /transactions, whose CSV import reads them like any statement file.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { useAccounts } from '@/features/accounts/model/useAccounts';
import { useAddAccount } from '@/features/accounts/model/useAddAccount';
import { AccountsScreen } from '@/features/accounts/ui/AccountsScreen';
import type { DemoBankId } from '@/features/bankDemo/model/banks';
import { transactionsHandoffHref, useBankDemo } from '@/features/bankDemo/model/useBankDemo';
import { BankDemoSheet } from '@/features/bankDemo/ui/BankDemoSheet';
import { SCREEN_ROUTES } from '@/lib/screens';

export default function AccountsPage() {
  const router = useRouter();
  const addVm = useAddAccount();
  const onUse = useCallback((_file: File, bankId: DemoBankId) => router.push(transactionsHandoffHref(bankId)), [router]);
  const bank = useBankDemo({ onUse });
  const { close } = addVm;
  const { start } = bank;
  const connectBank = useCallback(() => {
    close();
    start();
  }, [close, start]);
  return (
    <>
      <AccountsScreen vm={useAccounts()} addVm={addVm} links={{ upload: SCREEN_ROUTES.S9 }} Link={Link} onConnectBank={connectBank} />
      <BankDemoSheet vm={bank} />
    </>
  );
}
