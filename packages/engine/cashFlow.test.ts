// MP9 (#169): cashFlowSummary. Hand-checked numbers next to each case.
import { statementItemsSample } from '@lifeguessr/data/fixtures/tools';
import {
  CashFlowSummarySchema, COST_CATEGORIES, type CashFlowSummary, type CategoryTotals, type CostCategory, type Money,
  type StatementClass,
} from '@lifeguessr/types';
import { describe, expect, it } from 'vitest';
import { cashFlowSummary } from './cashFlow';
import { statementTotals, type ClassifiedStatementItem } from './statement';

const cents = (dollars: Money) => Math.round(dollars * 100);

/** Σ in − Σ out per Sankey node, in whole cents (0 everywhere = the flows balance exactly). */
function imbalance(s: CashFlowSummary): Record<string, number> {
  const net: Record<string, number> = {};
  for (const l of s.sankey.links) {
    net[l.source] = (net[l.source] ?? 0) - cents(l.value);
    net[l.target] = (net[l.target] ?? 0) + cents(l.value);
  }
  return net;
}

// statement.sample.csv as the browser sends it (statementItemsSample), sorted by merchant the way the
// keyword rules sort it, then summed by the engine (statementTotals). The Prime renewal and the vet
// bill carry the categorizer's one-off hint.
const RULES: [prefix: string, cls: StatementClass][] = [
  ['ACME LOGISTICS INC PAYROLL', 'pay'],
  ['Transfer to savings', 'transfer'], ['Zelle from', 'transfer'], ['Venmo from', 'transfer'],
  ['OAKWOOD APTS', 'rentUtilities'], ['TXU ENERGY', 'rentUtilities'], ['ATMOS ENERGY', 'rentUtilities'], ['SPECTRUM', 'rentUtilities'],
  ['EXXON', 'car'], ['SHELL OIL', 'car'], ['QT ', 'car'], ['PROGRESSIVE', 'car'],
  ['TOM THUMB', 'groceries'], ['ALDI', 'groceries'], ['KROGER', 'groceries'], ['WALMART SUPERCENTER', 'groceries'],
  ['WHATABURGER', 'eatingOut'], ['TACO BELL', 'eatingOut'], ['STARBUCKS', 'eatingOut'], ['UBER *EATS', 'eatingOut'],
  ['DOORDASH', 'eatingOut'], ['CHIPOTLE', 'eatingOut'], ['HOPDODDY', 'eatingOut'],
  ['SPOTIFY', 'subscriptions'], ['NETFLIX', 'subscriptions'], ['APPLE.COM/BILL', 'subscriptions'], ['PLANET FITNESS', 'subscriptions'],
  ['TOYOTA FINANCIAL', 'debtPayments'], ['CAPITAL ONE', 'debtPayments'],
  ['AMAZON PRIME', 'other'], ['DFW ANIMAL HOSPITAL', 'other'],
  ['TARGET', 'other'], ['CVS', 'other'], ['AMAZON MKTPL', 'other'], ['THE HOME DEPOT', 'other'],
  ['ATM WITHDRAWAL', 'other'], ['Zelle to', 'other'], ['Venmo [name]', 'other'],
];
const sampleTotals = (): CategoryTotals[] => statementTotals(statementItemsSample.map((i): ClassifiedStatementItem => {
  const rule = RULES.find(([prefix]) => i.label.startsWith(prefix));
  if (!rule) throw new Error(`Unsorted sample line: ${i.label}`);
  return { ...i, cls: rule[1], oneOffHint: /^(AMAZON PRIME|DFW ANIMAL HOSPITAL)/.test(i.label) };
}));

