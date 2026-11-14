// The CSV reader on the four synthetic exports (one per amount layout) and on the edge cases real
// exports have. Some cases are ported from #55 (apps/web/src/lib/csv.test.ts).
import { readStatementFixtureCsv, STATEMENT_FIXTURES } from '@lifeguessr/data/fixtures/node';
import { StatementItemSchema } from '@lifeguessr/types';
import { describe, expect, it } from 'vitest';
import { parseDate, parseMoney, readStatementCsv, StatementReadError, toStatementItems } from './read';

const amounts = (text: string) => readStatementCsv(text).transactions.map((t) => t.amount);
const errorCode = (fn: () => unknown) => {
  try {
    fn();
  } catch (err) {
    return err instanceof StatementReadError ? err.code : 'other';
  }
  return null;
};

describe('the statement fixtures', () => {
  it.each(STATEMENT_FIXTURES)('%s: reads every line into valid StatementItems', (name) => {
    const read = readStatementCsv(readStatementFixtureCsv(name));
    expect(read.transactions.length).toBeGreaterThan(0);
    const items = toStatementItems(read.transactions);
    for (const item of items) expect(StatementItemSchema.safeParse(item).success).toBe(true);
    expect(items.some((i) => i.amount > 0)).toBe(true);
    expect(read.transactions.map((t) => t.date)).toEqual([...read.transactions.map((t) => t.date)].sort());
  });

  it('sample (Chase-style checking): money out is negative, told by the Details column', () => {
    const read = readStatementCsv(readStatementFixtureCsv('sample'));
    expect(read.convention).toBe('outflowNegative');
    expect(read.columns).toEqual({ date: 'Posting Date', description: 'Description', amount: ['Amount'] });
    expect(read.skipped).toEqual([]);
    expect(read.transactions).toHaveLength(170);
    const pay = read.transactions.filter((t) => t.description.includes('PAYROLL'));
    expect(pay.length).toBeGreaterThan(0);
    expect(pay.every((t) => t.amount === -2400)).toBe(true);
    expect(read.transactions.find((t) => t.description.startsWith('OAKWOOD APTS'))!.amount).toBe(1720);
    expect(read.transactions[0]!.date).toBe('2026-07-01');
    expect(read.transactions.at(-1)!.date).toBe('2026-11-12');
  });

  it('debit-credit: debits are money out, credits money in', () => {
    const read = readStatementCsv(readStatementFixtureCsv('debit-credit'));
    expect(read.convention).toBe('debitCredit');
    expect(read.columns.amount).toEqual(['Debit', 'Credit']);
    expect(read.transactions.map((t) => [t.description, t.amount])).toEqual([
      ['ACME PAYROLL', -5500], ['RENT PAYMENT', 1800], ['VENMO Jane Example 123456789', 45],
    ]);
  });

  it('signed-bank: pay deposits show that negative amounts are money out', () => {
    const read = readStatementCsv(readStatementFixtureCsv('signed-bank'));
    expect(read.convention).toBe('outflowNegative');
    expect(read.transactions.map((t) => [t.description, t.amount])).toEqual([
      ['ACME PAYROLL', -5500], ['RENT PAYMENT', 1800], ['CAFE, MAIN STREET', 12.5],
    ]);
  });

  it('credit-card: positive charges are money out; BOM, CRLF, thousands and pending lines', () => {
    const text = readStatementFixtureCsv('credit-card');
    expect(text.startsWith('\uFEFF')).toBe(true);
    expect(text).toContain('\r\n');
    const read = readStatementCsv(text);
    expect(read.convention).toBe('outflowPositive');
    expect(read.columns.date).toBe('Trans. Date');
    expect(read.skipped).toEqual([{ row: 10, reason: 'pending' }, { row: 13, reason: 'pending' }]);
    expect(read.transactions).toHaveLength(10);
    expect(read.transactions.find((t) => t.description.startsWith('HEB'))!.amount).toBe(1102.35);
    expect(read.transactions.find((t) => t.description.startsWith('INTERNET PAYMENT'))!.amount).toBe(-450);
    expect(read.transactions.find((t) => t.description.startsWith("TRADER JOE'S"))!.description).toBe("TRADER JOE'S #552, AUSTIN TX");
  });
});

