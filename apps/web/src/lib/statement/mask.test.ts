import { readStatementSampleCsv } from '@lifeguessr/data/fixtures/node';
import { describe, expect, it } from 'vitest';
import { MAX_LABEL_LENGTH, maskLabel } from './mask';
import { readStatementCsv } from './read';

describe('maskLabel', () => {
  it.each([
    ['Zelle payment to Tom Becker JPM99K1L2M3N', 'Zelle to [name]'],
    ['Zelle payment from Daniel Kim WFCT0QX8PL2M', 'Zelle from [name]'],
    ['VENMO PAYMENT 1038492751 FROM PRIYA SHAH WEB ID: 3264681992', 'Venmo from [name]'],
    ['VENMO *Jake Morris Visa Direct NY', 'Venmo [name]'],
    ['Venmo John Doe', 'Venmo [name]'],
    ['PAYPAL *ALICE SMITH', 'PayPal [name]'],
    ['Cash App*Bob Jones*Oakland', 'Cash App [name]'],
    ['CHASE QUICKPAY SENT TO MARIA LOPEZ', 'Zelle to [name]'],
    ['APPLE CASH SENT MONEY TO Sam Lee', 'Apple Cash to [name]'],
    ['Pay Anyone to John Smith', 'Pay Anyone to [name]'],
    ['Pay Anyone - Received from Grace Kim', 'Pay Anyone from [name]'],
    ['Pay Friends - Sent to Sarah Nguyen', 'Pay Friends to [name]'],
    ['PAY FRIENDS RECEIVED FROM ANA LOPEZ', 'Pay Friends from [name]'],
  ])('masks the person in a person-to-person line: %s', (raw, masked) => {
    expect(maskLabel(raw)).toBe(masked);
  });

  it.each([
    ['Online Transfer to SAV ...4821 transaction#: 45446467599', 'Transfer to savings'],
    ['ONLINE TRANSFER FROM CHK 1234 CONF# 77Q1', 'Transfer from checking'],
    ['TRANSFER TO SAVINGS 123456', 'Transfer to savings'],
    ['Online Banking transfer to CRD 9876 Confirmation# 12345', 'Transfer to card'],
    ['Online Banking transfer to Jordan 9876', 'Transfer to [name]'],
    ['Transfer to credit card ending 1234', 'Transfer to card'],
    ['WIRE TRANSFER FROM JOHN Q PUBLIC', 'Transfer from [name]'],
    ['WIRE OUT TO ACME HOLDINGS', 'Wire to [name]'],
    ['BALANCE TRANSFER FEE', 'Transfer fee'],
  ])('keeps only the direction and account type of a transfer: %s', (raw, masked) => {
    expect(maskLabel(raw)).toBe(masked);
  });

  it('masks ACH individual names but keeps the company', () => {
    expect(maskLabel('ACME CORP DES:PAYROLL ID:XXXXX12345 INDN:JOHN A DOE CO ID:1234567890 PPD'))
      .toBe('ACME CORP DES:PAYROLL ID:# INDN:[name] CO ID:# PPD');
    expect(maskLabel('ORIG CO NAME:ACME LOGISTICS ORIG ID:9111111101 IND NAME:JANE ROE TRN:1234567'))
      .toBe('ORIG CO NAME:ACME LOGISTICS ORIG ID:# IND NAME:[name] TRN:#');
    expect(maskLabel('RECEIVER: Pat Smith')).toBe('RECEIVER:[name]');
  });

  it('masks card and account numbers, phone numbers, e-mails and reference codes', () => {
    expect(maskLabel('Shop 4111-1111-1111-1111 alice@example.com')).toBe('Shop # [email]');
    expect(maskLabel('NETFLIX.COM 866-579-7172 CA')).toBe('NETFLIX.COM # CA');
    expect(maskLabel('AMAZON MKTPL*2B7XY1QZ0 Amzn.com/bill WA')).toBe('AMAZON MKTPL*[ref] Amzn.com/bill WA');
    expect(maskLabel('CHECKCARD 1012 PURCHASE XXXXXXXXXXXX4821')).toBe('CHECKCARD # PURCHASE #');
    expect(maskLabel('PAYMENT ACCT ****4821')).toBe('PAYMENT ACCT #');
    expect(maskLabel('ALDI 75216 DALLAS TX')).toBe('ALDI # DALLAS TX');
  });

  it('keeps short numbers that name a merchant', () => {
    expect(maskLabel('EXXON 7-ELEVEN 41022 DALLAS TX')).toBe('EXXON 7-ELEVEN # DALLAS TX');
    expect(maskLabel('QT 873 DALLAS TX')).toBe('QT 873 DALLAS TX');
  });

  it('normalizes whitespace and control characters, caps the length and never returns empty', () => {
    expect(maskLabel('  STARBUCKS\tSTORE\n 12345  ')).toBe('STARBUCKS STORE #');
    expect(maskLabel('a'.repeat(300))).toHaveLength(MAX_LABEL_LENGTH);
    expect(maskLabel('')).toBe('Unknown');
    expect(maskLabel('123456789')).toBe('Unknown');
  });

  it('is idempotent (the server masks again)', () => {
    const raws = [
      'Zelle payment to Tom Becker JPM99K1L2M3N',
      'Pay Friends - Sent to Sarah Nguyen',
      'Online Transfer to SAV ...4821 transaction#: 45446467599',
      'ACME CORP DES:PAYROLL ID:XXXXX12345 INDN:JOHN A DOE CO ID:1234567890 PPD',
      'AMAZON MKTPL*2B7XY1QZ0 Amzn.com/bill WA',
      'TXU ENERGY WEB PMT 424139 WEB ID: 0000756589',
      'WIRE OUT TO ACME HOLDINGS',
      '',
    ];
    for (const raw of raws) expect(maskLabel(maskLabel(raw))).toBe(maskLabel(raw));
  });

  it('leaves no personal name from the sample statement in any label', () => {
    const names = ['Tom Becker', 'Maria Lopez', 'Daniel Kim', 'Priya Shah', 'Jake Morris'];
    const raw = readStatementCsv(readStatementSampleCsv()).transactions.map((t) => t.description);
    expect(raw.some((d) => names.some((n) => d.toLowerCase().includes(n.toLowerCase())))).toBe(true);
    for (const label of raw.map(maskLabel)) {
      for (const n of names) {
        const surname = n.split(' ')[1]!;
        expect(label).not.toMatch(new RegExp(`\\b(${n}|${surname})\\b`, 'i'));
      }
      expect(label).not.toMatch(/\d{4}/);
    }
  });
});
