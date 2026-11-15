// View-model of the Cash Flow screen (MP11, #171). The ledger (MP10) goes through `transactionTotals`
// and each period through the engine's `cashFlowSummary` (MP9). No network.
import { cashFlowSummary } from '@lifeguessr/engine';
import { useMemo, useState } from 'react';
import { usEasternDate } from '@/lib/dates';
import { transactionTotals } from '@/lib/model/transactions';
import { BUDGET_GROUPS } from '@/features/budget/model/groups';
import { useLedger } from '@/features/transactions/model/transactionsStore';
import { useGoalLinks } from '@/features/transactions/model/goalLinks';
import { newestFirst, toRow } from '@/features/transactions/model/rows';
import { useAccountsStore } from '@/lib/model/accounts';
import { toFlow } from './flow';
import { periodsFor, quarterOf } from './periods';
import type {
  CashFlowBarVM, CashFlowBreakdown, CashFlowBreakdownRowVM, CashFlowKpiVM, CashFlowPeriodKind, CashFlowView, CashFlowVM,
} from './types';

/** How many of the period's lines the Cash Flow screen lists (the rest are on Transactions). */
export const LINES_SHOWN = 6;

const diff = (value: number | null, previous: number | null): number | null =>
  value === null || previous === null ? null : Math.round((value - previous) * 100) / 100;

export function useCashFlow({ today }: { today?: string } = {}): CashFlowVM {
  const { lines, ready } = useLedger();
  const accounts = useAccountsStore((s) => s.accounts);
  const goalLinks = useGoalLinks((s) => s.links);
  const [period, setPeriod] = useState<CashFlowPeriodKind>('monthly');
  const [view, setView] = useState<CashFlowView>('sankey');
  const [breakdown, setBreakdown] = useState<CashFlowBreakdown>('category');
  const month = (today ?? usEasternDate()).slice(0, 7);

  const totals = useMemo(() => transactionTotals(lines), [lines]);
  const summaries = useMemo(() => periodsFor(period, month).map((p) => cashFlowSummary(totals, p)), [totals, period, month]);
  const current = summaries[summaries.length - 1]!;
  const previous = summaries[summaries.length - 2] ?? null;

  const bars = useMemo<CashFlowBarVM[]>(
    () =>
      summaries.map((s) => ({
        period: s.period,
        quarter: period === 'quarterly' ? quarterOf(s.period) : null,
        income: s.income,
        expenses: s.expenses,
        savings: s.savings,
        isCurrent: s.period.from <= month && month <= s.period.to,
      })),
    [summaries, period, month],
  );

  const kpis = useMemo<CashFlowKpiVM[]>(
    () => [
      { id: 'income', value: current.income, previous: previous?.income ?? null, change: diff(current.income, previous?.income ?? null) },
      { id: 'expenses', value: current.expenses, previous: previous?.expenses ?? null, change: diff(current.expenses, previous?.expenses ?? null) },
      { id: 'savings', value: current.savings, previous: previous?.savings ?? null, change: diff(current.savings, previous?.savings ?? null) },
      {
        id: 'savingsRate',
        value: current.savingsRate,
        previous: previous?.savingsRate ?? null,
        // A rate difference is not money: no cent rounding.
        change: current.savingsRate === null || previous?.savingsRate == null ? null : current.savingsRate - previous.savingsRate,
      },
    ],
    [current, previous],
  );

  const breakdownRows = useMemo<CashFlowBreakdownRowVM[]>(() => {
    const total = current.expenses;
    const share = (amount: number) => (total > 0 ? amount / total : 0);
    if (breakdown === 'category') return current.byCategory.map((c) => ({ kind: 'category', category: c.category, amount: c.amount, share: share(c.amount) }));
    return BUDGET_GROUPS.map(({ id, categories }) => ({
      kind: 'group' as const,
      group: id,
      amount: current.byCategory.filter((c) => categories.includes(c.category)).reduce((sum, c) => sum + c.amount, 0),
    }))
      .filter((g) => g.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .map((g) => ({ ...g, share: share(g.amount) }));
  }, [current, breakdown]);

  const flow = useMemo(() => toFlow(current, breakdown), [current, breakdown]);

  const periodLines = useMemo(() => {
    const { from, to } = current.period;
    return lines.filter((l) => l.cls !== 'transfer' && l.date.slice(0, 7) >= from && l.date.slice(0, 7) <= to).sort(newestFirst);
  }, [lines, current]);
  const shownLines = useMemo(
    () => periodLines.slice(0, LINES_SHOWN).map((l) => toRow(l, accounts, goalLinks)),
    [periodLines, accounts, goalLinks],
  );

  const empty = useMemo(() => {
    const [from, to] = [summaries[0]!.period.from, current.period.to];
    return !totals.some((m) => m.month >= from && m.month <= to);
  }, [totals, summaries, current]);

  return {
    ready,
    empty,
    period,
    setPeriod,
    view,
    setView,
    bars,
    kpis,
    breakdown,
    setBreakdown,
    breakdownRows,
    summary: current,
    flow,
    lines: shownLines,
    lineCount: periodLines.length,
  };
}