describe('column detection', () => {
  it('finds the header below a summary block (Bank of America style) and skips the balance line', () => {
    const text = [
      'Description,,Summary Amt.',
      'Beginning balance as of 10/01/2026,,"1,000.00"',
      'Total credits,,"2,000.00"',
      '',
      'Date,Description,Amount,Running Bal.',
      '10/01/2026,Beginning balance as of 10/01/2026,,"1,000.00"',
      '10/02/2026,"ACME DES:PAYROLL ID:XXXXX1 INDN:JANE ROE CO ID:1 PPD","2,000.00","3,000.00"',
      '10/03/2026,KROGER #123,-54.20,"2,945.80"',
      '10/04/2026,SHELL OIL 123,-40.00,"2,905.80"',
    ].join('\n');
    const read = readStatementCsv(text);
    expect(read.columns).toEqual({ date: 'Date', description: 'Description', amount: ['Amount'] });
    expect(read.skipped).toEqual([{ row: 6, reason: 'notATransaction' }]);
    expect(read.transactions.map((t) => t.amount)).toEqual([-2000, 54.2, 40]);
  });

  it('infers the columns of a file without a header (Wells Fargo style)', () => {
    const text = [
      '"10/30/2026","-12.34","*","","PURCHASE AUTHORIZED ON 10/28 STARBUCKS STORE 123 S#123"',
      '"10/29/2026","2400.00","*","","ACME PAYROLL DIR DEP"',
      '"10/28/2026","-80.00","*","","KROGER #555"',
    ].join('\n');
    const read = readStatementCsv(text);
    expect(read.columns).toEqual({ date: 'column 1', description: 'column 5', amount: ['column 2'] });
    expect(read.convention).toBe('outflowNegative');
    expect(read.transactions.map((t) => t.amount)).toEqual([80, -2400, 12.34]);
  });

  it('prefers the transaction date over the posting date, and Description over Original Description', () => {
    const text = 'Post Date,Transaction Date,Original Description,Description,Amount\n10/05/2026,10/03/2026,SQ *CAFE 1,Cafe,4.5\n10/06/2026,10/04/2026,AMZN,Amazon,20';
    const read = readStatementCsv(text);
    expect(read.columns).toMatchObject({ date: 'Transaction Date', description: 'Description' });
    expect(read.transactions[0]!.date).toBe('2026-10-03');
  });

  it('uses a Debit/Credit type column for unsigned amounts', () => {
    const text = 'Date,Description,Amount,Transaction Type\n2026-10-01,PAYROLL,2000,credit\n2026-10-02,KROGER,50,debit\n2026-10-03,TARGET,30,debit\n2026-10-04,RETURN TARGET,10,credit';
    const read = readStatementCsv(text);
    expect(read.convention).toBe('typeColumn');
    expect(read.transactions.map((t) => t.amount)).toEqual([-2000, 50, 30, -10]);
  });

  it('reads a card export whose Type column says Sale with negative amounts', () => {
    const text = 'Transaction Date,Post Date,Description,Category,Type,Amount,Memo\n10/01/2026,10/02/2026,NETFLIX,Ent,Sale,-17.99,\n10/03/2026,10/04/2026,PAYMENT THANK YOU,,Payment,200.00,\n10/05/2026,10/05/2026,KROGER,Groceries,Sale,-60.00,\n10/06/2026,10/06/2026,KROGER,Groceries,Return,5.00,';
    const read = readStatementCsv(text);
    expect(read.convention).toBe('outflowNegative');
    expect(read.transactions.map((t) => t.amount)).toEqual([17.99, -200, 60, -5]);
  });

  it('skips lines marked pending in a Status column, the date or the description', () => {
    const text = 'Date,Description,Amount,Status\n2026-10-01,KROGER,-5,Posted\n2026-10-02,TARGET,-6,Pending\nPending,UBER,-7,\n2026-10-03,PENDING - NETFLIX,-8,';
    const read = readStatementCsv(text);
    expect(read.transactions.map((t) => t.description)).toEqual(['KROGER']);
    expect(read.skipped.map((s) => s.reason)).toEqual(['pending', 'pending', 'pending']);
  });

  it('skips lines that are not transactions and keeps the rest', () => {
    const text = 'Date,Description,Amount\n2026-10-01,KROGER,-5\nTotal,,-5\n2026-10-02,,-3\n2026-10-03,SHOP,abc\n2026-10-04,TARGET,-6,extra';
    const read = readStatementCsv(text);
    expect(read.transactions.map((t) => t.description)).toEqual(['KROGER', 'TARGET']);
    expect(read.skipped).toEqual([
      { row: 3, reason: 'notATransaction' }, { row: 4, reason: 'notATransaction' }, { row: 5, reason: 'notATransaction' },
    ]);
  });

  it('skips a Debit/Credit line with both or neither filled in (ported from #55)', () => {
    for (const cells of [',', '10,5']) {
      const read = readStatementCsv(`Date,Description,Debit,Credit\n2026-01-01,Shop,${cells}\n2026-01-02,Kroger,4,`);
      expect(read.transactions).toHaveLength(1);
      expect(read.skipped).toEqual([{ row: 2, reason: 'notATransaction' }]);
    }
    expect(amounts('Date,Description,Debit,Credit\n2026-01-01,refund,,25\n2026-01-02,Shop,-10,')).toEqual([-25, 10]);
  });

  it('reads semicolon-separated exports', () => {
    expect(amounts('Date;Description;Amount\n2026-10-01;KROGER;-5.00\n2026-10-02;PAYROLL;100.00')).toEqual([5, -100]);
  });

  it('fails with a code when nothing usable is in the file', () => {
    expect(errorCode(() => readStatementCsv(''))).toBe('empty');
    expect(errorCode(() => readStatementCsv('\n\n'))).toBe('empty');
    expect(errorCode(() => readStatementCsv('a,b\n"oops,b'))).toBe('malformed');
    expect(errorCode(() => readStatementCsv('Name,Age\nAnn,30'))).toBe('noColumns');
    expect(errorCode(() => readStatementCsv('Date,Description,Amount\nTotal,,5'))).toBe('noTransactions');
  });
});

