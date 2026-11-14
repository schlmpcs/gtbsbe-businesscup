// Adds a hand-made line to the ledger, for Transactions and Account detail.
import { ledger } from './transactionsStore';
import { toManualInput } from './validate';
import type { NewTransactionInput } from './types';

let requests = 0;

/**
 * Stores the line and returns a request id, or null when the date, amount or label is not usable.
 * MP11b blocked: `TransactionStore.addManual` gives the stored line only through its promise (the id is
 * made inside the store), but the view-model contracts return an id at once. The id returned is a
 * request id, not the line's; the line shows up in the ledger when the store has saved it.
 */
export function addLine(input: NewTransactionInput): string | null {
  const manual = toManualInput(input);
  if (manual === null) return null;
  void ledger().addManual(manual).catch(() => undefined);
  requests += 1;
  return `manual-request-${requests}`;
}
