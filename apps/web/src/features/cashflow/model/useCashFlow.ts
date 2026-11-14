// View-model of the Cash Flow screen (MP11, #171). Fixture-backed: sums the in-memory ledger with
// features/transactions/model/ledger.ts. No network.
// MP11b: wire `ledgerSummary` to the engine's `cashFlowSummary` (MP9) and the ledger to the real store.
import { useMemo, useState } from 'react';
import { usEasternDate } from '@/lib/dates';
import { BUDGET_GROUPS } from '@/features/budget/model/groups';
import { inPeriod, ledgerSummary } from '@/features/transactions/model/ledger';
import { useTransactionsStore } from '@/features/transactions/model/transactionsStore';
import { periodsFor, quarterOf } from './periods';
import type {
  CashFlowBarVM, CashFlowBreakdown, CashFlowBreakdownRowVM, CashFlowKpiVM, CashFlowPeriodKind, CashFlowView, CashFlowVM,
} from './types';

export function useCashFlow({ today }: { today?: string } = {}): CashFlowVM {
  const transactions = useTransactionsStore((s) => s.transactions);
  const [period, setPeriod] = useState<CashFlowPeriodKind>('monthly');
  const [view, setView] = useState<CashFlowView>('bars');
  const [breakdown, setBreakdown] = useState<CashFlowBreakdown>('category');
  const month = (today ?? usEasternDate()).slice(0, 7);

  const summaries = useMemo(() => periodsFor(period, month).map((p) => ledgerSummary(transactions, p)), [transactions, period, month]);
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
      { id: 'income', value: current.income, previous: previous?.income ?? null },
      { id: 'expenses', value: current.expenses, previous: previous?.expenses ?? null },
      { id: 'savings', value: current.savings, previous: previous?.savings ?? null },
      { id: 'savingsRate', value: current.savingsRate, previous: previous?.savingsRate ?? null },
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

  const empty = useMemo(() => {
    const first = summaries[0]!.period.from;
    return !transactions.some((t) => inPeriod(t, { from: first, to: current.period.to }));
  }, [transactions, summaries, current]);

  return {
    ready: true,
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
  };
}
