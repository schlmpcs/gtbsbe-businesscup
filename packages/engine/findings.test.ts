// JF7: findIncomeAndDebts on small statements written out here. Every expected number is worked out
// by hand in the test that uses it. The masked labels are written the way lib/statement/mask.ts
// writes them (the engine cannot import browser code). The golden run on the sample statement and
// the 50 synthetic households, through the real reader and mask, is in
// apps/web/src/lib/statement/findingsGolden.test.ts.
import { StatementFindingsSchema } from '@lifeguessr/types';
import { describe, expect, it } from 'vitest';
import { debtAprByKind, debtAprDefaults } from './assumptions';
import { detectStatementFindings, findIncomeAndDebts, nameFromLabel, type FindingLine } from './findings';
import { lenderOf } from './lenders';

// ----- helpers ---------------------------------------------------------------------------------

/** A line whose masked label is the raw text (true for most merchant and payroll lines). */
const line = (date: string, amount: number, text: string, label = text): FindingLine => ({ date, amount, text, label });
const deposit = (date: string, amount: number, text = 'ACME LOGISTICS INC PAYROLL PPD ID: 9111111101') =>
  line(date, -amount, text, text.replace(/\d{4,}/g, '#'));
const paid = (date: string, amount: number, text: string, label = text) => line(date, amount, text, label);
/** Statement edges, so the "full months" and "still current" rules see a whole statement. */
const edges = (from: string, to: string) => [paid(from, 4.5, 'STARBUCKS STORE 123'), paid(to, 4.5, 'STARBUCKS STORE 123')];

/** Dates `step` days apart from `from` (YYYY-MM-DD), `count` of them. */
function every(from: string, step: number, count: number): string[] {
  const start = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  return Array.from({ length: count }, (_, i) => new Date(start + i * step * 86_400_000).toISOString().slice(0, 10));
}

// ----- income ----------------------------------------------------------------------------------

