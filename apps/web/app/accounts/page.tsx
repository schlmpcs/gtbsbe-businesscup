'use client';

// P2 Accounts (/accounts): thin route. The view-model hooks feed the presentational screen.
// Accounts live in this browser's store; nothing here reaches a server.
import Link from 'next/link';
import { useAccounts } from '@/features/accounts/model/useAccounts';
import { useAddAccount } from '@/features/accounts/model/useAddAccount';
import { AccountsScreen } from '@/features/accounts/ui/AccountsScreen';
import { SCREEN_ROUTES } from '@/lib/screens';

export default function AccountsPage() {
  return <AccountsScreen vm={useAccounts()} addVm={useAddAccount()} links={{ upload: SCREEN_ROUTES.S9 }} Link={Link} />;
}
