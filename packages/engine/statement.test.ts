import { COST_CATEGORIES, CategoryTotalsSchema, type CostCategory, type StatementClass } from '@lifeguessr/types';
import { describe, expect, it } from 'vitest';
import { merchantKey, statementTotals, type ClassifiedStatementItem } from './statement';

const line = (
  month: string, label: string, amount: number, cls: StatementClass, oneOffHint = false, day = 5,
): ClassifiedStatementItem => ({ month, day, label, amount, cls, oneOffHint });

const zeros = (over: Partial<Record<CostCategory, number>> = {}) =>
  Object.fromEntries(COST_CATEGORIES.map((c) => [c, over[c] ?? 0]));

describe('statementTotals', () => {
  it('sums money out per category and month, in exact cents, oldest month first', () => {
    const out = statementTotals([
      line('2026-10', 'KROGER #', 0.1, 'groceries'),
      line('2026-10', 'KROGER #', 0.2, 'groceries'),
      line('2026-09', 'KROGER #', 100.05, 'groceries'),
      line('2026-10', 'NETFLIX.COM', 17.99, 'subscriptions'),
    ]);
    expect(out.map((m) => m.month)).toEqual(['2026-09', '2026-10']);
    expect(out[1]!.totals).toEqual(zeros({ groceries: 0.3, subscriptions: 17.99 }));
    expect(out[0]!.totals.groceries).toBe(100.05);
    for (const m of out) expect(CategoryTotalsSchema.safeParse(m).success).toBe(true);
  });

  it('turns pay deposits into detectedPay and leaves transfers out', () => {
    const [m] = statementTotals([
      line('2026-10', 'ACME PAYROLL PPD ID: #', -2400, 'pay'),
      line('2026-10', 'ACME PAYROLL PPD ID: #', -2400, 'pay'),
      line('2026-10', 'Transfer to savings', 200, 'transfer'),
      line('2026-10', 'Zelle payment from [name]', -45, 'transfer'),
      line('2026-10', 'ALDI #', 80, 'groceries'),
    ]);
    expect(m!.detectedPay).toBe(4800);
    expect(m!.totals).toEqual(zeros({ groceries: 80 }));
  });

  it('omits detectedPay when no pay came in', () => {
    const [m] = statementTotals([line('2026-10', 'ALDI #', 80, 'groceries')]);
    expect(m).not.toHaveProperty('detectedPay');
  });

  it('nets refunds against their category, never below zero', () => {
    const [m] = statementTotals([
      line('2026-10', 'TARGET #', 120, 'other'),
      line('2026-10', 'TARGET # REFUND', -20, 'other'),
      line('2026-10', 'UBER EATS REFUND', -15, 'eatingOut'),
    ]);
    expect(m!.totals.other).toBe(100);
    expect(m!.totals.eatingOut).toBe(0);
  });

  it("counts money out sorted as 'pay' as other spending, and skips zero lines", () => {
    const [m] = statementTotals([line('2026-10', 'ODD', 30, 'pay'), line('2026-10', 'ZERO', 0, 'groceries')]);
    expect(m!.totals).toEqual(zeros({ other: 30 }));
    expect(m).not.toHaveProperty('detectedPay');
  });

  describe('one-offs', () => {
    const months = ['2026-08', '2026-09', '2026-10'];
    const everyMonth = months.flatMap((mo) => [
      line(mo, 'CVS/PHARMACY #', 30, 'other'),
      line(mo, 'TARGET #', 50, 'other'),
      line(mo, 'OAKWOOD APTS', 1720, 'rentUtilities'),
    ]);

    it('leaves a hinted merchant seen in one month out of the totals and lists it', () => {
      const out = statementTotals([...everyMonth, line('2026-09', 'DFW ANIMAL HOSPITAL', 642.8, 'other', true)]);
      const sep = out.find((m) => m.month === '2026-09')!;
      expect(sep.oneOffs).toEqual([{ label: 'DFW ANIMAL HOSPITAL', amount: 642.8 }]);
      expect(sep.totals.other).toBe(80);
    });

    it('flags a large outlier for its category without a hint', () => {
      const out = statementTotals([...everyMonth, line('2026-10', 'BEST BUY #', 900, 'other')]);
      expect(out[2]!.oneOffs).toEqual([{ label: 'BEST BUY #', amount: 900 }]);
      expect(out[2]!.totals.other).toBe(80);
    });

    it('keeps small hinted charges, recurring merchants and recurring-by-nature categories', () => {
      const out = statementTotals([
        ...everyMonth,
        line('2026-10', 'MUSEUM GIFT SHOP', 20, 'other', true),            // under the hint minimum
        ...months.map((mo) => line(mo, 'SOUTHWEST AIR', 450, 'other', true)), // recurs every month
        line('2026-10', 'BRIGHT HORIZONS DAYCARE', 2400, 'childcare', true), // never a one-off
        line('2026-10', 'TOYOTA FINANCIAL', 5000, 'debtPayments'),
      ]);
      expect(out.flatMap((m) => m.oneOffs)).toEqual([]);
      expect(out[2]!.totals.childcare).toBe(2400);
    });

    it('treats nothing as a one-off in a single-month statement (recurrence is unknown)', () => {
      const [m] = statementTotals([line('2026-10', 'DFW ANIMAL HOSPITAL', 642.8, 'other', true)]);
      expect(m!.oneOffs).toEqual([]);
      expect(m!.totals.other).toBe(642.8);
    });

    it('matches the merchant across months despite store numbers and masked ids', () => {
      const out = statementTotals([
        line('2026-09', 'BEST BUY [ref] #1234', 900, 'other'),
        line('2026-10', 'BEST BUY [ref] #5678', 900, 'other'),
        line('2026-10', 'CVS', 10, 'other'),
      ]);
      expect(out.flatMap((m) => m.oneOffs)).toEqual([]);
    });
  });
});

describe('merchantKey', () => {
  it('drops masks, digits and punctuation', () => {
    expect(merchantKey('TXU ENERGY WEB PMT # WEB ID: #')).toBe('TXU ENERGY WEB PMT WEB ID');
    expect(merchantKey('Zelle payment to [name]')).toBe('ZELLE PAYMENT TO');
    expect(merchantKey('Amazon Mktpl*[ref] Amzn.com/bill')).toBe('AMAZON MKTPL AMZN COM BILL');
  });
});
