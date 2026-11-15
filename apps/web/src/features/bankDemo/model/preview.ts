// What the demo bank "found": read from its statement in the browser by the CSV reader the import uses
// (lib/statement/read), never typed in. The checking account is the statement itself; a credit card is
// shown only when the statement pays one (card payment lines). Nothing here leaves the browser.
import { numberedRowsOf } from '@/lib/statement/csv';
import { parseDate, parseMoney, readStatementCsv } from '@/lib/statement/read';
import type { DemoAccountVM, DemoPreview } from './types';

/** A checking line that pays a credit card bill ("… CREDIT CRD AUTOPAY", "CAPITAL ONE MOBILE PMT", …). */
const CARD_PAYMENT =
  /\b(?:CREDIT\s*(?:CARD|CRD)|APPLECARD|AMEX|CAPITAL ONE|CITI|DISCOVER|SYNCHRONY)\b.*\b(?:PAYMENT|PMT|AUTOPAY|AUTO PAY|EPAYMENT)\b/i;

export function isCardPayment(description: string, amount: number): boolean {
  return amount > 0 && CARD_PAYMENT.test(description);
}

const DAY_MS = 86_400_000;

/** Calendar days from the first to the last line, both included. */
export function daysCovered(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;
}

/** The accounts a demo statement shows. Throws StatementReadError on an unreadable file, like an import. */
export function previewStatement(text: string): DemoPreview {
  const { transactions } = readStatementCsv(text);
  const from = transactions[0]!.date;
  const to = transactions.at(-1)!.date;
  const days = daysCovered(from, to);
  const payments = transactions.filter((t) => isCardPayment(t.description, t.amount)).length;
  const accounts: DemoAccountVM[] = [{ kind: 'checking', transactions: transactions.length, days, from, to }];
  if (payments > 0) accounts.push({ kind: 'card', payments });
  return { text, days, accounts };
}

const BALANCE_HEADER = /^(balance|running bal\.?|running balance|available balance)$/i;
const DATE_HEADER = /date/i;

/**
 * The account's balance after its newest line, from the statement's own Balance column (null when the
 * file has none). Rows of the newest date: the first one in a newest-first file, else the last one.
 */
export function latestBalance(text: string): number | null {
  const rows = numberedRowsOf(text).map((r) => r.cells.map((c) => c.replace(/^\uFEFF/, '').trim()));
  const header = rows[0] ?? [];
  const bal = header.findIndex((h) => BALANCE_HEADER.test(h));
  const dateCol = header.findIndex((h) => DATE_HEADER.test(h));
  if (bal < 0 || dateCol < 0) return null;
  const lines = rows.slice(1).flatMap((r) => {
    const d = parseDate(r[dateCol] ?? '');
    const b = parseMoney(r[bal] ?? '');
    return d && b !== null && Number.isFinite(b) ? [{ key: d.year * 10_000 + d.month * 100 + d.day, balance: b }] : [];
  });
  if (lines.length === 0) return null;
  const newest = Math.max(...lines.map((l) => l.key));
  const newestFirst = lines[0]!.key >= lines.at(-1)!.key;
  const atNewest = lines.filter((l) => l.key === newest);
  return (newestFirst ? atNewest[0] : atNewest.at(-1))!.balance;
}
