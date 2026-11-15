// What the demo bank "found": read from its statement in the browser by the CSV reader the import uses
// (lib/statement/read), never typed in. The checking account is the statement itself; a credit card is
// shown only when the statement pays one (card payment lines). Nothing here leaves the browser.
import { readStatementCsv } from '@/lib/statement/read';
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
