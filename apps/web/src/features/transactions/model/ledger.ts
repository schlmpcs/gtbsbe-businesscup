// Pure reads of the ledger (the Transactions-page lines) shared by Transactions, Cash Flow, Budget,
// Dashboard and Recurring. Sums and filters only: no model, no clock.
//
// MP11b: the period sums (`ledgerSummary`) and the Sankey move to the engine's `cashFlowSummary` (MP9);
// until it lands these helpers stand in for it with the same output shape (CashFlowSummary).
import { COST_CATEGORIES, type CashFlowPeriod, type CashFlowSummary, type CostCategory, type LedgerTransaction, type Money, type StatementClass } from '@lifeguessr/types';

/** A spending category (everything but pay and transfers). */
export const isCostClass = (cls: StatementClass): cls is CostCategory => cls !== 'pay' && cls !== 'transfer';

/** Pay in (money in from the `pay` class). */
export const incomeOf = (t: LedgerTransaction): Money => (t.cls === 'pay' ? t.amount : 0);
/** Money out of a spending category, net of refunds (a refund is money in, so it reduces spending). */
export const spendingOf = (t: LedgerTransaction): Money => (isCostClass(t.cls) ? -t.amount : 0);

export const monthOf = (t: LedgerTransaction): string => t.date.slice(0, 7);
export const inPeriod = (t: LedgerTransaction, p: CashFlowPeriod): boolean => {
  const m = monthOf(t);
  return m >= p.from && m <= p.to;
};

/** Newest first: by date, then id (so the order is stable). */
export const newestFirst = (a: LedgerTransaction, b: LedgerTransaction): number =>
  a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? 1 : a.id > b.id ? -1 : 0;

/** Spending per category over `period`; categories without spending are left out. Largest first. */
export function spendingByCategory(txs: readonly LedgerTransaction[], period: CashFlowPeriod): { category: CostCategory; amount: Money }[] {
  const sums = new Map<CostCategory, Money>();
  for (const t of txs) if (inPeriod(t, period) && isCostClass(t.cls)) sums.set(t.cls, (sums.get(t.cls) ?? 0) + spendingOf(t));
  return COST_CATEGORIES.filter((c) => (sums.get(c) ?? 0) > 0)
    .map((category) => ({ category, amount: sums.get(category)! }))
    .sort((a, b) => b.amount - a.amount || (a.category < b.category ? -1 : 1));
}

/** The Sankey of a period: income → "total" → each category (and → savings when income is left over). */
export function sankeyOf(income: Money, byCategory: CashFlowSummary['byCategory'], savings: Money): CashFlowSummary['sankey'] {
  const nodes: CashFlowSummary['sankey']['nodes'] = [{ id: 'income', kind: 'income' }, { id: 'total', kind: 'total' }];
  const links: CashFlowSummary['sankey']['links'] = [];
  if (income > 0) links.push({ source: 'income', target: 'total', value: income });
  for (const { category, amount } of byCategory) {
    nodes.push({ id: category, kind: 'category' });
    links.push({ source: 'total', target: category, value: amount });
  }
  if (savings > 0) {
    nodes.push({ id: 'savings', kind: 'savings' });
    links.push({ source: 'total', target: 'savings', value: savings });
  }
  return { nodes, links };
}

/** Income, expenses, savings and the category split of a period, in the CashFlowSummary shape. */
export function ledgerSummary(txs: readonly LedgerTransaction[], period: CashFlowPeriod): CashFlowSummary {
  let income = 0;
  let expenses = 0;
  for (const t of txs) {
    if (!inPeriod(t, period)) continue;
    income += incomeOf(t);
    expenses += spendingOf(t);
  }
  const savings = income - expenses;
  const byCategory = spendingByCategory(txs, period);
  return { period, income, expenses, savings, savingsRate: income > 0 ? savings / income : null, byCategory, sankey: sankeyOf(income, byCategory, savings) };
}
