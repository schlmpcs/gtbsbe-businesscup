// View-model of the Budget screen (MP11, #171). Fixture-backed: the plan is in ./budgetStore.ts, the
// actuals come from the in-memory ledger, the table from ./table.ts.
// MP11b: swap the store for the real one (MP9), the table for `budgetRows` / `budgetRowsForYear`, and
// the demo profile for the person's (accountsToProfile).
import { useCallback, useMemo, useState } from 'react';
import { addMonths } from '@lifeguessr/engine';
import { COST_CATEGORIES, type CostCategory } from '@lifeguessr/types';
import { profileDemo } from '@/fixtures';
import { usEasternDate } from '@/lib/dates';
import { formatMonthYear } from '@/lib/format';
import { useTransactionsStore } from '@/features/transactions/model/transactionsStore';
import { useBudgetStore, zeroPlanned } from './budgetStore';
import { elapsedShare, fixtureBudgetTable } from './table';
import type { BudgetMode, BudgetVM } from './types';
import { toGroupVMs, toIncomeVM } from './view';

export function useBudget({ today: todayArg }: { today?: string } = {}): BudgetVM {
  const today = todayArg ?? usEasternDate();
  const todayMonth = today.slice(0, 7);
  const planned = useBudgetStore((s) => s.planned);
  const incomePlanned = useBudgetStore((s) => s.incomePlanned);
  const transactions = useTransactionsStore((s) => s.transactions);
  const [mode, setMode] = useState<BudgetMode>('month');
  const [month, setMonth] = useState(todayMonth);

  const table = useMemo(
    () => fixtureBudgetTable({ planned: planned ?? zeroPlanned(), incomePlanned, txs: transactions, mode, month, today }),
    [planned, incomePlanned, transactions, mode, month, today],
  );
  const marker = elapsedShare(mode, month, today);
  const groups = useMemo(() => toGroupVMs(table, marker), [table, marker]);

  const step = mode === 'year' ? 12 : 1;
  const prev = useCallback(() => setMonth((m) => addMonths(m, -step)), [step]);
  const next = useCallback(() => setMonth((m) => addMonths(m, step)), [step]);
  const goToday = useCallback(() => setMonth(todayMonth), [todayMonth]);

  const createBudget = useCallback(() => {
    // MP11b: the person's profile (accountsToProfile), not the demo one.
    const fromProfile = Object.fromEntries(COST_CATEGORIES.map((c) => [c, profileDemo.spending[c].value])) as Record<CostCategory, number>;
    useBudgetStore.getState().create(fromProfile, profileDemo.takeHomePay.value);
  }, []);
  const setPlanned = useCallback((category: CostCategory, amount: number): boolean => {
    if (!Number.isFinite(amount) || amount < 0) return false;
    useBudgetStore.getState().setPlanned(category, amount);
    return true;
  }, []);

  return {
    ready: true,
    hasBudget: planned !== null,
    mode,
    setMode,
    month,
    monthLabel: mode === 'year' ? month.slice(0, 4) : formatMonthYear(month),
    isCurrent: mode === 'year' ? month.slice(0, 4) === todayMonth.slice(0, 4) : month === todayMonth,
    income: toIncomeVM(table.income, marker),
    groups,
    totals: table.totals,
    createBudget,
    setPlanned,
    prev,
    next,
    today: goToday,
  };
}
