// S9 pipeline (T6/T7): a CSV statement file → CategoryTotals[] for review.
//   1. The file is read and parsed here, in the browser (lib/statement/read).
//   2. Each line becomes a StatementItem: masked label, amount, month, day. Nothing else is sent:
//      no file, no full dates, no balances, no account numbers or names.
//   3. /api/statement/categorize sorts the labels and sums the totals; nothing is stored there.
//      It also says how it sorted each line and what it could not settle (follow-up questions),
//      kept here in memory so an answer can re-sort a merchant without asking the server again.
//   4. JF7: the engine looks for paychecks and debt payments in the same lines, here in the browser
//      (findIncomeAndDebts). It reads the raw descriptions to recognise a payer or a lender, but
//      what it returns shows only lender names from its own list or text from the masked labels.
//      Nothing of it is sent; it is kept in memory for the S9 "We found" review (statementFindings).
// Privacy: CLAUDE.md rule 6, docs/ARCHITECTURE.md → Privacy design.
import { findIncomeAndDebts } from '@lifeguessr/engine';
import { MAX_STATEMENT_ITEMS, type StatementFindings, type Transaction } from '@lifeguessr/types';
import { categorizeStatement, type CategorizeOptions } from '@/lib/api/statement';
import { maskLabel } from '@/lib/statement/mask';
import { readStatementCsv, StatementReadError, toStatementItems } from '@/lib/statement/read';
import { rememberStatementRead } from './lastStatementRead';
import { forgetStatementFindings, rememberStatementFindings } from './statementFindings';
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
  /**
   * Keep what was read in memory: the masked lines for the subscription audit (`lastStatementRead`)
   * and the income and debts found for the S9 review (`statementFindings`). Default true.
   */
  remember?: boolean;
} & CategorizeOptions;

/** Income and debts in the statement (JF7), from each line's raw description and its masked label. */
export function findingsOf(transactions: readonly Transaction[]): StatementFindings {
  return findIncomeAndDebts(
    transactions
      .filter((t) => t.amount !== 0)
      .map((t) => ({ date: t.date, amount: t.amount, text: t.description, label: maskLabel(t.description) })),
  );
}

export async function readStatementFile(file: File, deps: ReadStatementDeps = {}): Promise<StatementFileResult> {
  const { categorize = categorizeStatement, remember = true, ...opts } = deps;
  if (!/\.(csv|txt)$/i.test(file.name) && !CSV_TYPES.has(file.type)) {
    throw new StatementFileError('notCsv', `${file.name} is not a CSV file`);
  }
  if (file.size > MAX_STATEMENT_FILE_BYTES) throw new StatementFileError('tooLarge', `${file.name} is too large`);
  // A new statement: what was found in the previous one no longer applies, even if this one fails.
  if (remember) forgetStatementFindings();

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

  const findings = findingsOf(read.transactions);
  const { months, categorizedBy, classes, lines, followUps } = await categorize(items, opts);
  // In memory only: for the subscription audit to open on its findings without a second upload, and
  // for the S9 review of the paychecks and debts found. Kept once the categorizer answered, so they
  // show together with the months they came from.
  if (remember) {
    rememberStatementRead({ items, classes });
    rememberStatementFindings(findings);
  }
  // The server answers one class per line sent, in order; anything else can't be lined up, so the
  // follow-ups are dropped with it rather than re-sorting the wrong lines.
  const classified = lines && lines.length === items.length
    ? items.map((item, i) => ({ ...item, cls: lines[i]!.cls, oneOffHint: lines[i]!.oneOffHint }))
    : null;
  return {
    months,
    findings,
    classified,
    followUps: classified ? (followUps ?? []) : [],
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
