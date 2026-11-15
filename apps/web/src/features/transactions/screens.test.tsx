// @vitest-environment jsdom
// P3 Transactions wired to its real view-model hook on the fixture ledger (transactions.demo.json, 170
// lines). No network: nothing here imports a file.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { planner, transactions as t } from '@/copy';
import { FIXTURE_NOW, resetFixtureStores } from '@/features/dashboard/model/resetFixtureStores';
import { formatMoney } from '@/ui-kit';
import { ledger } from './model/transactionsStore';
import { useTransactions } from './model/useTransactions';
import { TransactionsScreen } from './ui/TransactionsScreen';

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

function Transactions() {
  return <TransactionsScreen vm={useTransactions()} links={{ upload: '/me/upload' }} Link={A} today="2026-11-14" />;
}

describe('TransactionsScreen', () => {
  it('shows the summary and the first page, newest first', () => {
    render(<Transactions />);
    expect(screen.getByTestId('transactions-summary-count')).toHaveTextContent('170');
    expect(screen.getByTestId('transactions-summary-income')).toHaveTextContent(formatMoney(24000));
    expect(screen.getByTestId('transactions-summary-spending')).toHaveTextContent(formatMoney(19121.97));
    expect(screen.getAllByTestId('transaction-row')).toHaveLength(25);
    expect(screen.getByTestId('transactions-page')).toHaveTextContent(t.screen.page(1, 7));
    fireEvent.click(screen.getByRole('button', { name: t.screen.next }));
    expect(screen.getByTestId('transactions-page')).toHaveTextContent(t.screen.page(2, 7));
  });

  it('filters by month and searches', () => {
    render(<Transactions />);
    fireEvent.change(screen.getByTestId('transactions-filter-month'), { target: { value: '2026-11' } });
    expect(screen.getByTestId('transactions-summary-count')).toHaveTextContent('21');
    fireEvent.change(screen.getByTestId('transactions-filter-month'), { target: { value: 'all' } });
    fireEvent.change(screen.getByTestId('transactions-search'), { target: { value: 'planet fitness' } });
    expect(screen.getAllByTestId('transaction-row')).toHaveLength(5);
    fireEvent.click(screen.getByLabelText(t.directions.in));
    expect(screen.getByTestId('transactions-no-match')).toHaveTextContent(t.empty);
  });

  it('changes a category from the row picker', async () => {
    render(<Transactions />);
    fireEvent.change(screen.getByTestId('transactions-search'), { target: { value: 'planet fitness' } });
    const [first] = screen.getAllByTestId('transaction-row');
    const picker = within(first!).getByRole('combobox');
    fireEvent.change(picker, { target: { value: 'other' } });
    await waitFor(() => expect(within(screen.getAllByTestId('transaction-row')[0]!).getByRole('combobox')).toHaveValue('other'));
    expect(within(screen.getAllByTestId('transaction-row')[0]!).getByText(t.screen.overridden)).toBeInTheDocument();
  });

  it('adds a line by hand and refuses an invalid one', async () => {
    render(<Transactions />);
    fireEvent.click(screen.getByTestId('transactions-add'));
    const form = screen.getByTestId('add-transaction-form');
    fireEvent.click(within(form).getByTestId('add-transaction-submit'));
    expect(within(form).getByRole('alert')).toHaveTextContent(t.addForm.invalid);
    fireEvent.change(screen.getByTestId('add-transaction-label'), { target: { value: 'Coffee' } });
    fireEvent.change(screen.getByTestId('add-transaction-amount'), { target: { value: '4.50' } });
    fireEvent.change(screen.getByTestId('add-transaction-category'), { target: { value: 'eatingOut' } });
    fireEvent.click(screen.getByTestId('add-transaction-submit'));
    await waitFor(() => expect(screen.getByTestId('transactions-summary-count')).toHaveTextContent('171'));
    const top = screen.getAllByTestId('transaction-row')[0]!;
    expect(top).toHaveTextContent('Coffee');
    expect(top).toHaveTextContent(formatMoney(-4.5, { cents: true }));
    expect(within(top).getByRole('combobox')).toHaveDisplayValue(planner.categories.eatingOut);
  });

  it('has one Import CSV control that opens the file picker and the guided path', () => {
    render(<Transactions />);
    expect(screen.getAllByText(t.import)).toHaveLength(1);
    expect(screen.queryByTestId('transactions-import-file')).toBeNull();
    fireEvent.click(screen.getByTestId('transactions-import'));
    const panel = screen.getByTestId('transactions-import-panel');
    expect(within(panel).getByLabelText(t.screen.importFile)).toHaveAttribute('type', 'file');
    expect(within(panel).getByRole('link', { name: t.screen.importGuided })).toHaveAttribute('href', '/me/upload');
  });

  it('opens the import panel from ?import=1', () => {
    function OpenImport() {
      return <TransactionsScreen vm={useTransactions()} links={{ upload: '/me/upload' }} Link={A} openImport />;
    }
    render(<OpenImport />);
    expect(screen.getByTestId('transactions-import-panel')).toBeInTheDocument();
  });

  it('points an empty ledger to the CSV import and manual add', async () => {
    await ledger().clear();
    render(<Transactions />);
    const empty = await screen.findByTestId('transactions-empty');
    expect(within(empty).getByRole('link', { name: t.screen.importGuided })).toHaveAttribute('href', '/me/upload');
    expect(within(empty).getByLabelText(t.screen.importFile)).toHaveAttribute('type', 'file');
    fireEvent.click(within(empty).getByRole('button', { name: t.add }));
    expect(screen.getByTestId('add-transaction-form')).toBeInTheDocument();
  });
});