describe('findIncomeAndDebts: paychecks', () => {
  it('a biweekly paycheck is $2,400 × 26 ÷ 12 = $5,200 a month, however many paydays a month has', () => {
    // Jul 3 … Nov 6: July has three paydays (3, 17, 31), which must not inflate the monthly figure.
    const lines = [...every('2026-07-03', 14, 10).map((d) => deposit(d, 2400)), ...edges('2026-07-01', '2026-11-12')];
    const { income } = findIncomeAndDebts(lines);
    expect(income).toEqual([
      { id: 'income-1', payer: 'Acme Logistics Inc', payroll: true, cadence: 'biweekly', deposits: 10, perDeposit: 2400, monthly: 5200 },
    ]);
  });

  it('tells semimonthly (the 15th and the last business day) from biweekly: $3,000 × 24 ÷ 12 = $6,000', () => {
    // Aug 15 is a Saturday and Oct 31 a Saturday: those post on the Friday before.
    const dates = ['2026-07-15', '2026-07-31', '2026-08-14', '2026-08-31', '2026-09-15', '2026-09-30', '2026-10-15', '2026-10-30'];
    const lines = [...dates.map((d) => deposit(d, 3000, 'HUDSON YARD CAPITAL LP DES:DIR DEP ID:X1Y2Z3 INDN:SMITH, ANN CO ID:123 PPD')), ...edges('2026-07-01', '2026-11-09')];
    const [found] = findIncomeAndDebts(lines).income;
    expect([found!.cadence, found!.monthly, found!.payer]).toEqual(['semimonthly', 6000, 'Hudson Yard Capital LP']);
  });

  it('weekly hourly pay uses the typical (median) paycheck: median $600 × 52 ÷ 12 = $2,600', () => {
    const amounts = [580, 600, 620, 600, 590, 610, 600, 600, 605, 600, 595, 600, 900]; // one week of overtime
    const lines = [...every('2026-08-07', 7, 13).map((d, i) => deposit(d, amounts[i]!, 'Broadway Outfitters INC Dir Dep')), ...edges('2026-08-01', '2026-11-03')];
    const [found] = findIncomeAndDebts(lines).income;
    expect([found!.cadence, found!.perDeposit, found!.monthly]).toEqual(['weekly', 600, 2600]);
  });

  it('a monthly teacher paycheck: $3,537.08 × 12 ÷ 12', () => {
    const dates = ['2026-07-31', '2026-08-31', '2026-09-30', '2026-10-30'];
    const lines = [...dates.map((d) => deposit(d, 3537.08, 'ACH DEPOSIT SALT RIVER ELEM SCHOOL DIST PAYROLL')), ...edges('2026-07-01', '2026-11-05')];
    const [found] = findIncomeAndDebts(lines).income;
    expect([found!.cadence, found!.monthly, found!.payer]).toEqual(['monthly', 3537.08, 'Salt River Elem School Dist']);
  });

  it('two earners are two findings, largest first', () => {
    const lines = [
      ...every('2026-08-07', 14, 7).map((d) => deposit(d, 2000, 'WINDY CITY LOGISTICS INC DIRECT DEP PPD ID: 55555')),
      ...['2026-08-14', '2026-08-31', '2026-09-15', '2026-09-30', '2026-10-15', '2026-10-30'].map((d) => deposit(d, 2500, 'NORTH BRANCH CHARTER SCHOOLS DIR DEP PPD ID: 66666')),
      ...edges('2026-08-01', '2026-11-10'),
    ];
    const { income } = findIncomeAndDebts(lines);
    // 2,000 × 26 / 12 = 4,333.33…, rounded to the cent; 2,500 × 24 / 12 = 5,000.
    expect(income.map((i) => [i.id, i.payer, i.monthly])).toEqual([
      ['income-1', 'North Branch Charter Schools', 5000],
      ['income-2', 'Windy City Logistics Inc', 4333.33],
    ]);
  });

  it('is not fooled by regular money in that is not pay', () => {
    const lines = [
      // a roommate's rent share, a monthly move from savings, interest, a card's "thank you" credit, cash deposits
      ...every('2026-08-01', 14, 7).map((d) => line(d, -600, 'Zelle payment from Dana Lee WFCT0QX8PL2M', 'Zelle from [name]')),
      ...['2026-08-03', '2026-09-03', '2026-10-03', '2026-11-03'].map((d) => line(d, -500, 'Online Transfer from SAV ...4321', 'Transfer from savings')),
      ...['2026-08-31', '2026-09-30', '2026-10-31'].map((d) => line(d, -1.12, 'Interest Paid')),
      ...['2026-08-05', '2026-09-05', '2026-10-05'].map((d) => line(d, -300, 'AUTOMATIC PAYMENT - THANK YOU')),
      ...every('2026-08-02', 7, 12).map((d) => line(d, -180, 'Cash Deposit - Walgreens')),
      ...edges('2026-08-01', '2026-11-10'),
    ];
    expect(findIncomeAndDebts(lines).income).toEqual([]);
  });

  it('a job that ended mid-statement is not today’s pay; a new job that started is', () => {
    const lines = [
      ...every('2026-07-03', 14, 4).map((d) => deposit(d, 2000, 'OLD CO PAYROLL PPD ID: 1111')), // last on Aug 14
      ...every('2026-09-11', 14, 5).map((d) => deposit(d, 2600, 'NEW CO PAYROLL PPD ID: 2222')),
      ...edges('2026-07-01', '2026-11-12'),
    ];
    expect(findIncomeAndDebts(lines).income.map((i) => i.payer)).toEqual(['New Co']);
  });

  it('needs three deposits on one schedule', () => {
    const two = [deposit('2026-10-09', 2400), deposit('2026-10-23', 2400), ...edges('2026-10-01', '2026-10-30')];
    expect(findIncomeAndDebts(two).income).toEqual([]);
    const irregular = ['2026-08-02', '2026-08-19', '2026-09-30', '2026-10-04', '2026-11-01'].map((d) => deposit(d, 900, 'ASTERWOOD BRANDS INC ACH PMT'));
    expect(findIncomeAndDebts([...irregular, ...edges('2026-08-01', '2026-11-05')]).income).toEqual([]);
  });

  it('a payroll deposit whose label the mask emptied is kept, with no payer name', () => {
    const lines = [
      ...every('2026-08-07', 14, 6).map((d) => line(d, -1800, 'ACH CREDIT ACME PAYROLL 445566', 'ACH credit [name]')),
      ...edges('2026-08-01', '2026-10-31'),
    ];
    const [found] = findIncomeAndDebts(lines).income;
    expect([found!.payer, found!.payroll, found!.cadence]).toEqual([null, true, 'biweekly']);
  });
});

