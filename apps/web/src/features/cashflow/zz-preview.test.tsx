// @vitest-environment jsdom
// TEMPORARY preview dump (delete before finishing).
import { act, fireEvent, render, screen } from '@testing-library/react';
import { writeFileSync } from 'node:fs';
import type { ReactNode } from 'react';
import { beforeEach, it, vi } from 'vitest';
import { FIXTURE_NOW, resetFixtureStores } from '@/features/dashboard/model/resetFixtureStores';
import { ledger } from '@/features/transactions/model/transactionsStore';
import { useCashFlow } from './model/useCashFlow';
import { CashFlowScreen } from './ui/CashFlowScreen';
import { useBudget } from '@/features/budget/model/useBudget';
import { BudgetScreen } from '@/features/budget/ui/BudgetScreen';
import { useRecurring } from '@/features/recurring/model/useRecurring';
import { RecurringScreen } from '@/features/recurring/ui/RecurringScreen';
import { useGoals } from '@/features/goals/model/useGoals';
import { GoalsScreen } from '@/features/goals/ui/GoalsScreen';
import { useAccounts } from '@/features/accounts/model/useAccounts';
import { useAddAccount } from '@/features/accounts/model/useAddAccount';
import { AccountsScreen } from '@/features/accounts/ui/AccountsScreen';
import { useTransactions } from '@/features/transactions/model/useTransactions';
import { TransactionsScreen } from '@/features/transactions/ui/TransactionsScreen';

const A = ({ href, children, className }: { href: string; children?: ReactNode; className?: string }) => <a href={href} className={className}>{children}</a>;
const L = { guess: '/g', upload: '/u', transactions: '/t', loan: '/l' };
const out = (name: string) => writeFileSync('/tmp/claude-0/-home-user-gtbsbe-businesscup/133f0e77-30d5-57c3-a6bb-0817462767f3/scratchpad/preview/' + name + '.html', document.body.innerHTML);
beforeEach(async () => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(FIXTURE_NOW); await resetFixtureStores(); });

it('dump', async () => {
  const C = () => <CashFlowScreen vm={useCashFlow({ today: '2026-11-15' })} links={L} Link={A} />;
  let r = render(<C />); out('cashflow-sankey');
  fireEvent.click(screen.getByLabelText('By group')); out('cashflow-group');
  fireEvent.click(screen.getByLabelText('Yearly')); out('cashflow-year');
  fireEvent.click(screen.getByLabelText('Trend bars')); out('cashflow-bars'); r.unmount();
  const B = () => <BudgetScreen vm={useBudget({ today: '2026-11-15' })} links={L} Link={A} />;
  r = render(<B />); out('budget-empty'); fireEvent.click(screen.getByRole('button', { name: /Create budget/ })); out('budget'); r.unmount();
  const R = () => <RecurringScreen vm={useRecurring({ today: '2026-11-15' })} links={L} Link={A} />;
  r = render(<R />); out('recurring'); r.unmount();
  const G = () => <GoalsScreen vm={useGoals()} links={L} Link={A} />;
  r = render(<G />); out('goals-empty');
  for (const [l, v] of [['Name', 'Emergency fund'], ['Target', '15000'], ['In how many years', '3']]) { const i = screen.getByLabelText(l!); act(() => { fireEvent.focus(i); fireEvent.change(i, { target: { value: v } }); fireEvent.blur(i); }); }
  fireEvent.click(screen.getByRole('button', { name: 'Add goal' }));
  for (const [l, v] of [['Name', 'New car'], ['Target', '30000'], ['In how many years', '5']]) { const i = screen.getByLabelText(l!); act(() => { fireEvent.focus(i); fireEvent.change(i, { target: { value: v } }); fireEvent.blur(i); }); }
  fireEvent.click(screen.getByRole('button', { name: 'Add goal' })); out('goals'); r.unmount();
  const Ac = () => <AccountsScreen vm={useAccounts({ today: '2026-11-15' })} addVm={useAddAccount()} links={L} Link={A} />;
  r = render(<Ac />); fireEvent.click(screen.getByLabelText('1 year')); out('accounts'); r.unmount();
  const T = () => <TransactionsScreen vm={useTransactions()} links={L} Link={A} today="2026-11-14" />;
  r = render(<T />); fireEvent.click(screen.getByTestId('transactions-import')); out('transactions'); r.unmount();
  await ledger().clear();
  r = render(<T />); out('transactions-empty'); r.unmount();
  r = render(<C />); out('cashflow-empty'); r.unmount();
});
