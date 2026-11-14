// Opt-in acceptance check: real exports stay outside the repository and CI.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { StatementCategorizeRequestSchema } from '@lifeguessr/types';
import { expect, it } from 'vitest';
import { maskLabel } from './mask';
import { readStatementCsv, toStatementItems } from './read';

const rawPaths: unknown = JSON.parse(process.env.REAL_STATEMENT_EXPORTS ?? '[]');
if (!Array.isArray(rawPaths) || rawPaths.some(path => typeof path !== 'string')) {
  throw new Error('REAL_STATEMENT_EXPORTS must be a JSON array of local file paths');
}
const paths: string[] = rawPaths;

it.skipIf(paths.length === 0)('parses two distinct real local exports into valid masked wire items', async () => {
  expect(paths.length).toBe(2);
  expect(new Set(paths.map(path => resolve(path))).size).toBe(2);
  const files = await Promise.all(paths.map(path => readFile(path, 'utf8')));
  // Passing the same export twice is not evidence for two formats/files.
  expect(files[0] === files[1]).toBe(false);
  for (const csv of files) {
    const read = readStatementCsv(csv);
    const items = toStatementItems(read.transactions);
    expect(items.length).toBeGreaterThan(0);
    // Report only validity, never bank descriptions or account details on a failure.
    expect(StatementCategorizeRequestSchema.safeParse({ items }).success).toBe(true);
    expect(items.every(item => maskLabel(item.label) === item.label)).toBe(true);
    expect(items.every(item => Object.keys(item).sort().join(',') === 'amount,day,label,month')).toBe(true);
  }
});