// ----- debts -----------------------------------------------------------------------------------

describe('findIncomeAndDebts: debts', () => {
  const months = ['2026-07', '2026-08', '2026-09', '2026-10'];

  it('finds a card and a car loan, with the measured payment and the kind’s APR and source', () => {
    const lines = [
      ...months.map((m) => paid(`${m}-20`, 250, `CAPITAL ONE MOBILE PMT ${m.replace('-', '')} WEB ID: 9279744991`, 'CAPITAL ONE MOBILE PMT # WEB ID: #')),
      ...months.map((m) => paid(`${m}-15`, 412, 'TOYOTA FINANCIAL ONLINE PMT PPD ID: 1953223322', 'TOYOTA FINANCIAL ONLINE PMT PPD ID: #')),
      ...edges('2026-07-01', '2026-11-12'),
    ];
    const { debts } = findIncomeAndDebts(lines);
    expect(debts).toEqual([
      { id: 'debt-1', kind: 'auto', creditor: 'Toyota Financial', payments: 4, monthlyPayment: 412, apr: debtAprByKind.auto.value, aprSource: debtAprByKind.auto.source },
      { id: 'debt-2', kind: 'card', creditor: 'Capital One', payments: 4, monthlyPayment: 250, apr: debtAprByKind.card.value, aprSource: debtAprByKind.card.source },
    ]);
    expect(StatementFindingsSchema.safeParse(findIncomeAndDebts(lines)).success).toBe(true);
  });

  it('a card’s payments vary: the average over the full months it spans (Aug–Oct: 277.39 + 373.62 + 260.04 = 911.05 ÷ 3)', () => {
    const lines = [
      paid('2026-08-12', 277.39, 'APPLECARD GSBANK PAYMENT WEB ID: 6901236969'),
      paid('2026-09-14', 373.62, 'APPLECARD GSBANK PAYMENT WEB ID: 6901236969'),
      paid('2026-10-13', 260.04, 'APPLECARD GSBANK PAYMENT WEB ID: 6901236969'),
      ...edges('2026-08-01', '2026-11-05'),
    ];
    const [card] = findIncomeAndDebts(lines).debts;
    expect([card!.creditor, card!.kind, card!.monthlyPayment]).toEqual(['Apple Card', 'card', 303.68]);
  });

  it('two car loans with one lender are two debts, told apart by their payment', () => {
    const lines = [
      ...months.slice(1).flatMap((m) => [
        paid(`${m}-03`, 441, 'CAPITAL ONE AUTO DES:CARPAY ID:J1GHJG8E6 INDN:FLEMING, JAMES CO ID:7145336635 WEB'),
        paid(`${m}-04`, 318, 'CAPITAL ONE AUTO DES:CARPAY ID:J2AB84D9K INDN:FLEMING, JAMES CO ID:7145336635 WEB'),
      ]),
      ...edges('2026-08-01', '2026-11-12'),
    ];
    expect(findIncomeAndDebts(lines).debts.map((d) => [d.creditor, d.kind, d.monthlyPayment])).toEqual([
      ['Capital One Auto', 'auto', 441],
      ['Capital One Auto', 'auto', 318],
    ]);
  });

  it('reads the lender behind a masked "ACH debit [name]" line and shows only the name from the list', () => {
    const lines = [
      ...months.slice(1).map((m) => paid(`${m}-05`, 2936, 'ACH DEBIT ROCKET MORTGAGE MTG PYMT 0042 OMAR MURPHY', 'ACH debit [name]')),
      ...edges('2026-08-01', '2026-10-31'),
    ];
    const detail = detectStatementFindings(lines);
    expect(detail.findings.debts.map((d) => [d.kind, d.creditor, d.monthlyPayment])).toEqual([['mortgage', 'Rocket Mortgage', 2936]]);
    expect(JSON.stringify(detail.findings)).not.toMatch(/OMAR|MURPHY|0042/);
  });

  it('a lender we don’t list is found by its words, named from the masked label', () => {
    const lines = [
      ...months.slice(1).map((m) => paid(`${m}-01`, 1850, 'LAKESIDE CU MORTGAGE PMT 88123', 'LAKESIDE CU MORTGAGE PMT #')),
      ...edges('2026-08-01', '2026-10-31'),
    ];
    expect(findIncomeAndDebts(lines).debts.map((d) => [d.kind, d.creditor])).toEqual([['mortgage', 'Lakeside CU Mortgage']]);
  });

  it('a BNPL account is one debt per company; a plan finished long before the statement ends is not a debt', () => {
    const lines = [
      ...every('2026-08-05', 14, 4).map((d) => paid(d, 25, 'Afterpay')), // last on Sep 16
      ...every('2026-09-29', 14, 4).map((d, i) => paid(d, i < 2 ? 40 : 35, 'POS PURCHASE KLARNA* WALMART.COM 8 OH')),
      ...edges('2026-08-01', '2026-11-12'),
    ];
    // Klarna, Sep 29 – Nov 10. November is not a full month of statement (it ends on the 12th), so the
    // average is over Sep (40) and Oct (40 + 35): 115 ÷ 2 = 57.50.
    expect(findIncomeAndDebts(lines).debts.map((d) => [d.creditor, d.kind, d.monthlyPayment, d.apr])).toEqual([['Klarna', 'bnpl', 57.5, 0]]);
  });

  it('is not fooled by people, own accounts, purchases at a dealer or utility autopay', () => {
    const lines = [
      ...months.map((m) => paid(`${m}-02`, 300, 'Zelle payment to Ally Chen JPM99K1L2M3N', 'Zelle to [name]')),
      ...months.map((m) => paid(`${m}-03`, 500, 'Online Transfer to CHASE SAV ...1234', 'Transfer to savings')),
      ...months.map((m) => paid(`${m}-09`, 89, 'TOYOTA OF DALLAS SERVICE DEPT', 'TOYOTA OF DALLAS SERVICE DEPT')),
      ...months.map((m) => paid(`${m}-11`, 38.09, 'ATMOS ENERGY AUTO PMT PPD ID: 7750000000', 'ATMOS ENERGY AUTO PMT PPD ID: #')),
      ...months.map((m) => paid(`${m}-14`, 60, 'ATM WITHDRAWAL CHASE CARD 1234', 'ATM WITHDRAWAL CHASE CARD #')),
      ...edges('2026-07-01', '2026-11-12'),
    ];
    expect(findIncomeAndDebts(lines).debts).toEqual([]);
  });

  it('needs two payments to one lender', () => {
    const lines = [paid('2026-10-15', 412, 'TOYOTA FINANCIAL ONLINE PMT'), ...edges('2026-10-01', '2026-10-30')];
    expect(findIncomeAndDebts(lines).debts).toEqual([]);
  });
});

