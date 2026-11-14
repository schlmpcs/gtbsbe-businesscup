// Input check for a hand-added transaction, shared by Transactions and Account detail.
import type { LedgerTransaction } from '@lifeguessr/types';
import type { NewTransactionInput } from './types';

/** A real calendar day written 'YYYY-MM-DD'. */
export function validDate(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/** The line to store (without its id), or null when the date, amount or label is not usable. */
export function validNewTransaction(input: NewTransactionInput): Omit<LedgerTransaction, 'id'> | null {
  const label = input.label.trim();
  if (!validDate(input.date) || !Number.isFinite(input.amount) || input.amount === 0 || label === '') return null;
  return {
    date: input.date,
    label,
    amount: input.amount,
    ...(input.accountId === undefined ? {} : { accountId: input.accountId }),
    cls: input.category,
    categoryOverridden: true,
  };
}
