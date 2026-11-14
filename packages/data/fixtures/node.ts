// Node-only fixture helpers (fs). Do not import from client components.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Absolute path of the sample bank statement CSV (Chase-style checking export, Jul–Nov 2026). */
export const statementSampleCsvPath: string = fileURLToPath(new URL('./statement.sample.csv', import.meta.url));

/** The sample bank statement CSV as text. Contains Zelle/Venmo lines with personal names to mask. */
export function readStatementSampleCsv(): string {
  return readFileSync(statementSampleCsvPath, 'utf8');
}
