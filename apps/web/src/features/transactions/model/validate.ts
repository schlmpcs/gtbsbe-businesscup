// Input check for a hand-added transaction, shared by Transactions and Account detail. The line itself is
// validated by the store's `manualTransaction` (contract schema); the real-calendar-day check is kept
// here because the schema only reads the shape.
import { manualTransaction, TransactionInputError, type ManualTransactionInput } from '@/lib/model/transactions';
import type { NewTransactionInput } from './types';

/** A real calendar day written 'YYYY-MM-DD'. */
export function validDate(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/** The form input the store takes (direction and a positive amount), or null when the date, amount or label is not usable. */
export function toManualInput(input: NewTransactionInput): ManualTransactionInput | null {
  if (!validDate(input.date) || !Number.isFinite(input.amount) || input.amount === 0 || input.label.trim() === '') return null;
  const manual: ManualTransactionInput = {
    direction: input.amount < 0 ? 'debit' : 'credit',
    amount: Math.abs(input.amount),
    merchant: input.label,
    date: input.date,
    cls: input.category,
    ...(input.accountId === undefined ? {} : { accountId: input.accountId }),
  };
  try {
    manualTransaction(manual, 'check'); // the contract's own validation
  } catch (err) {
    if (err instanceof TransactionInputError) return null;
    throw err;
  }
  return manual;
}
