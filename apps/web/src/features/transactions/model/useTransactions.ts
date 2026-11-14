// View-model of the Transactions page (MP11, #171). Fixture-backed: reads the in-memory ledger
// (./transactionsStore.ts, seeded from the demo fixture). No network, no engine math.
// MP11b: swap the store for the real one (MP9/MP10) and `importCsv`'s default for the statement pipeline.
import { useCallback, useMemo, useState } from 'react';
import type { LedgerTransaction } from '@lifeguessr/types';
import { transactionsDemo } from '@/fixtures';
import { useAccountsStore } from '@/features/accounts/model/accountsStore';
import { downloadTextFile } from '@/lib/download';
import { toVMError } from '@/lib/model/errors';
import {
  classesIn, filterTransactions, monthsIn, NO_FILTERS, PAGE_SIZE, summarize, toRow, TRANSACTIONS_CSV_FILE, transactionsCsv,
} from './rows';
import { useTransactionsStore } from './transactionsStore';
import { validNewTransaction } from './validate';
import type { ImportStateVM, NewTransactionInput, TransactionFilters, TransactionsVM } from './types';

/** Reads a statement file into ledger lines. */
export type CsvImporter = (file: File) => Promise<readonly LedgerTransaction[]>;

/**
 * Fixture importer: ignores the file and returns the demo statement's lines, so the progress states and
 * the "already there" count can be built and tested without a network.
 * MP11b: wire to `readStatementFile` (features/upload) + /api/statement/categorize, mapped to LedgerTransaction.
 */
export const fixtureImporter: CsvImporter = async () => transactionsDemo;

export type UseTransactionsOptions = { importer?: CsvImporter; pageSize?: number };

export function useTransactions({ importer = fixtureImporter, pageSize = PAGE_SIZE }: UseTransactionsOptions = {}): TransactionsVM {
  const transactions = useTransactionsStore((s) => s.transactions);
  const accounts = useAccountsStore((s) => s.accounts);
  const [filters, setFilters] = useState<TransactionFilters>(NO_FILTERS);
  const [requestedPage, setPage] = useState(0);
  const [importState, setImportState] = useState<ImportStateVM>({ status: 'idle' });

  const matching = useMemo(() => filterTransactions(transactions, filters), [transactions, filters]);
  const pageCount = Math.max(1, Math.ceil(matching.length / pageSize));
  const page = Math.min(requestedPage, pageCount - 1);
  const rows = useMemo(
    () => matching.slice(page * pageSize, (page + 1) * pageSize).map((t) => toRow(t, accounts)),
    [matching, page, pageSize, accounts],
  );
  const summary = useMemo(() => summarize(matching), [matching]);
  const options = useMemo(
    () => ({ categories: classesIn(transactions), accounts: accounts.map((a) => ({ id: a.id, name: a.name })), months: monthsIn(transactions) }),
    [transactions, accounts],
  );

  const setFilter = useCallback(<K extends keyof TransactionFilters>(key: K, value: TransactionFilters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(0);
  }, []);
  const search = useCallback((query: string) => setFilter('query', query), [setFilter]);

  const importCsv = useCallback(
    async (file: File) => {
      setImportState({ status: 'reading' });
      try {
        const lines = await importer(file);
        const added = useTransactionsStore.getState().addMany(lines);
        setImportState({ status: 'done', added, skipped: lines.length - added });
      } catch (err) {
        setImportState({ status: 'error', error: toVMError(err) });
      }
    },
    [importer],
  );

  const add = useCallback((input: NewTransactionInput): string | null => {
    const valid = validNewTransaction(input);
    return valid === null ? null : useTransactionsStore.getState().addTransaction(valid);
  }, []);

  const setCategory = useCallback(
    (id: string, category: LedgerTransaction['cls'], applyAll: boolean) => useTransactionsStore.getState().setCategory(id, category, applyAll),
    [],
  );

  const exportCsv = useCallback(
    () => downloadTextFile(TRANSACTIONS_CSV_FILE, 'text/csv', transactionsCsv(matching.map((t) => toRow(t, accounts)))),
    [matching, accounts],
  );

  return {
    ready: true,
    rows,
    total: matching.length,
    page,
    pageCount,
    setPage,
    filters,
    setFilter,
    search,
    summary,
    options,
    importState,
    importCsv,
    add,
    setCategory,
    export: exportCsv,
  };
}