describe('cashFlowSummary', () => {
  it('on the statement.sample.csv totals (Jul–Oct 2026): savings = income − expenses to the cent; every Sankey node balances', () => {
    const s = cashFlowSummary(sampleTotals(), { from: '2026-07', to: '2026-10' }); // November (partial) is outside
    expect(CashFlowSummarySchema.safeParse(s).success).toBe(true);

    // Income: 9 paychecks of $2,400 (3 in July, 2 a month after) = 21,600.
    expect(s.income).toBe(21_600);
    // Per category, Jul + Aug + Sep + Oct (the same months as statementTotals.sample.json):
    //   rentUtilities 1,959.36 + 1,962.04 + 1,981.08 + 1,955.37 = 7,857.85
    //   debtPayments  662 × 4                                   = 2,648.00
    //   groceries       530.96 +   467.63 +   569.56 +   509.26 = 2,077.41
    //   car             274.99 +   298.84 +   269.13 +   287.18 = 1,130.14
    //   eatingOut       280.30 +   282.99 +   251.96 +   227.67 = 1,042.92
    //   other           240.83 +   121.26 +   196.39 +   248.57 =   807.05
    //   subscriptions    57.96 × 4                              =   231.84
    //   childcare                                               =     0
    //   Σ = 15,795.21
    expect(s.byCategory).toEqual([
      { category: 'rentUtilities', amount: 7_857.85 },
      { category: 'debtPayments', amount: 2_648 },
      { category: 'groceries', amount: 2_077.41 },
      { category: 'car', amount: 1_130.14 },
      { category: 'eatingOut', amount: 1_042.92 },
      { category: 'other', amount: 807.05 },
      { category: 'subscriptions', amount: 231.84 },
    ]);
    // One-offs: the Prime renewal (Aug, 139.00) + the vet bill (Sep, 642.80) = 781.80.
    // Expenses = 15,795.21 + 781.80 = 16,577.01. Savings = 21,600 − 16,577.01 = 5,022.99.
    expect(s.expenses).toBe(16_577.01);
    expect(s.savings).toBe(5_022.99);
    expect(cents(s.savings)).toBe(cents(s.income) - cents(s.expenses));
    expect(s.savingsRate).toBeCloseTo(5_022.99 / 21_600, 12); // ≈ 0.2325

    // Sankey: 2% of expenses = 331.54. Subscriptions (231.84) is under it, so it is drawn inside
    // Other: 807.05 + 231.84 = 1,038.89. Out of Income: 7,857.85 + 2,648 + 2,077.41 + 1,130.14 +
    // 1,042.92 + 1,038.89 + 781.80 (one-offs) + 5,022.99 (savings) = 21,600.00 = into Income.
    expect(s.sankey.links).toEqual([
      { source: 'pay', target: 'income', value: 21_600 },
      { source: 'income', target: 'rentUtilities', value: 7_857.85 },
      { source: 'income', target: 'debtPayments', value: 2_648 },
      { source: 'income', target: 'groceries', value: 2_077.41 },
      { source: 'income', target: 'car', value: 1_130.14 },
      { source: 'income', target: 'eatingOut', value: 1_042.92 },
      { source: 'income', target: 'other', value: 1_038.89 },
      { source: 'income', target: 'oneOffs', value: 781.8 },
      { source: 'income', target: 'savings', value: 5_022.99 },
    ]);
    const net = imbalance(s);
    expect(net.income).toBe(0); // the only node with links both in and out: inflow = outflow, in cents
    expect(-net.pay!).toBe(Object.entries(net).filter(([id]) => id !== 'pay' && id !== 'income').reduce((a, [, v]) => a + v, 0));
    expect(new Set(s.sankey.nodes.map((n) => n.id))).toEqual(new Set(Object.keys(net)));
  });

  it('zero income: savingsRate is null, no crash, and the Sankey still balances', () => {
    const totals = Object.fromEntries(COST_CATEGORIES.map((c) => [c, 0])) as Record<CostCategory, Money>;
    const month: CategoryTotals = { month: '2026-10', totals: { ...totals, groceries: 120.1, eatingOut: 30.2 }, oneOffs: [] };
    const s = cashFlowSummary([month], { from: '2026-10', to: '2026-10' });
    expect(CashFlowSummarySchema.safeParse(s).success).toBe(true);
    // Income 0, expenses 120.10 + 30.20 = 150.30, savings −150.30.
    expect(s).toMatchObject({ income: 0, expenses: 150.3, savings: -150.3, savingsRate: null });
    // The 150.30 spent with nothing coming in is drawn from savings into Income, so Income balances.
    expect(s.sankey.links).toEqual([
      { source: 'fromSavings', target: 'income', value: 150.3 },
      { source: 'income', target: 'groceries', value: 120.1 },
      { source: 'income', target: 'eatingOut', value: 30.2 },
    ]);
    expect(imbalance(s).income).toBe(0);

    const empty = cashFlowSummary([], { from: '2026-10', to: '2026-10' });
    expect(empty).toMatchObject({ income: 0, expenses: 0, savings: 0, savingsRate: null, byCategory: [] });
    expect(empty.sankey).toEqual({ nodes: [], links: [] });
  });
});
