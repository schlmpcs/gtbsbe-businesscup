// M1: the committed `statementItemsSample` (packages/data/fixtures/statementItems.sample.json) is what
// this reader and masker make of statement.sample.csv. Engine tests use the committed items so they
// need neither the CSV reader nor the masker; this test is what keeps the two from drifting apart.
//
// If the CSV, the reader or the masker changes on purpose, regenerate the file from the repo root:
//   UPDATE_FIXTURES=1 pnpm exec vitest run apps/web/src/lib/statement/sampleItems.test.ts
// then review the diff of statementItems.sample.json (it is one item per line) and, when a charge
// changed, packages/data/fixtures/subscriptions.expected.json by hand.
import { readStatementSampleCsv } from '@lifeguessr/data/fixtures/node';
import { merchantKey } from '@lifeguessr/engine';
import type { StatementItem } from '@lifeguessr/types';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readStatementCsv, toStatementItems } from './read';

const FIXTURE_PATH = fileURLToPath(new URL('../../../../../packages/data/fixtures/statementItems.sample.json', import.meta.url));

const itemsOf = (csv: string): StatementItem[] => toStatementItems(readStatementCsv(csv).transactions);
/** The committed fixtures, loaded when a test asks (so UPDATE_FIXTURES can create the file first). */
const loadFixtures = () => import('@lifeguessr/data/fixtures/tools');

/** One item per line, so a change to the CSV shows up as a small, reviewable diff. */
const formatItems = (items: readonly StatementItem[]): string => `[\n${items.map((i) => `  ${JSON.stringify(i)}`).join(',\n')}\n]\n`;

describe.skipIf(process.env.UPDATE_FIXTURES !== '1')('regenerating statementItems.sample.json (UPDATE_FIXTURES=1)', () => {
  it('writes the file from statement.sample.csv', () => {
    writeFileSync(FIXTURE_PATH, formatItems(itemsOf(readStatementSampleCsv())));
  });
});

describe('statementItemsSample', () => {
  it('equals what the reader and masker make of statement.sample.csv', async () => {
    const { statementItemsSample } = await loadFixtures();
    expect(
      statementItemsSample,
      'statementItems.sample.json is out of date: see the note at the top of sampleItems.test.ts',
    ).toEqual(itemsOf(readStatementSampleCsv()));
  });

  it('fails the check above when the CSV changes: a new amount, a new description, a missing line or an extra one', async () => {
    const { statementItemsSample } = await loadFixtures();
    const csv = readStatementSampleCsv();
    const lines = csv.trimEnd().split('\n');
    const drifted = [
      csv.replace('-11.99,DEBIT_CARD', '-12.99,DEBIT_CARD'),                            // Spotify costs a dollar more
      csv.replace('NETFLIX.COM 866-579-7172 CA', 'NETFLIX.COM 866-579-7172 NY'),        // another descriptor
      [lines[0], ...lines.slice(2)].join('\n'),                                         // the newest line is gone
      [...lines, 'DEBIT,06/30/2026,SPOTIFY USA 877-778-1161 NY,-11.99,DEBIT_CARD,0.00,'].join('\n'), // an older line was added
    ];
    for (const text of drifted) {
      expect(text).not.toBe(csv);                                                      // each edit really changed the CSV
      expect(statementItemsSample).not.toEqual(itemsOf(text));
    }
  });

  it('holds one item per CSV line (170 transactions), oldest first, in the five months of the statement', async () => {
    const { statementItemsSample } = await loadFixtures();
    expect(readStatementSampleCsv().trimEnd().split('\n')).toHaveLength(171);        // the header and 170 lines
    expect(statementItemsSample).toHaveLength(170);
    const months = statementItemsSample.map((i) => i.month);
    expect(months).toEqual([...months].sort());
    expect([...new Set(months)]).toEqual(['2026-07', '2026-08', '2026-09', '2026-10', '2026-11']);
    expect(statementItemsSample[0]).toMatchObject({ month: '2026-07', day: 1 });
    expect(statementItemsSample.at(-1)).toMatchObject({ month: '2026-11', day: 12 });
  });

  it('keeps money out positive and money in negative', async () => {
    const { statementItemsSample } = await loadFixtures();
    const payroll = statementItemsSample.filter((i) => i.label.includes('PAYROLL'));
    expect(payroll).toHaveLength(10);                                                 // paid every 2 weeks, 10 times from 3 Jul to 6 Nov
    expect(payroll.every((i) => i.amount === -2400)).toBe(true);
    expect(statementItemsSample.filter((i) => i.label.startsWith('OAKWOOD APTS')).map((i) => i.amount)).toEqual([1720, 1720, 1720, 1720, 1720]);
  });

  it('leaves no personal name or long number in a label (the privacy rule the masker enforces)', async () => {
    const { statementItemsSample } = await loadFixtures();
    for (const { label } of statementItemsSample) {
      expect(label, label).not.toMatch(/Becker|Lopez|Morris|Shah|Kim\b/);
      expect(label, label).not.toMatch(/\d{4}/);
    }
    expect(statementItemsSample.filter((i) => /^Zelle/.test(i.label)).every((i) => /\[name\]$/.test(i.label))).toBe(true);
  });
});

describe('subscriptionsExpected (the golden audit) agrees with the statement it was derived from', () => {
  // The golden file is worked out by hand from the CSV (docs: the audit M3 must reproduce). This does
  // not detect anything: it only counts the lines each golden finding says it saw.
  it('names every finding by the merchantKey of its lines, and counts, dates and prices them as the lines do', async () => {
    const { statementItemsSample, subscriptionsExpected } = await loadFixtures();
    for (const f of subscriptionsExpected.findings) {
      const lines = statementItemsSample.filter((i) => i.amount > 0 && merchantKey(i.label) === f.merchantKey);
      expect(lines.length, `${f.id}: charges seen`).toBe(f.chargesSeen);
      expect(lines.every((i) => i.amount === f.amount), `${f.id}: every charge is ${f.amount}`).toBe(true);
      const last = lines.at(-1)!;
      expect({ month: last.month, day: last.day }, `${f.id}: last charge`).toEqual(f.lastCharge);
      expect(last.label, `${f.id}: label is the latest charge's label`).toBe(f.label);
    }
  });

  it('covers the months and the last day of the statement', async () => {
    const { statementItemsSample, subscriptionsExpected } = await loadFixtures();
    expect(subscriptionsExpected.monthsCovered).toBe(new Set(statementItemsSample.map((i) => i.month)).size);
    expect(subscriptionsExpected.asOf).toEqual({ month: '2026-11', day: 12 });
    const latest = statementItemsSample.at(-1)!;
    expect(subscriptionsExpected.asOf).toEqual({ month: latest.month, day: latest.day });
  });
});
