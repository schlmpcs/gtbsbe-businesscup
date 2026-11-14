// Node-only fixture helpers (fs). Do not import from client components.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
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

/**
 * Folder of the 50 synthetic household statements (see synthetic-statements/README.md).
 * Built with path.join rather than `new URL('./synthetic-statements/', import.meta.url)`: this file
 * is bundled into the sample-statement API route, and Next's bundler treats a `new URL(…)` literal
 * as an asset to copy, which fails for a folder. The helpers below are only used by tests.
 */
export const syntheticStatementsDir: string = join(dirname(fileURLToPath(import.meta.url)), 'synthetic-statements');

/** File names of the synthetic statements, `hh01-…csv` to `hh50-…csv`, sorted. */
export function listSyntheticStatements(): string[] {
  return readdirSync(syntheticStatementsDir).filter((f) => f.endsWith('.csv')).sort();
}

/** One synthetic statement's raw text (BOM and line endings untouched). */
export function readSyntheticStatement(file: string): string {
  return readFileSync(join(syntheticStatementsDir, file), 'utf8');
}

/** `labels/answer-key.csv`: one row per statement row with its true category, kind and label basis. */
export function readSyntheticAnswerKey(): string {
  return readFileSync(join(syntheticStatementsDir, 'labels', 'answer-key.csv'), 'utf8');
}
