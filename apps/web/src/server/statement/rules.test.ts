import { describe, expect, it } from 'vitest';
import { maskLabel } from '@/lib/statement/mask';
import { ruleClass } from './rules';

const out = (raw: string) => ruleClass(maskLabel(raw), 'out');
const inn = (raw: string) => ruleClass(maskLabel(raw), 'in');

describe('ruleClass: money out', () => {
  it.each([
    ['OAKWOOD APTS WEB PMTS 8872213 WEB ID: 1841234567', 'rentUtilities'],
    ['RENT PAYMENT', 'rentUtilities'],
    ['TXU ENERGY WEB PMT 424139 WEB ID: 0000756589', 'rentUtilities'],
    ['ATMOS ENERGY PAYMENT PPD ID: 7750000000', 'rentUtilities'],
    ['SPECTRUM 855-707-7328 TX', 'rentUtilities'],
    ['SOUTHWEST GAS CORP', 'rentUtilities'],
    ['SHELL OIL 57444125 DALLAS TX', 'car'],
    ['EXXON 7-ELEVEN 41022 DALLAS TX', 'car'],
    ['QT 873 DALLAS TX', 'car'],
    ['PROGRESSIVE *INSURANCE 800-776-4737 OH', 'car'],
    ['UBER *TRIP HELP.UBER.COM', 'car'],
    ['ENTERPRISE RENT-A-CAR', 'car'],
    ['BRIGHT HORIZONS 0042', 'childcare'],
    ['KIDDIE ACADEMY OF PLANO', 'childcare'],
    ['ALDI 75216 DALLAS TX', 'groceries'],
    ['KROGER #0573 DALLAS TX', 'groceries'],
    ['TOM THUMB #3524 DALLAS TX', 'groceries'],
    ['WALMART SUPERCENTER #1059 DALLAS TX', 'groceries'],
    ["TRADER JOE'S #552, AUSTIN TX", 'groceries'],
    ['HEB #031 AUSTIN TX', 'groceries'],
    ['UBER *EATS HELP.UBER.COM CA', 'eatingOut'],
    ['DOORDASH*TORCHYS TACOS SAN FRANCISCO CA', 'eatingOut'],
    ['STARBUCKS STORE 12345 DALLAS TX', 'eatingOut'],
    ['HOPDODDY BURGER BAR DALLAS TX', 'eatingOut'],
    ['WHATABURGER 0812 DALLAS TX', 'eatingOut'],
    ['TST* LOCAL FAVORITE', 'eatingOut'],
    ['NETFLIX.COM 866-579-7172 CA', 'subscriptions'],
    ['SPOTIFY USA 877-778-1161 NY', 'subscriptions'],
    ['APPLE.COM/BILL 866-712-7753 CA', 'subscriptions'],
    ['PLANET FITNESS CLUB FEES', 'subscriptions'],
    ['CAPITAL ONE MOBILE PMT 261020 WEB ID: 9279744991', 'debtPayments'],
    ['TOYOTA FINANCIAL ONLINE PMT PPD ID: 1953223322', 'debtPayments'],
    ['CHASE CREDIT CRD AUTOPAY PPD ID: 4760039224', 'debtPayments'],
    ['Transfer to credit card ending 1234', 'debtPayments'],
    ['NAVIENT STUDENT LN', 'debtPayments'],
    ['Zelle payment to Tom Becker JPM99K1L2M3N', 'other'],
    ['VENMO *Jake Morris Visa Direct NY', 'other'],
    ['ATM WITHDRAWAL 001234 10/03 5500 GREENVILLE AVE', 'other'],
    ['TARGET 00012345 DALLAS TX', 'other'],
    ['AMAZON MKTPL*2B7XY1QZ0 Amzn.com/bill WA', 'other'],
    ['Online Transfer to SAV ...4821 transaction#: 45446467599', 'transfer'],
    ['VANGUARD BUY INVESTMENT', 'transfer'],
  ])('%s → %s', (raw, cls) => {
    expect(out(raw).cls).toBe(cls);
  });

  it('matches whole words only', () => {
    expect(out('CURRENT COFFEE ROASTERS').cls).toBe('eatingOut'); // not "rent"
    expect(out('CHEVROLET OF DALLAS SERVICE').cls).toBe('other'); // not "vet"
    expect(out('CHEVROLET OF DALLAS SERVICE').oneOffHint).toBe(false);
    expect(out('SHELLS SEAFOOD MARKET').cls).toBe('other'); // not "shell"
  });

  it('hints merchants that are usually one-off or yearly', () => {
    expect(out('DFW ANIMAL HOSPITAL DALLAS TX')).toEqual({ cls: 'other', oneOffHint: true });
    expect(out('AMAZON PRIME*2K4LM8 Amzn.com/bill WA')).toEqual({ cls: 'subscriptions', oneOffHint: true });
    expect(out('SOUTHWEST AIRLINES 5262')).toEqual({ cls: 'other', oneOffHint: true });
    expect(out('KROGER #0573').oneOffHint).toBe(false);
  });
});

describe('ruleClass: money in', () => {
  it.each([
    ['ACME LOGISTICS INC PAYROLL PPD ID: 9111111101', 'pay'],
    ['ACME CORP DES:PAYROLL ID:XXXXX12345 INDN:JOHN A DOE CO ID:1234567890 PPD', 'pay'],
    ['GUSTO PAY 123456', 'pay'],
    ['DIRECT DEP ACME', 'pay'],
    ['AMAZON.COM REFUND RT4KX81B2', 'other'],
    ['UBER EATS REFUND', 'eatingOut'],
    ['KROGER RETURN', 'groceries'],
    ['Zelle payment from Daniel Kim WFCT0QX8PL2M', 'transfer'],
    ['VENMO PAYMENT 1038492751 FROM PRIYA SHAH WEB ID: 3264681992', 'transfer'],
    ['INTERNET PAYMENT - THANK YOU', 'transfer'],
    ['INTEREST PAYMENT', 'transfer'],
    ['Online Transfer from CHK ...1234', 'transfer'],
  ])('%s → %s', (raw, cls) => {
    expect(inn(raw)).toEqual({ cls, oneOffHint: false });
  });
});
