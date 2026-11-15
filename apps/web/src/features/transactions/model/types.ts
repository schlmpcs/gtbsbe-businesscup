// View-model contract of the Transactions page (MP11, #171). ui/ may import only this file,
// @/ui-kit/** and @/copy (lint-enforced). Hook: useTransactions (./useTransactions.ts).
// Units: `amount` is signed US dollars, money IN > 0 and money OUT < 0 (the LedgerTransaction sign).
// Category names are in copy.planner.categories[category]; the page copy is in copy.transactions.
// Privacy (CLAUDE.md rule 6): transactions live in this browser only; nothing here is sent.
import type { Money, StatementClass, YearMonth } from '@lifeguessr/types';
import type { DownloadOutcome } from '@/lib/download';
import type { VMError } from '@/lib/model/types';

export type { Money, StatementClass, YearMonth } from '@lifeguessr/types';
export type { DownloadOutcome } from '@/lib/download';
export type { VMError } from '@/lib/model/types';

/**
 * How a line reads: `income` = pay in, `refund` = money in from a spending category, `transfer` =
 * money moved between your accounts (neither income nor spending), `spending` = money out.
 */
export type TransactionTone = 'income' | 'spending' | 'refund' | 'transfer';

export type TransactionRowVM = {
  id: string;
  /** 'YYYY-MM-DD'. */
  date: string;
  /** The (masked) statement label, or what the person typed. Show as text, never as copy. */
  label: string;
  category: StatementClass;
  /** The person picked the category (so a re-import does not change it). */
  categoryOverridden: boolean;
  accountId: string | null;
  /** The account's name, null when the line has no account or the account was deleted. */
  accountName: string | null;
  /** Signed: money in > 0, money out < 0. */
  amount: Money;
  tone: TransactionTone;
  /** The savings goal the line is counted toward (Goals), if any. */
  goalId: string | null;
};

export type DirectionFilter = 'all' | 'in' | 'out';

export type TransactionFilters = {
  /** Case-insensitive text in the label; '' = no search. */
  query: string;
  category: StatementClass | 'all';
  accountId: string | 'all';
  month: YearMonth | 'all';
  direction: DirectionFilter;
};

/** Over every line that matches the filters (not just the visible page). Transfers count only in `count`. */
export type TransactionsSummaryVM = {
  count: number;
  /** Pay in. */
  income: Money;
  /** Money out of spending categories, net of refunds. */
  spending: Money;
  /** The line with the biggest absolute amount among non-transfers, null without any. */
  largest: { id: string; amount: Money } | null;
};

/** idle → reading → done | error. `added` and `skipped` (lines already there) are set on `done`. */
export type ImportStateVM =
  | { status: 'idle' }
  | { status: 'reading' }
  | { status: 'done'; added: number; skipped: number }
  | { status: 'error'; error: VMError };

/** What `add` takes: the same fields as a row, without the id and the derived ones. */
export type NewTransactionInput = {
  date: string;
  label: string;
  /** Signed: money in > 0, money out < 0. */
  amount: Money;
  accountId?: string;
  category: StatementClass;
};

export type TransactionsVM = {
  /** False until saved state is loaded (always true on fixtures). */
  ready: boolean;
  /** Visible page of the filtered lines, newest first. */
  rows: TransactionRowVM[];
  /** Lines that match the filters, across all pages. */
  total: number;
  /** 0-based. */
  page: number;
  pageCount: number;
  setPage: (page: number) => void;
  filters: TransactionFilters;
  setFilter: <K extends keyof TransactionFilters>(key: K, value: TransactionFilters[K]) => void;
  /** Shortcut for `setFilter('query', query)`. */
  search: (query: string) => void;
  summary: TransactionsSummaryVM;
  /** What the filter dropdowns offer: the classes, accounts and months that occur. */
  options: { categories: StatementClass[]; accounts: { id: string; name: string }[]; months: YearMonth[] };
  importState: ImportStateVM;
  /** Reads a statement file on this device and adds its lines (those already there are skipped). Never throws. */
  /** `importer` replaces the plain import for this file (the demo bank's, which also fills every screen). */
  importCsv: (file: File, importer?: (file: File) => Promise<{ added: number; duplicates: number }>) => Promise<void>;
  /** Adds one line; returns its id, or null when `date` or `amount` is invalid. */
  add: (input: NewTransactionInput) => string | null;
  /** Sets one line's category; with `applyAll`, every line of the same merchant too. */
  setCategory: (id: string, category: StatementClass, applyAll: boolean) => void;
  /** Saves the lines that match the filters as a CSV file. */
  export: () => DownloadOutcome;
};
