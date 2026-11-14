// S9 pipeline (T6/T7): a CSV statement file → CategoryTotals[] for review.
//   1. The file is read and parsed here, in the browser (lib/statement/read).
//   2. Each line becomes a StatementItem: masked label, amount, month, day. Nothing else is sent:
//      no file, no full dates, no balances, no account numbers or names.
//   3. /api/statement/categorize sorts the labels and sums the totals; nothing is stored there.
// Privacy: CLAUDE.md rule 6, docs/ARCHITECTURE.md → Privacy design.
import { MAX_STATEMENT_ITEMS } from '@lifeguessr/types';
import { categorizeStatement, type CategorizeOptions } from '@/lib/api/statement';
import { readStatementCsv, StatementReadError, toStatementItems } from '@/lib/statement/read';
import type { StatementFileProblem, StatementFileResult } from './types';

/** Largest file we read: years of transactions are well under 1 MB. */
export const MAX_STATEMENT_FILE_BYTES = 5 * 1024 * 1024;

export class StatementFileError extends Error {
  readonly problem: StatementFileProblem;
  constructor(problem: StatementFileProblem, message: string) {
    super(message);
    this.name = 'StatementFileError';
    this.problem = problem;
  }
}

const CSV_TYPES = new Set(['', 'text/csv', 'text/plain', 'application/csv', 'text/comma-separated-values', 'application/vnd.ms-excel']);

export type ReadStatementDeps = {
  categorize?: typeof categorizeStatement;
} & CategorizeOptions;

export async function readStatementFile(file: File, deps: ReadStatementDeps = {}): Promise<StatementFileResult> {
  const { categorize = categorizeStatement, ...opts } = deps;
  if (!/\.(csv|txt)$/i.test(file.name) && !CSV_TYPES.has(file.type)) {
    throw new StatementFileError('notCsv', `${file.name} is not a CSV file`);
  }
  if (file.size > MAX_STATEMENT_FILE_BYTES) throw new StatementFileError('tooLarge', `${file.name} is too large`);

  let read;
  try {
    read = readStatementCsv(await file.text());
  } catch (err) {
    if (err instanceof StatementReadError) throw new StatementFileError(err.code, err.message);
    throw err;
  }
  const items = toStatementItems(read.transactions);
  if (items.length === 0) throw new StatementFileError('noTransactions', 'Every line has a zero amount');
  if (items.length > MAX_STATEMENT_ITEMS) throw new StatementFileError('tooMany', `${items.length} lines`);

  const { months, categorizedBy } = await categorize(items, opts);
  return {
    months,
    summary: {
      transactions: read.transactions.length,
      skippedPending: read.skipped.filter((s) => s.reason === 'pending').length,
      skippedOther: read.skipped.filter((s) => s.reason === 'notATransaction').length,
      from: read.transactions[0]!.date,
      to: read.transactions.at(-1)!.date,
      convention: read.convention,
      categorizedBy,
    },
  };
}