describe('findIncomeAndDebts: shape', () => {
  it('is empty for an empty statement, and the same on every run', () => {
    expect(findIncomeAndDebts([])).toEqual({ income: [], debts: [] });
    const lines = [...every('2026-07-03', 14, 8).map((d) => deposit(d, 2400)), ...months2('TOYOTA FINANCIAL ONLINE PMT', 412)];
    expect(findIncomeAndDebts(lines)).toEqual(findIncomeAndDebts([...lines].reverse()));
  });

  it('lists the input lines behind each finding', () => {
    const lines = [deposit('2026-08-07', 2000), paid('2026-08-08', 4, 'COFFEE'), deposit('2026-08-21', 2000), deposit('2026-09-04', 2000)];
    expect(detectStatementFindings(lines).lines).toEqual({ 'income-1': [0, 2, 3] });
  });
});

function months2(text: string, amount: number): FindingLine[] {
  return ['2026-07-15', '2026-08-15', '2026-09-15', '2026-10-15'].map((d) => paid(d, amount, text));
}

// ----- names and lenders -------------------------------------------------------------------------

describe('nameFromLabel', () => {
  it.each([
    ['ACME LOGISTICS INC PAYROLL PPD ID: #', 'Acme Logistics Inc'],
    ['ACH DEPOSIT KATY ISD PAYROLL PAYROLL', 'Katy ISD'],
    ['ALLEN PARKWAY ENERGY LLC DES:DIR DEP ID:[ref] INDN:[name] CO ID:# PPD', 'Allen Parkway Energy LLC'],
    ['ACH DEPOSIT DFAS-CLEVELAND MIL PAY', 'DFAS-Cleveland'],
    ['Biscayne Bay Hotels LLC Dir Dep', 'Biscayne Bay Hotels LLC'],
    ['Zelle from [name]', null],
    ['ACH credit [name]', null],
    ['Transfer from savings', null],
  ])('%s → %s', (label, name) => {
    expect(nameFromLabel(label)).toBe(name);
  });
});

