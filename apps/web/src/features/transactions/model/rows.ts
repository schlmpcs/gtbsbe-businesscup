// Pure parts of the Transactions view-model: rows, the filters the store does not have, and the summary
// (the engine's cash flow over the lines that match). The list filter, paging and CSV export are the
// store's (lib/model/transactions.ts).
import { cashFlowSummary } from '@lifeguessr/engine';
import { COST_CATEGORIES, STATEMENT_CLASSES, type Account, type CostCategory, type LedgerTransaction, type StatementClass } from '@lifeguessr/types';
import { transactionTotals, type StoredTransaction, type TransactionFilter } from '@/lib/model/transactions';
import type { TransactionFilters, TransactionRowVM, TransactionTone, TransactionsSummaryVM } from './types';

export const NO_FILTERS: TransactionFilters = { query: '', category: 'all', accountId: 'all', month: 'all', direction: 'all' };
export const PAGE_SIZE = 25;

/** A spending category (everything but pay and transfers). */
export const isCostClass = (cls: StatementClass): cls is CostCategory => (COST_CATEGORIES as readonly string[]).includes(cls);

export const monthOf = (t: Pick<LedgerTransaction, 'date'>): string => t.date.slice(0, 7);

/** Newest first: by date, then id (so the order is stable). */
export const newestFirst = (a: Pick<LedgerTransaction, 'date' | 'id'>, b: Pick<LedgerTransaction, 'date' | 'id'>): number =>
  a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? 1 : a.id > b.id ? -1 : 0;

export function toneOf(t: Pick<LedgerTransaction, 'cls' | 'amount'>): TransactionTone {
  if (t.cls === 'transfer') return 'transfer';
  if (t.cls === 'pay') return 'income';
  return t.amount > 0 ? 'refund' : 'spending';
}

/** A line as the UI reads it. `goalLinks` are the lines counted toward a goal after they were made (./goalLinks.ts). */
export function toRow(
  t: StoredTransaction,
  accounts: readonly Pick<Account, 'id' | 'name'>[],
  goalLinks: Readonly<Record<string, string>> = {},
): TransactionRowVM {
  const account = t.accountId === undefined ? undefined : accounts.find((a) => a.id === t.accountId);
  return {
    id: t.id,
    date: t.date,
    label: t.label,
    category: t.cls,
    categoryOverridden: t.categoryOverridden,
    // A deleted account leaves its lines in the ledger without an account.
    accountId: account === undefined ? null : account.id,
    accountName: account?.name ?? null,
    amount: t.amount,
    tone: toneOf(t),
    goalId: t.goalId ?? goalLinks[t.id] ?? null,
  };
}

/** The store's own filter (text, month, category, account), then the money-in / money-out choice it does not have. */
export function storeFilterOf(f: TransactionFilters): TransactionFilter {
  return {
    search: f.query,
    ...(f.month === 'all' ? {} : { from: `${f.month}-01`, to: `${f.month}-31` }),
    ...(f.category === 'all' ? {} : { cls: f.category }),
    ...(f.accountId === 'all' ? {} : { accountId: f.accountId }),
  };
}

export const matchesDirection = (t: Pick<LedgerTransaction, 'amount'>, direction: TransactionFilters['direction']): boolean =>
  direction === 'all' || (direction === 'in' ? t.amount > 0 : t.amount < 0);

/**
 * Count, pay in and spending of the lines (spending is net of refunds), by the engine: the lines go
 * through `transactionTotals` and `cashFlowSummary` over the months they cover. `largest` is the line
 * with the biggest amount among non-transfers.
 */
export function summarize(lines: readonly StoredTransaction[]): TransactionsSummaryVM {
  const totals = transactionTotals(lines);
  const first = totals[0];
  const last = totals[totals.length - 1];
  const flow = first && last ? cashFlowSummary(totals, { from: first.month, to: last.month }) : null;
  let largest: TransactionsSummaryVM['largest'] = null;
  for (const t of lines) {
    if (t.cls !== 'transfer' && (largest === null || Math.abs(t.amount) > Math.abs(largest.amount))) largest = { id: t.id, amount: t.amount };
  }
  return { count: lines.length, income: flow?.income ?? 0, spending: flow?.expenses ?? 0, largest };
}

/** The classes that occur, in the contract's order. */
export const classesIn = (lines: readonly Pick<LedgerTransaction, 'cls'>[]): StatementClass[] => {
  const seen = new Set(lines.map((t) => t.cls));
  return STATEMENT_CLASSES.filter((c) => seen.has(c));
};
export const monthsIn = (lines: readonly Pick<LedgerTransaction, 'date'>[]): string[] => [...new Set(lines.map(monthOf))].sort().reverse();

// ----- CSV ----------------------------------------------------------------------------------------

/** One CSV cell: quoted when it holds a comma, quote or line break; text that a spreadsheet would run as a formula gets a leading apostrophe. */
export function csvCell(value: string | number): string {
  let text = typeof value === 'number' ? String(value) : value;
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const csvLine = (cells: readonly (string | number)[]): string => cells.map(csvCell).join(',');
