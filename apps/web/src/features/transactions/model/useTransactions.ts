// View-model of the Transactions page (MP11, #171). Reads the browser's Transactions store (MP10,
// lib/model/transactions.ts) and the Accounts store (MP8). The list filter, paging and CSV export are
// the store's; the summary is the engine's (rows.ts). The one network call is the categorize request of
// a CSV import, which the store makes (masked label, amount, month and day only).
import { useCallback, useMemo, useState } from 'react';
import type { StatementClass } from '@lifeguessr/types';
import { useAccountsReady, useAccountsStore } from '@/lib/model/accounts';
import { toVMError } from '@/lib/model/errors';
import {
  exportTransactionsCsv, filterTransactions as storeFilter, transactionPage, type ImportResult,
} from '@/lib/model/transactions';
import { addLine } from './addLine';
import { useGoalLinks } from './goalLinks';
import {
  classesIn, matchesDirection, monthsIn, newestFirst, NO_FILTERS, PAGE_SIZE, storeFilterOf, summarize, toRow,
} from './rows';
import { ledger, useLedger } from './transactionsStore';
import type { ImportStateVM, NewTransactionInput, TransactionFilters, TransactionsVM } from './types';

/** Reads a statement file and stores its lines; the default is the store's own import (tests pass one with a fake categorizer). */
export type CsvImporter = (file: File) => Promise<Pick<ImportResult, 'added' | 'duplicates'>>;

export type UseTransactionsOptions = { importer?: CsvImporter; pageSize?: number };

export function useTransactions({ importer, pageSize = PAGE_SIZE }: UseTransactionsOptions = {}): TransactionsVM {
  const { lines, ready: ledgerReady } = useLedger();
  const accountsReady = useAccountsReady();
  const accounts = useAccountsStore((s) => s.accounts);
  const goalLinks = useGoalLinks((s) => s.links);
  const [filters, setFilters] = useState<TransactionFilters>(NO_FILTERS);
  const [requestedPage, setPage] = useState(0);
  const [importState, setImportState] = useState<ImportStateVM>({ status: 'idle' });

  const matching = useMemo(
    () => storeFilter(lines, storeFilterOf(filters)).filter((t) => matchesDirection(t, filters.direction)).sort(newestFirst),
    [lines, filters],
  );
  const current = useMemo(() => transactionPage(matching, requestedPage + 1, pageSize), [matching, requestedPage, pageSize]);
  const rows = useMemo(() => current.items.map((t) => toRow(t, accounts, goalLinks)), [current, accounts, goalLinks]);
  const summary = useMemo(() => summarize(matching), [matching]);
  const options = useMemo(
    () => ({ categories: classesIn(lines), accounts: accounts.map((a) => ({ id: a.id, name: a.name })), months: monthsIn(lines) }),
    [lines, accounts],
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
        const result = await (importer ?? ((f: File) => ledger().importFile(f)))(file);
        setImportState({ status: 'done', added: result.added, skipped: result.duplicates });
      } catch (err) {
        setImportState({ status: 'error', error: toVMError(err) });
      }
    },
    [importer],
  );

  const add = useCallback((input: NewTransactionInput): string | null => addLine(input), []);

  const setCategory = useCallback((id: string, category: StatementClass, applyAll: boolean) => {
    void ledger().setCategory(id, category, { applyToMerchant: applyAll }).catch(() => undefined);
  }, []);

  const exportCsv = useCallback(() => exportTransactionsCsv(matching), [matching]);

  return {
    ready: ledgerReady && accountsReady,
    rows,
    total: current.total,
    page: current.page - 1,
    pageCount: current.pageCount,
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