describe('lenderOf', () => {
  it.each([
    ['CAPITAL ONE AUTO CARPAY WEB ID: 1', 'auto', 'Capital One Auto'],
    ['CAPITAL ONE MOBILE PMT 261020 WEB ID: 9279744991', 'card', 'Capital One'],
    ['WF CREDIT CARD AUTO PAY WEB ID: 6474634377', 'card', 'Wells Fargo'],
    ['CHASE CREDIT CRD AUTOPAY WEB ID: 1', 'card', 'Chase'],
    ['ACH DEBIT AIDVANTAGE DEPT ED PMT', 'student', 'Aidvantage'],
    ['DEPT EDUCATION STUDENT LN WEB ID: 1', 'student', 'Dept. of Education'],
    ['BMW FINANCIAL SVCS DES:LEASE PMT ID:X', 'auto', 'BMW Financial Services'],
    ['US BANK HOME MTG MTG PAYMT WEB ID: 1', 'mortgage', 'U.S. Bank Home Mortgage'],
    ['UPSTART NETWORK LOAN PMT WEB ID: 1', 'personal', 'Upstart'],
    ['CHECKCARD 1104 KLARNA* SHEIN 123 OH 9', 'bnpl', 'Klarna'],
  ])('%s → %s (%s)', (text, kind, name) => {
    expect(lenderOf(text)).toMatchObject({ kind, name });
  });

  it.each(['TOYOTA OF DALLAS SERVICE DEPT', 'COMCAST AUTO PMT', 'TARGET 1234 DALLAS TX', 'CHASE BANK ATM FEE', 'APPLE.COM/BILL'])('%s → none', (text) => {
    expect(lenderOf(text)).toBeNull();
  });
});

describe('debtAprByKind', () => {
  it('cites a source for every kind, and debtAprDefaults is the same rates', () => {
    for (const [kind, a] of Object.entries(debtAprByKind)) {
      expect(a.source.name, kind).not.toBe('');
      expect(a.value).toBeGreaterThanOrEqual(0);
      expect(a.value).toBeLessThan(1);
      expect(debtAprDefaults.value[kind as keyof typeof debtAprDefaults.value]).toBe(a.value);
    }
  });
});
