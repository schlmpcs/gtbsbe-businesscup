// View-model of the Dashboard (MP11, #171). Fixture-backed: composes the in-memory accounts, ledger and
// budget (the stores behind useAccounts / useTransactions / useBudget) with ./dashboardStore.ts.
// No network, no clock besides `now`.
// MP11b: wire each card to its real store; the top move to the Next Moves ranking (MP6).
import { useCallback, useMemo } from 'react';
import { addMonths, rankMoves } from '@lifeguessr/engine';
import { profileDemo } from '@/fixtures';
import { usEasternDate } from '@/lib/dates';
import { useAccountsStore } from '@/features/accounts/model/accountsStore';
import { netWorthSeries, summarizeAccounts } from '@/features/accounts/model/series';
import { useBudgetStore } from '@/features/budget/model/budgetStore';
import { elapsedShare, fixtureBudgetTable } from '@/features/budget/model/table';
import { toRowVM } from '@/features/budget/model/view';
import { newestFirst } from '@/features/transactions/model/ledger';
import { toRow } from '@/features/transactions/model/rows';
import { useTransactionsStore } from '@/features/transactions/model/transactionsStore';
import { useDashboardStore } from './dashboardStore';
import { PLANNER_ROUTES } from './links';
import { spendingPoints, toDailyEntries } from './spending';
import type { ChecklistItemVM, DashboardVM, GreetingPart } from './types';

const RECENT = 5;
const BUDGET_ROWS = 3;

export const greetingPartOf = (hour: number): GreetingPart => (hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening');

/** `today` is 'YYYY-MM-DD' (default: today in US Eastern time); `now` picks the greeting (default: the clock). Tests pass both. */
export function useDashboard({ today: todayArg, now }: { today?: string; now?: Date } = {}): DashboardVM {
  const today = todayArg ?? usEasternDate();
  const month = today.slice(0, 7);
  const previousMonth = addMonths(month, -1);
  const day = Number(today.slice(8, 10));

  const accounts = useAccountsStore((s) => s.accounts);
  const transactions = useTransactionsStore((s) => s.transactions);
  const planned = useBudgetStore((s) => s.planned);
  const incomePlanned = useBudgetStore((s) => s.incomePlanned);
  const state = useDashboardStore();

  const summary = useMemo(() => summarizeAccounts(accounts, month), [accounts, month]);
  const sparkline = useMemo(() => (accounts.length === 0 ? [] : netWorthSeries(accounts, month)), [accounts, month]);

  const spending = useMemo(() => {
    const points = spendingPoints(toDailyEntries(transactions), month, previousMonth, day);
    const at = (key: 'thisMonth' | 'lastMonth', d: number) => points[Math.min(d, points.length) - 1]?.[key] ?? 0;
    return {
      thisMonth: at('thisMonth', day),
      lastMonth: points.reduce((last, p) => p.lastMonth ?? last, 0),
      lastMonthToDate: at('lastMonth', day),
      month,
      previousMonth,
      points,
    };
  }, [transactions, month, previousMonth, day]);

  const budgetRows = useMemo(() => {
    if (planned === null) return [];
    const table = fixtureBudgetTable({ planned, incomePlanned, txs: transactions, mode: 'month', month, today });
    const marker = elapsedShare('month', month, today);
    // Lines with no plan and no spending say nothing; the rest, least left first (a negative remaining is overspent).
    return table.rows.filter((r) => r.planned > 0 || r.actual > 0).sort((a, b) => a.remaining - b.remaining).slice(0, BUDGET_ROWS).map((r) => toRowVM(r, marker));
  }, [planned, incomePlanned, transactions, month, today]);

  // MP11b: the top move from MP6 (Next Moves on the person's profile).
  const topMove = useMemo(() => {
    const [move] = rankMoves(profileDemo);
    return move === undefined ? null : { id: move.id, kind: move.kind, ...(move.category === undefined ? {} : { category: move.category }), effect10y: move.effect10y };
  }, []);

  const recentTransactions = useMemo(
    () => [...transactions].sort(newestFirst).slice(0, RECENT).map((t) => toRow(t, accounts)),
    [transactions, accounts],
  );

  const items = useMemo<ChecklistItemVM[]>(
    () => [
      { id: 'duel', labelKey: 'playedDuel', done: state.duel.playedToday || state.duel.streak > 0, href: PLANNER_ROUTES.duel },
      { id: 'guess', labelKey: 'guessedOwnMonth', done: state.guessedOwnMonth, href: PLANNER_ROUTES.guessOwnMonth },
      { id: 'accounts', labelKey: 'addedAccounts', done: accounts.length > 0, href: PLANNER_ROUTES.addAccount },
      { id: 'csv', labelKey: 'importedCsv', done: transactions.length > 0, href: PLANNER_ROUTES.importCsv },
      { id: 'planEvent', labelKey: 'createdPlanEvent', done: state.createdPlanEvent, href: PLANNER_ROUTES.plan },
    ],
    [state.duel, state.guessedOwnMonth, state.createdPlanEvent, accounts.length, transactions.length],
  );
  const done = items.filter((i) => i.done).length;

  const dismissChecklist = useCallback(() => useDashboardStore.getState().update({ checklistDismissed: true }), []);

  return {
    ready: true,
    greeting: { part: greetingPartOf((now ?? new Date()).getHours()) },
    checklist: { items, done, total: items.length, dismissed: state.checklistDismissed, visible: !state.checklistDismissed && done < items.length },
    netWorth: { value: summary.netWorth, change1m: summary.change1m, sparkline, hasAccounts: accounts.length > 0 },
    spending,
    budget: { hasBudget: planned !== null, rows: budgetRows },
    plan: state.planSuccessRate === null ? { status: 'run' } : { status: 'result', successRate: state.planSuccessRate },
    topMove,
    duel: { playedToday: state.duel.playedToday, streak: state.duel.streak },
    recentTransactions,
    links: PLANNER_ROUTES,
    dismissChecklist,
  };
}
