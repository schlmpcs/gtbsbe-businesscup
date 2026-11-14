// Node-only fixture helpers (fs). Do not import from client components.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Absolute path of the sample bank statement CSV (Chase-style checking export, Jul–Nov 2026). */
export const statementSampleCsvPath: string = fileURLToPath(new URL('./statement.sample.csv', import.meta.url));

/** The sample bank statement CSV as text. Contains Zelle/Venmo lines with personal names to mask. */
export function readStatementSampleCsv(): string {
  return readFileSync(statementSampleCsvPath, 'utf8');
}

/**
 * Synthetic statement exports, one per amount layout the CSV reader must handle (T6):
 * - `sample`: the demo statement; one signed Amount column, money out negative, a Debit/Credit
 *   "Details" column, a trailing Balance column and an empty last column.
 * - `debit-credit`: separate Debit and Credit columns (from #55).
 * - `signed-bank`: one signed Amount column with ISO dates and a quoted comma (from #55).
 * - `credit-card`: a card export where money out is positive; BOM, CRLF line endings, quoted
 *   commas, a thousands separator and pending lines.
 */
export const STATEMENT_FIXTURES = ['sample', 'debit-credit', 'signed-bank', 'credit-card'] as const;
export type StatementFixture = (typeof STATEMENT_FIXTURES)[number];

/** A statement fixture's raw text (BOM and line endings untouched). */
export function readStatementFixtureCsv(name: StatementFixture): string {
  return readFileSync(fileURLToPath(new URL(`./statement.${name}.csv`, import.meta.url)), 'utf8');
}
