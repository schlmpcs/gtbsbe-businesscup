import { describe, expect, it } from 'vitest';
import { maskLabel } from './mask';
import { readStatementCsv, toStatementItems } from './read';

const examples = [
  ['Online Payment #1234 To John Power 10/01', 'Online payment to [name]'],
  ['Online Payment # To Mary Water 10/01', 'Online payment to [name]'],
  ['ONLINE BANKING PAYMENT 1234 TO JANE DOE MEMO RENT', 'Online payment to [name]'],
  ['BILL PAY TO John Grill', 'Bill payment to [name]'],
  ['BILLPAY TO Jane Kitchen', 'Bill payment to [name]'],
  ['Online Bill Payment to Pat Pub confirmation 7A2B3C', 'Bill payment to [name]'],
  ['CHECK #1234 PAYEE Sam Gas', 'Check to [name]'],
  ['Check 12 payable to José García', 'Check to [name]'],
  ['Deposit from Alice Rent', 'Deposit from [name]'],
  ['MOBILE DEPOSIT FROM 李 明 memo birthday', 'Deposit from [name]'],
  ['ACH CREDIT Daniel Bank', 'ACH credit [name]'],
  ['ACH DEBIT Priya Shah', 'ACH debit [name]'],
  ['Online Payment # To COMCAST 10/01', 'Online payment to [name]'],
  ['BILL PAY TO ACME LLC', 'Bill payment to [name]'],
  ['ACH CREDIT ACME CORP INDN:JOHN DOE PPD', 'ACH credit [name]'],
] as const;

describe('named payee and payer privacy', () => {
  it.each(examples)('drops the full counterparty and memo in %s', (raw, expected) => {
    expect(maskLabel(raw)).toBe(expected);
    expect(maskLabel(expected)).toBe(expected);
    expect(maskLabel(raw.toLowerCase())).toBe(expected);
  });

  it('does not mistake generic keywords or company suffixes for proof of a business', () => {
    for (const name of ['John Power', 'Jane Water', 'Sam Rent', 'Mary Gas', 'Pat Grill', 'Lee Kitchen', 'Kim Pub', 'Brian Co', 'John Bank']) {
      for (const raw of [`BILL PAY TO ${name}`, `ACH CREDIT ${name}`, `Deposit from ${name}`]) {
        expect(maskLabel(raw)).not.toContain(name);
      }
    }
  });

  it('keeps ordinary merchant purchases and structured ACH masking intact', () => {
    expect(maskLabel('CHECKCARD 1012 COMCAST 123456')).toBe('CHECKCARD # COMCAST #');
    expect(maskLabel('COMCAST PAYMENT 123456')).toBe('COMCAST PAYMENT #');
    expect(maskLabel('CO NAME:ACME CORP INDN:JANE ROE PPD')).toBe('CO NAME:ACME CORP INDN:[name] PPD');
  });

  it('masks before the parsed CSV is converted into the wire payload', () => {
    const csv = ['Date,Description,Amount', ...examples.map(([raw], i) => `2026-10-${String(i + 1).padStart(2,'0')},"${raw}",-25.00`)].join('\n');
    const items = toStatementItems(readStatementCsv(csv).transactions);
    expect(items.map(item => item.label)).toEqual(examples.map(([, masked]) => masked));
    for (const item of items) expect(Object.keys(item).sort()).toEqual(['amount', 'day', 'label', 'month']);
    expect(items.every(item => item.amount === 25 && item.month === '2026-10')).toBe(true);
  });
});
