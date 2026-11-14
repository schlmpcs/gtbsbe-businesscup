// Cash flow summary and Sankey data (MP9, #169). Every sum is done in whole cents, like
// statement.ts, so savings = income − expenses to the cent and each Sankey node's inflow equals its
// outflow exactly; dollars are made only at the end (cents / 100).
//
// Over the statement months inside `period` (inclusive; monthly, quarterly or yearly is just the
// choice of `from` and `to`, compared as 'YYYY-MM' strings):
//   income      = Σ detectedPay (take-home pay). CategoryTotals carry no other money in: refunds are
//                 already netted into their category and transfers are left out by statementTotals.
//   expenses    = Σ totals over every category (debt payments included) + Σ one-offs
//   savings     = income − expenses (negative when the period spent more than came in)
//   savingsRate = savings / income; null when income = 0
//   byCategory  = each category with spending > 0, largest first. One-offs have no category, so they
//                 are not in it (Σ byCategory = expenses − one-offs); the Sankey shows them as 'oneOffs'.
// Sankey: 'pay' (kind income) → 'income' (total) → each category > 0 (category), plus 'oneOffs'
// (category) when there are any, plus 'savings' (savings) when savings > 0. A category (or the
// one-offs) under cashFlowSankeyMergeShare of expenses is drawn inside 'other'. When expenses exceed
// income, the gap flows 'fromSavings' (savings) → 'income', so Income still balances.
//
// A month outside YYYY-MM, a period with `from` after `to`, a month listed twice inside the period,
// or a negative or non-finite amount throws a RangeError.
import { COST_CATEGORIES, type CashFlowPeriod, type CashFlowSummary, type CategoryTotals, type CostCategory, type Money } from '@lifeguessr/types';
import { cashFlowSankeyMergeShare } from './assumptions';
import { daysInMonth } from './month';

type SankeyNode = CashFlowSummary['sankey']['nodes'][number];
type SankeyLink = CashFlowSummary['sankey']['links'][number];

const toCents = (dollars: Money) => Math.round(dollars * 100);
const toDollars = (cents: number): Money => cents / 100;

function amountCents(value: Money, what: string): number {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`Invalid ${what}: ${value} (expected a finite amount ≥ 0)`);
  return toCents(value);
}

/** Income, expenses, savings and the Sankey over the statement months inside `period` (inclusive). */
export function cashFlowSummary(totals: readonly CategoryTotals[], period: CashFlowPeriod): CashFlowSummary {
  daysInMonth(period.from); // validates YYYY-MM
  daysInMonth(period.to);
  if (period.from > period.to) throw new RangeError(`Invalid period: ${period.from} is after ${period.to}`);

  const seen = new Set<string>();
  const categoryCents = new Map<CostCategory, number>(COST_CATEGORIES.map((c) => [c, 0]));
  let incomeCents = 0;
  let oneOffCents = 0;
  for (const m of totals) {
    daysInMonth(m.month);
    if (m.month < period.from || m.month > period.to) continue;
    if (seen.has(m.month)) throw new RangeError(`Month ${m.month} is listed twice`);
    seen.add(m.month);
    for (const c of COST_CATEGORIES) categoryCents.set(c, categoryCents.get(c)! + amountCents(m.totals[c] ?? 0, `${c} total for ${m.month}`));
    for (const o of m.oneOffs) oneOffCents += amountCents(o.amount, `one-off amount for ${m.month}`);
    incomeCents += amountCents(m.detectedPay ?? 0, `detectedPay for ${m.month}`);
  }

  // Largest first; ties keep the COST_CATEGORIES order (Array.prototype.sort is stable).
  const spent = COST_CATEGORIES.map((c) => ({ category: c, cents: categoryCents.get(c)! }))
    .filter((x) => x.cents > 0)
    .sort((a, b) => b.cents - a.cents);
  const expensesCents = spent.reduce((s, x) => s + x.cents, 0) + oneOffCents;
  const savingsCents = incomeCents - expensesCents;

  return {
    period: { from: period.from, to: period.to },
    income: toDollars(incomeCents),
    expenses: toDollars(expensesCents),
    savings: toDollars(savingsCents),
    savingsRate: incomeCents === 0 ? null : savingsCents / incomeCents,
    byCategory: spent.map((x) => ({ category: x.category, amount: toDollars(x.cents) })),
    sankey: sankey(spent, oneOffCents, incomeCents, expensesCents, savingsCents),
  };
}

function sankey(
  spent: readonly { category: CostCategory; cents: number }[], oneOffCents: number,
  incomeCents: number, expensesCents: number, savingsCents: number,
): CashFlowSummary['sankey'] {
  if (incomeCents === 0 && expensesCents === 0) return { nodes: [], links: [] };

  // Spending targets: the categories plus the one-offs; the thin ones are merged into 'other'.
  const targets: { id: string; cents: number }[] = spent.map((x) => ({ id: x.category, cents: x.cents }));
  if (oneOffCents > 0) targets.push({ id: 'oneOffs', cents: oneOffCents });
  const isThin = (t: { id: string; cents: number }) => t.id !== 'other' && t.cents < cashFlowSankeyMergeShare.value * expensesCents;
  const mergedCents = targets.filter(isThin).reduce((s, t) => s + t.cents, 0);
  const drawn = targets.filter((t) => !isThin(t) && t.id !== 'other');
  const otherCents = (targets.find((t) => t.id === 'other')?.cents ?? 0) + mergedCents;
  if (otherCents > 0) drawn.push({ id: 'other', cents: otherCents });
  // Largest first; ties keep the order above (categories, then one-offs, then other).
  drawn.sort((a, b) => b.cents - a.cents);

  const nodes: SankeyNode[] = [];
  const links: SankeyLink[] = [];
  const link = (source: string, target: string, cents: number) => links.push({ source, target, value: toDollars(cents) });
  if (incomeCents > 0) {
    nodes.push({ id: 'pay', kind: 'income' });
    link('pay', 'income', incomeCents);
  }
  if (savingsCents < 0) {
    nodes.push({ id: 'fromSavings', kind: 'savings' });
    link('fromSavings', 'income', -savingsCents);
  }
  nodes.push({ id: 'income', kind: 'total' });
  for (const t of drawn) {
    nodes.push({ id: t.id, kind: 'category' });
    link('income', t.id, t.cents);
  }
  if (savingsCents > 0) {
    nodes.push({ id: 'savings', kind: 'savings' });
    link('income', 'savings', savingsCents);
  }
  return { nodes, links };
}
