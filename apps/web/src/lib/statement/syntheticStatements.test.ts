// Runs the real in-browser reader over all 50 synthetic household statements
// (packages/data/fixtures/synthetic-statements). They come in five bank layouts, so this is the
// widest format check we have that can live in the repo, and the answer key tells us what every
// row really is.
import { listSyntheticStatements, readSyntheticAnswerKey, readSyntheticStatement } from '@lifeguessr/data/fixtures/node';
import { StatementCategorizeRequestSchema } from '@lifeguessr/types';
import { describe, expect, it } from 'vitest';
import { readStatementCsv, toStatementItems } from './read';

const files = listSyntheticStatements();

// The answer key has no quoted cells (file names, categories and kinds never contain commas).
const kindsByFile = new Map<string, string[]>();
for (const line of readSyntheticAnswerKey().trim().split('\n').slice(1)) {
  const [file, , , kind] = line.split(',');
  if (!kindsByFile.has(file!)) kindsByFile.set(file!, []);
  kindsByFile.get(file!)!.push(kind!);
}

// Every personal name a statement carries: P2P counterparties, and the account holder's own name
// in BofA-style ACH lines (INDN:LAST, FIRST).
function namesIn(text: string): string[] {
  const names = new Set<string>();
  for (const re of [
    /Zelle payment (?:to|from) ([A-Z][a-z]+ [A-Z][a-z]+)/g,
    /Zelle money (?:sent to|received from) ([A-Z][a-z]+ [A-Z][a-z]+)/g,
    /Pay Friends - (?:Sent to|Received from) ([A-Z][a-z]+ [A-Z][a-z]+)/g,
    /ZELLE (?:TO|FROM) ([A-Z]+ [A-Z]+)/g,
    /VENMO \*([A-Za-z]+ [A-Za-z]+)/gi,
    /CASH APP\*([A-Za-z]+ [A-Za-z]+)/gi,
    /INDN:([A-Z]+, [A-Z]+)/g,
  ]) for (const m of text.matchAll(re)) names.add(m[1]!);
  return [...names];
}

describe('synthetic statements through the real reader', () => {
  it('are all present', () => {
    expect(files).toHaveLength(50);
  });

  it.each(files)('%s: every row reads, with money in and out the right way round', (file) => {
    const read = readStatementCsv(readSyntheticStatement(file));
    const kinds = kindsByFile.get(file)!;
    expect(read.skipped).toEqual([]);
    expect(read.transactions).toHaveLength(kinds.length);
    // amount > 0 is money out: spending and transfers to the household's own savings
    const out = kinds.filter((k) => k === 'spend' || k === 'transfer_out').length;
    expect(read.transactions.filter((t) => t.amount > 0)).toHaveLength(out);
    expect(read.transactions.filter((t) => t.amount < 0)).toHaveLength(kinds.length - out);
    for (const t of read.transactions) expect(t.date >= '2026-07-01' && t.date <= '2026-11-13').toBe(true);
  });

  it.each(files)('%s: no personal name reaches the wire items', (file) => {
    const text = readSyntheticStatement(file);
    const items = toStatementItems(readStatementCsv(text).transactions);
    expect(StatementCategorizeRequestSchema.safeParse({ items }).success).toBe(true);
    const wire = JSON.stringify(items).toLowerCase();
    for (const name of namesIn(text)) {
      // check the whole name, both as written and the other way round (INDN is "LAST, FIRST")
      const [a, b] = name.includes(',') ? name.split(', ') : name.split(' ');
      for (const form of [`${a} ${b}`, `${b} ${a}`, `${a}, ${b}`]) expect(wire, `${file}: ${name}`).not.toContain(form!.toLowerCase());
    }
  });
});
