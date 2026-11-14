// Pure parts of the Transactions view-model: rows, filters, summary and the CSV text.
import { STATEMENT_CLASSES, type Account, type LedgerTransaction, type StatementClass } from '@lifeguessr/types';
import { incomeOf, monthOf, newestFirst, spendingOf } from './ledger';
import type { TransactionFilters, TransactionRowVM, TransactionTone, TransactionsSummaryVM } from './types';

export const NO_FILTERS: TransactionFilters = { query: '', category: 'all', accountId: 'all', month: 'all', direction: 'all' };
export const PAGE_SIZE = 25;

export function toneOf(t: Pick<LedgerTransaction, 'cls' | 'amount'>): TransactionTone {
  if (t.cls === 'transfer') return 'transfer';
  if (t.cls === 'pay') return 'income';
  return t.amount > 0 ? 'refund' : 'spending';
}

export function toRow(t: LedgerTransaction, accounts: readonly Pick<Account, 'id' | 'name'>[]): TransactionRowVM {
  const account = t.accountId === undefined ? undefined : accounts.find((a) => a.id === t.accountId);
  return {
    id: t.id,
    date: t.date,
    label: t.label,
    category: t.cls,
    categoryOverridden: t.categoryOverridden,
    accountId: t.accountId ?? null,
    accountName: account?.name ?? null,
    amount: t.amount,
    tone: toneOf(t),
    goalId: t.goalId ?? null,
  };
}

export function matchesFilters(t: LedgerTransaction, f: TransactionFilters): boolean {
  if (f.category !== 'all' && t.cls !== f.category) return false;
  if (f.accountId !== 'all' && t.accountId !== f.accountId) return false;
  if (f.month !== 'all' && monthOf(t) !== f.month) return false;
  if (f.direction === 'in' && t.amount <= 0) return false;
  if (f.direction === 'out' && t.amount >= 0) return false;
  const q = f.query.trim().toLowerCase();
  return q === '' || t.label.toLowerCase().includes(q);
}

/** The lines that match the filters, newest first. */
export const filterTransactions = (txs: readonly LedgerTransaction[], f: TransactionFilters): LedgerTransaction[] =>
  txs.filter((t) => matchesFilters(t, f)).sort(newestFirst);

export function summarize(txs: readonly LedgerTransaction[]): TransactionsSummaryVM {
  let income = 0;
  let spending = 0;
  let largest: TransactionsSummaryVM['largest'] = null;
  for (const t of txs) {
    income += incomeOf(t);
    spending += spendingOf(t);
    if (t.cls !== 'transfer' && (largest === null || Math.abs(t.amount) > Math.abs(largest.amount))) largest = { id: t.id, amount: t.amount };
  }
  return { count: txs.length, income, spending, largest };
}

/** The classes that occur, in the contract's order. */
export const classesIn = (txs: readonly LedgerTransaction[]): StatementClass[] => {
  const seen = new Set(txs.map((t) => t.cls));
  return STATEMENT_CLASSES.filter((c) => seen.has(c));
};
export const monthsIn = (txs: readonly LedgerTransaction[]): string[] => [...new Set(txs.map(monthOf))].sort().reverse();

// ----- CSV ----------------------------------------------------------------------------------------

/** One CSV cell: quoted when it holds a comma, quote or line break; text that a spreadsheet would run as a formula gets a leading apostrophe. */
export function csvCell(value: string | number): string {
  let text = typeof value === 'number' ? String(value) : value;
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const csvLine = (cells: readonly (string | number)[]): string => cells.map(csvCell).join(',');

export const TRANSACTIONS_CSV_FILE = 'lifeguessr-transactions.csv';

export function transactionsCsv(rows: readonly TransactionRowVM[]): string {
  const lines = [csvLine(['date', 'label', 'category', 'account', 'amount'])];
  for (const r of rows) lines.push(csvLine([r.date, r.label, r.category, r.accountName ?? '', r.amount]));
  return `${lines.join('\n')}\n`;
}
