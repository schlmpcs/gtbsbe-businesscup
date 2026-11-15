// @vitest-environment jsdom
// P2 Accounts and Account detail wired to their real view-model hooks on the fixtures
// (accounts.demo.json, transactions.demo.json). No network.
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { accounts as t } from '@/copy';
import { FIXTURE_NOW, resetFixtureStores } from '@/features/dashboard/model/resetFixtureStores';
import { TransactionList } from '@/features/transactions/ui/TransactionList';
import { useAccountsStore } from '@/lib/model/accounts';
import { formatMoney } from '@/ui-kit';
import { useAccount } from './model/useAccount';
import { useAccounts } from './model/useAccounts';
import { useAddAccount } from './model/useAddAccount';
import { AccountDetailScreen } from './ui/AccountDetailScreen';
import { AccountsScreen } from './ui/AccountsScreen';

const TODAY = '2026-11-15';
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FIXTURE_NOW);
  await resetFixtureStores();
});
afterEach(() => vi.useRealTimers());

function A({ href, children, ...rest }: { href: string; children?: ReactNode; className?: string }) {
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}

function Accounts() {
  return <AccountsScreen vm={useAccounts({ today: TODAY })} addVm={useAddAccount()} links={{ upload: '/me/upload' }} Link={A} />;
}

function Detail({ id }: { id: string }) {
  const vm = useAccount(id, { today: TODAY });
  return (
    <AccountDetailScreen
      vm={vm}
      links={{ accounts: '/accounts' }}
      Link={A}
      transactions={vm.account ? <TransactionList rows={vm.account.transactions} showAccount={false} /> : null}
    />
  );
}

describe('AccountsScreen', () => {
  it('shows net worth, the summary and the accounts by group, with links to each account', () => {
    render(<Accounts />);
    // Net worth of the demo accounts: 18300 - 24200 = -5900 (accounts.demo.json; see useAccounts.test.ts).
    expect(screen.getByTestId('accounts-networth-value')).toHaveTextContent(formatMoney(-5900));
    expect(screen.getByTestId('balance-chart')).toBeInTheDocument();
    expect(screen.getByTestId('accounts-summary-asset')).toHaveTextContent(formatMoney(18300));
    expect(screen.getByTestId('accounts-summary-liability')).toHaveTextContent(formatMoney(24200));
    const cash = screen.getByTestId('accounts-group-cash');
    expect(within(cash).getByRole('link', { name: /Checking/ })).toHaveAttribute('href', '/accounts/checking-1');
    expect(cash).toHaveTextContent(formatMoney(3800));
    // The car is left out of net worth and says so.
    expect(within(screen.getByTestId('accounts-group-vehicle')).getByText(t.screen.excludedTag)).toBeInTheDocument();
  });

  it('switches the summary to percent', () => {
    render(<Accounts />);
    fireEvent.click(screen.getByLabelText(t.summaryModes.percent));
    expect(screen.getByTestId('accounts-summary-asset')).toHaveTextContent('43.1%'); // 18300 / 42500
  });

  it('adds an account through the sheet', () => {
    render(<Accounts />);
    fireEvent.click(screen.getByTestId('accounts-add'));
    fireEvent.click(screen.getByTestId('add-account-type-cash'));
    fireEvent.click(screen.getByTestId('add-account-submit'));
    expect(screen.getAllByText(t.errors.required).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByTestId('add-account-name'), { target: { value: 'Rainy day' } });
    fireEvent.change(screen.getByTestId('add-account-balance'), { target: { value: '1,000' } });
    fireEvent.click(screen.getByTestId('add-account-submit'));
    expect(useAccountsStore.getState().accounts.some((a) => a.name === 'Rainy day')).toBe(true);
    // Net worth is now 1000 higher.
    expect(screen.getByTestId('accounts-networth-value')).toHaveTextContent(formatMoney(-4900));
  });

  it("asks a vehicle for its value today and explains its yearly change", () => {
    render(<Accounts />);
    fireEvent.click(screen.getByTestId('accounts-add'));
    fireEvent.click(screen.getByTestId('add-account-type-vehicle'));
    expect(screen.getByText('Add asset: Vehicle')).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.value)).toBe(screen.getByTestId('add-account-balance'));
    expect(screen.queryByText(t.fields.balance)).toBeNull();
    expect(screen.getByTestId('add-account-growth')).toHaveAttribute('placeholder', '−15');
    expect(screen.getByText('Leave blank to use a typical −15% a year (cars lose value). Use a minus for a loss.')).toBeInTheDocument();
    expect(screen.queryByText(t.form.aprHint)).toBeNull();
  });

  it('shows the empty state with the import link when there are no accounts', () => {
    act(() => useAccountsStore.setState({ accounts: [] }));
    render(<Accounts />);
    const empty = screen.getByTestId('accounts-empty');
    expect(within(empty).getByRole('link', { name: t.screen.importCta })).toHaveAttribute('href', '/me/upload');
  });
});

describe('AccountDetailScreen', () => {
  it('shows a card with its summary and the estimate tag on its defaulted minimum', () => {
    render(<Detail id="card-1" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Credit card' })).toBeInTheDocument();
    expect(screen.getByTestId('account-balance')).toHaveTextContent(formatMoney(6400));
    const summary = screen.getByTestId('account-summary');
    expect(summary).toHaveTextContent('24.36%');
    expect(summary).toHaveTextContent(formatMoney(193.92, { cents: true }));
    expect(within(summary).getByText('estimate')).toBeInTheDocument();
    expect(screen.getByText(t.detailScreen.noTransactions)).toBeInTheDocument();
  });

  it('updates the balance and refuses a bad one', () => {
    render(<Detail id="card-1" />);
    fireEvent.change(screen.getByTestId('account-new-balance'), { target: { value: '-5' } });
    fireEvent.click(screen.getByTestId('account-save-balance'));
    expect(screen.getByText(t.detailScreen.invalidBalance)).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('account-new-balance'), { target: { value: '6,000' } });
    fireEvent.click(screen.getByTestId('account-save-balance'));
    expect(screen.getByTestId('account-balance')).toHaveTextContent(formatMoney(6000));
  });

  it('lists the lines of the checking account', () => {
    render(<Detail id="checking-1" />);
    expect(screen.getAllByTestId('transaction-row')).toHaveLength(170);
  });

  it('says when the account does not exist', async () => {
    render(<Detail id="nope" />);
    await waitFor(() => expect(screen.getByTestId('account-not-found')).toBeInTheDocument());
  });
});
