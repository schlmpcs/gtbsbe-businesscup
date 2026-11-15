'use client';

// P2 Account detail (/accounts/[id]): thin route. useAccount feeds the screen; the account's lines and
// the add-a-line form are the Transactions feature's ui, passed in as slots. Deleting goes back to /accounts.
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAccount } from '@/features/accounts/model/useAccount';
import { AccountDetailScreen } from '@/features/accounts/ui/AccountDetailScreen';
import { AddTransactionForm } from '@/features/transactions/ui/AddTransactionForm';
import { TransactionList } from '@/features/transactions/ui/TransactionList';
import { usEasternDate } from '@/lib/dates';

export default function AccountPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const vm = useAccount(decodeURIComponent(id));
  const remove = () => {
    vm.delete();
    router.push('/accounts');
  };
  return (
    <AccountDetailScreen
      vm={{ ...vm, delete: remove }}
      links={{ accounts: '/accounts' }}
      Link={Link}
      transactions={vm.account ? <TransactionList rows={vm.account.transactions} showAccount={false} /> : null}
      renderAddLine={(done) => <AddTransactionForm onAdd={vm.addTransaction} defaultDate={usEasternDate()} onDone={done} />}
    />
  );
}
