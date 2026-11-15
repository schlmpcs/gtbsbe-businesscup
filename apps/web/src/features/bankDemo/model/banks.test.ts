import { DEMO_STATEMENT_FILES, readSyntheticStatement } from '@lifeguessr/data/fixtures/node';
import { describe, expect, it } from 'vitest';
import { bankDemo } from '@/copy';
import { readStatementCsv, toStatementItems } from '@/lib/statement/read';
import { DEMO_BANK_IDS, DEMO_BANKS, demoBank, isDemoBankId, searchDemoBanks } from './banks';
import { daysCovered, isCardPayment, previewStatement } from './preview';

const nameOf = (id: (typeof DEMO_BANK_IDS)[number]) => bankDemo.banks[id];

describe('demo banks → synthetic statements', () => {
  it('every bank is made up, says "(demo)" and maps to its own served synthetic statement', () => {
    expect(DEMO_BANKS.map((b) => b.id)).toEqual([...DEMO_BANK_IDS]);
    for (const b of DEMO_BANKS) {
      expect(nameOf(b.id)).toMatch(/\(demo\)$/);
      expect(DEMO_STATEMENT_FILES).toContain(b.statement);
      expect(b.initials).toMatch(/^[A-Z]{2}$/);
    }
    expect(new Set(DEMO_BANKS.map((b) => b.statement)).size).toBe(DEMO_BANKS.length);
    expect(isDemoBankId('maple')).toBe(true);
    expect(isDemoBankId('chase')).toBe(false);
    expect(demoBank('harbor').statement).toBe('hh01-austin-single-renter.csv');
  });

  it('each statement reads through the CSV pipeline the import uses', () => {
    for (const b of DEMO_BANKS) {
      const read = readStatementCsv(readSyntheticStatement(b.statement));
      expect(read.transactions.length).toBeGreaterThan(50);
      expect(toStatementItems(read.transactions).length).toBeGreaterThan(50);
    }
  });

  it('searches by every word of the name', () => {
    expect(searchDemoBanks('', nameOf)).toHaveLength(DEMO_BANKS.length);
    expect(searchDemoBanks('  harbor ', nameOf).map((b) => b.id)).toEqual(['harbor']);
    expect(searchDemoBanks('BANK demo', nameOf).map((b) => b.id)).toEqual(['harbor', 'lantern', 'bluebird']);
    expect(searchDemoBanks('chase', nameOf)).toEqual([]);
  });
});

describe('previewStatement', () => {
  it('shows the checking account the statement is, with its lines and days', () => {
    const text = readSyntheticStatement('hh01-austin-single-renter.csv');
    const p = previewStatement(text);
    const read = readStatementCsv(text);
    expect(p.text).toBe(text);
    expect(p.accounts[0]).toEqual({
      kind: 'checking',
      transactions: read.transactions.length,
      days: daysCovered(read.transactions[0]!.date, read.transactions.at(-1)!.date),
      from: read.transactions[0]!.date,
      to: read.transactions.at(-1)!.date,
    });
    expect(p.days).toBeGreaterThan(90);
  });

  it('adds a credit card only when checking pays one', () => {
    const withCard = previewStatement(readSyntheticStatement('hh01-austin-single-renter.csv'));
    expect(withCard.accounts[1]).toEqual({ kind: 'card', payments: 3 });
    const noCard = previewStatement(readSyntheticStatement('hh02-queens-retail-roommates.csv'));
    expect(noCard.accounts.map((a) => a.kind)).toEqual(['checking']);
  });

  it('tells card payments from other lines', () => {
    expect(isCardPayment('APPLECARD GSBANK PAYMENT WEB ID: 6901236969', 260.04)).toBe(true);
    expect(isCardPayment('CHASE CREDIT CRD AUTOPAY PPD ID: 4760039224', 512)).toBe(true);
    expect(isCardPayment('CAPITAL ONE MOBILE PMT', 90)).toBe(true);
    expect(isCardPayment('CAPITAL ONE MOBILE PMT', -90)).toBe(false);
    expect(isCardPayment('ATT*BILL PAYMENT 800-331-0500 TX', 81.35)).toBe(false);
    expect(isCardPayment('SHELL OIL DEBIT CARD', 30)).toBe(false);
    expect(daysCovered('2026-08-01', '2026-08-01')).toBe(1);
    expect(daysCovered('2026-08-01', '2026-11-28')).toBe(120);
  });
});
