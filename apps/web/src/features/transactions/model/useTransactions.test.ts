// @vitest-environment jsdom
// Transactions on the fixture ledger (transactions.demo.json, 170 lines, 2026-07-01 to 2026-11-12),
// held by the real Transactions store on a memory record store. No network: the categorizer is faked.
import { transactionsDemo } from '@lifeguessr/data/fixtures/plan';
import type { StatementItem } from '@lifeguessr/types';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_NOW, resetFixtureStores } from '@/features/dashboard/model/resetFixtureStores';
import { ledger } from './transactionsStore';
import { useTransactions, type CsvImporter } from './useTransactions';

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FIXTURE_NOW);
  await resetFixtureStores();
});
afterEach(() => vi.useRealTimers());
/** The demo ledger as a bank CSV (Date, Description, Amount; money out negative, as in the ledger). */
const csv = () => ['Date,Description,Amount', ...transactionsDemo.map((t) => `${t.date},"${t.label.replaceAll('"', '""')}",${t.amount.toFixed(2)}`)].join('\n');
const file = () => new File([csv()], 'statement.csv', { type: 'text/csv' });

/** A categorizer stand-in: one class per line sent, in order, as the real route answers. No model, no network. */
const fakeCategorize = async (items: readonly StatementItem[]) => ({
  months: [],
  categorizedBy: 'rules' as const,
  lines: items.map((i) => ({ cls: i.amount < 0 ? ('pay' as const) : ('other' as const), oneOffHint: false })),
});
const importer: CsvImporter = (f) => ledger().importFile(f, { categorize: fakeCategorize as never, remember: false });

describe('useTransactions', () => {
  it('renders the first page, newest first, with the summary of all lines', () => {
    const { result } = renderHook(() => useTransactions());
    const vm = result.current;
    expect(vm.total).toBe(170);
    expect(vm.rows).toHaveLength(25);
    expect(vm.pageCount).toBe(7); // ceil(170 / 25)
    expect(vm.rows[0]).toMatchObject({ id: 'tx-170', date: '2026-11-12', tone: 'spending', accountName: 'Checking' });
    // Pay in: 7200 + 4800 + 4800 + 4800 + 2400 = 24000. Spending, July to November:
    // 4006.40 + 3991.72 + 4630.88 + 3948.01 + 2544.96 = 19121.97. Transfers are in neither.
    expect(vm.summary.count).toBe(170);
    expect(vm.summary.income).toBe(24000);
    expect(vm.summary.spending).toBeCloseTo(19121.97, 2);
    expect(vm.summary.largest).toEqual({ id: 'tx-162', amount: 2400 }); // pay lines of 2400 tie; the newest comes first
    expect(vm.options.months).toEqual(['2026-11', '2026-10', '2026-09', '2026-08', '2026-07']);
    expect(vm.importState).toEqual({ status: 'idle' });
  });

  it('filters, searches and pages', () => {
    const { result } = renderHook(() => useTransactions({ pageSize: 10 }));
    act(() => result.current.setFilter('month', '2026-11'));
    expect(result.current.total).toBe(21);
    expect(result.current.summary.income).toBe(2400);
    expect(result.current.summary.spending).toBeCloseTo(2544.96, 2); // the November total
    act(() => result.current.setPage(2));
    expect(result.current.rows).toHaveLength(1); // 21 = 10 + 10 + 1
    act(() => result.current.setFilter('category', 'groceries'));
    expect(result.current.page).toBe(0); // a filter goes back to the first page
    act(() => result.current.setFilter('month', 'all'));
    expect(result.current.total).toBe(22);
    act(() => result.current.setFilter('category', 'all'));
    act(() => result.current.search('planet fitness'));
    expect(result.current.total).toBe(5); // one a month, July to November
    act(() => result.current.setFilter('direction', 'in'));
    expect(result.current.total).toBe(0);
  });

  it('changes a category for one line or every line of the merchant', async () => {
    const { result } = renderHook(() => useTransactions());
    act(() => result.current.search('planet fitness'));
    const [first] = result.current.rows;
    await act(async () => result.current.setCategory(first!.id, 'other', false));
    await waitFor(() => expect(result.current.rows.filter((r) => r.category === 'other')).toHaveLength(1)); // the store saves the change a moment later
    expect(result.current.rows.find((r) => r.id === first!.id)).toMatchObject({ category: 'other', categoryOverridden: true });
    await act(async () => result.current.setCategory(first!.id, 'other', true));
    await waitFor(() => expect(result.current.rows.every((r) => r.category === 'other' && r.categoryOverridden)).toBe(true));
  });

  it('adds a line and refuses an invalid one', async () => {
    const { result } = renderHook(() => useTransactions());
    let id: string | null = null;
    await act(async () => {
      id = result.current.add({ date: '2026-11-14', label: 'Coffee', amount: -4.5, category: 'eatingOut' });
    });
    expect(id).toEqual(expect.any(String)); // a request id: the store makes the line's own id
    await waitFor(() => expect(result.current.total).toBe(171));
    expect(result.current.rows[0]).toMatchObject({ label: 'Coffee', amount: -4.5, tone: 'spending' });
    expect(result.current.add({ date: '2026-11-14', label: 'Coffee', amount: 0, category: 'eatingOut' })).toBeNull();
    expect(result.current.add({ date: 'yesterday', label: 'Coffee', amount: -1, category: 'eatingOut' })).toBeNull();
    expect(result.current.add({ date: '2026-11-14', label: '  ', amount: -1, category: 'eatingOut' })).toBeNull();
  });

  it('imports a file with progress, and skips lines it already has', async () => {
    await ledger().clear();
    const { result } = renderHook(() => useTransactions({ importer }));
    expect(result.current.total).toBe(0);
    await act(async () => result.current.importCsv(file()));
    expect(result.current.importState).toEqual({ status: 'done', added: 170, skipped: 0 });
    expect(result.current.total).toBe(170);
    await act(async () => result.current.importCsv(file()));
    expect(result.current.importState).toEqual({ status: 'done', added: 0, skipped: 170 });
  });

  it('reports a failed import', async () => {
    const { result } = renderHook(() => useTransactions({ importer: async () => Promise.reject(new Error('boom')) }));
    await act(async () => result.current.importCsv(file()));
    expect(result.current.importState).toEqual({ status: 'error', error: { kind: 'unknown', message: 'boom' } });
  });
});