describe('sign convention', () => {
  it('falls back to the sign most lines have', () => {
    expect(amounts('Date,Description,Amount\n2026-10-01,A,-5\n2026-10-02,B,-6\n2026-10-03,C,100')).toEqual([5, 6, -100]);
    expect(amounts('Date,Description,Amount\n2026-10-01,A,5\n2026-10-02,B,6\n2026-10-03,C,-100')).toEqual([5, 6, -100]);
  });

  it('lets pay deposits override the majority', () => {
    // Most lines are negative, but pay is too: so money out is positive here.
    expect(amounts('Date,Description,Amount\n2026-10-01,ACME PAYROLL,-3000\n2026-10-02,B,6\n2026-10-03,C,-100')).toEqual([-3000, 6, -100]);
  });
});

describe('parseDate', () => {
  it.each([
    ['2026-02-03', [2026, 2, 3]], ['2026/2/3', [2026, 2, 3]], ['2026-02-03T10:00:00Z', [2026, 2, 3]],
    ['02/03/2026', [2026, 2, 3]], ['2/3/26', [2026, 2, 3]], ['02-03-2026', [2026, 2, 3]],
    ['Feb 3, 2026', [2026, 2, 3]], ['February 03 2026', [2026, 2, 3]], ['03 Feb 2026', [2026, 2, 3]],
    ['03-Feb-2026', [2026, 2, 3]], ['2024-02-29', [2024, 2, 29]],
  ])('%s', (cell, [year, month, day]) => {
    expect(parseDate(cell)).toEqual({ year, month, day });
  });

  it.each(['2026-02-29', '2026-04-31', '2026-13-01', '0001-01-01', '2026-01-00', '02/30/2026', '31/12/2026', 'yesterday', ''])(
    'rejects %s (ported from #55)',
    (cell) => {
      expect(parseDate(cell)).toBeNull();
    },
  );
});

describe('parseMoney', () => {
  it.each([
    ['12.50', 12.5], ['-12.50', -12.5], ['($12.50)', -12.5], ['+$12.50', 12.5], ['-$12.50', -12.5], ['$-12.50', -12.5],
    ['12.50-', -12.5], ['$1,234.50', 1234.5], ['1,234', 1234], ['.5', 0.5], [' 7 ', 7], ['\u221212.00', -12], ['USD 5.00', 5],
    ['0.00', 0], ['-0.00', 0],
  ])('%s → %s', (cell, value) => {
    expect(parseMoney(cell)).toBe(value);
  });

  it('is null for a blank cell', () => {
    expect(parseMoney('  ')).toBeNull();
  });

  it.each(['NaN', 'Infinity', '1e3', '0x10', '1.234', '--1', '1000000000001', '1,23', '12.5.0', '-(5)', 'abc'])(
    'rejects %s (ported from #55)',
    (cell) => {
      expect(parseMoney(cell)).toBeNaN();
    },
  );
});

describe('toStatementItems', () => {
  it('sends only the masked label, amount, month and day, and drops zero lines', () => {
    const items = toStatementItems([
      { date: '2026-10-07', description: 'Zelle payment to Tom Becker JPM99K1L2M3N', amount: 40 },
      { date: '2026-10-08', description: 'FREE THING', amount: 0 },
    ]);
    expect(items).toEqual([{ label: 'Zelle to [name]', amount: 40, month: '2026-10', day: 7 }]);
    expect(Object.keys(items[0]!).sort()).toEqual(['amount', 'day', 'label', 'month']);
  });
});
