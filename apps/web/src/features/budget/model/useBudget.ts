// View-model of the Budget screen (MP11, #171). The plan is the person's own, kept in this browser
// (./budgetStore.ts: "Create budget" copies the profile's spending, each cell can be edited); the actuals
// are the ledger's monthly totals (`transactionTotals`, MP10); the table is the engine's `budgetRows` /
// `budgetRowsForYear` (MP9).
import { useCallback, useMemo, useState } from 'react';
import { addMonths } from '@lifeguessr/engine';
import { COST_CATEGORIES, type CostCategory } from '@lifeguessr/types';
import { usEasternDate } from '@/lib/dates';
import { formatMonthYear } from '@/lib/format';
import { transactionTotals } from '@/lib/model/transactions';
import { useAppStore } from '@/state/store';
import { usePersistedReady } from '@/features/dashboard/model/persisted';
import { useLedger } from '@/features/transactions/model/transactionsStore';
import { useBudgetStore, zeroPlanned } from './budgetStore';
import { budgetTable, elapsedShare } from './budgetTable';
import type { BudgetMode, BudgetVM } from './types';
import { toGroupVMs, toIncomeVM } from './view';

export function useBudget({ today: todayArg }: { today?: string } = {}): BudgetVM {
  const today = todayArg ?? usEasternDate();
  const todayMonth = today.slice(0, 7);
  const planned = useBudgetStore((s) => s.planned);
  const incomePlanned = useBudgetStore((s) => s.incomePlanned);
  const budgetReady = usePersistedReady(useBudgetStore);
  const { lines, ready: ledgerReady } = useLedger();
  const [mode, setMode] = useState<BudgetMode>('month');
  const [month, setMonth] = useState(todayMonth);

  const totals = useMemo(() => transactionTotals(lines), [lines]);
  const table = useMemo(
    () => budgetTable({ planned: planned ?? zeroPlanned(), totals, mode, month, today }),
    [planned, totals, mode, month, today],
  );
  const marker = elapsedShare(mode, month, today);
  const groups = useMemo(() => toGroupVMs(table, marker), [table, marker]);

  const step = mode === 'year' ? 12 : 1;
  const prev = useCallback(() => setMonth((m) => addMonths(m, -step)), [step]);
  const next = useCallback(() => setMonth((m) => addMonths(m, step)), [step]);
  const goToday = useCallback(() => setMonth(todayMonth), [todayMonth]);

  const createBudget = useCallback(() => {
    // The person's profile (kept in line with their accounts), its monthly spending and take-home pay.
    const { profile } = useAppStore.getState();
    const fromProfile = Object.fromEntries(COST_CATEGORIES.map((c) => [c, profile.spending[c].value])) as Record<CostCategory, number>;
    useBudgetStore.getState().create(fromProfile, profile.takeHomePay.value);
  }, []);
  const setPlanned = useCallback((category: CostCategory, amount: number): boolean => {
    if (!Number.isFinite(amount) || amount < 0) return false;
    useBudgetStore.getState().setPlanned(category, amount);
    return true;
  }, []);

  return {
    ready: budgetReady && ledgerReady,
    hasBudget: planned !== null,
    mode,
    setMode,
    month,
    monthLabel: mode === 'year' ? month.slice(0, 4) : formatMonthYear(month),
    isCurrent: mode === 'year' ? month.slice(0, 4) === todayMonth.slice(0, 4) : month === todayMonth,
    income: toIncomeVM(table.income, incomePlanned, mode === 'year' ? 12 : 1, marker),
    groups,
    totals: table.totals,
    createBudget,
    setPlanned,
    prev,
    next,
    today: goToday,
  };
}
