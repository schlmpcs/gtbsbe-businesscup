// View-model of the Dashboard (MP11, #171). Composes the real stores behind the other planner screens:
// the Accounts store (MP8, net worth by the engine's `netWorthSummary`), the Transactions store (MP10),
// the person's budget plan (the table is the engine's `budgetRows`, MP9) and the profile (Next Moves'
// `rankMoves`). The setup checklist reads the stores: the Duel's rounds today, the guess of their own
// month, accounts, ledger lines and plan events. Placeholders that have no store yet are in
// ./dashboardStore.ts (Duel streak, the Chance run). No network, no clock besides `now`.
import { useCallback, useMemo } from 'react';
import { addMonths, netWorthSummary, rankMoves } from '@lifeguessr/engine';
import { usEasternDate } from '@/lib/dates';
import { useAccountsReady, useAccountsStore } from '@/lib/model/accounts';
import { transactionTotals } from '@/lib/model/transactions';
import { useProfile } from '@/state/profile';
import { useAppStore } from '@/state/store';
import { netWorthSeries } from '@/features/accounts/model/series';
import { useBudgetStore } from '@/features/budget/model/budgetStore';
import { budgetTable, elapsedShare } from '@/features/budget/model/budgetTable';
import { toRowVM } from '@/features/budget/model/view';
import { readDuelDayProgress } from '@/features/game/model/duelProgress';
import { usePlanStore } from '@/features/plan/model/planStore';
import { useGoalLinks } from '@/features/transactions/model/goalLinks';
import { newestFirst, toRow } from '@/features/transactions/model/rows';
import { useLedger } from '@/features/transactions/model/transactionsStore';
import { useDashboardStore } from './dashboardStore';
import { PLANNER_ROUTES } from './links';
import { usePersistedReady } from './persisted';
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

  const accountsReady = useAccountsReady();
  const accounts = useAccountsStore((s) => s.accounts);
  const { lines, ready: ledgerReady } = useLedger();
  const goalLinks = useGoalLinks((s) => s.links);
  const planned = useBudgetStore((s) => s.planned);
  const budgetReady = usePersistedReady(useBudgetStore);
  const state = useDashboardStore();
  const dashboardReady = usePersistedReady(useDashboardStore);
  const profile = useProfile();
  const guessedOwnMonth = useAppStore((s) => s.selfGuess !== null);
  const createdPlanEvent = usePlanStore((s) => s.scenarios.some((sc) => sc.events.length > 0));
  const duelProgress = useMemo(() => readDuelDayProgress(today), [today]);

  const summary = useMemo(() => netWorthSummary(accounts), [accounts]);
  const sparkline = useMemo(() => netWorthSeries(accounts, month), [accounts, month]);

  const spending = useMemo(() => {
    const points = spendingPoints(toDailyEntries(lines), month, previousMonth, day);
    const at = (key: 'thisMonth' | 'lastMonth', d: number) => points[Math.min(d, points.length) - 1]?.[key] ?? 0;
    return {
      thisMonth: at('thisMonth', day),
      lastMonth: points.reduce((last, p) => p.lastMonth ?? last, 0),
      lastMonthToDate: at('lastMonth', day),
      month,
      previousMonth,
      points,
    };
  }, [lines, month, previousMonth, day]);

  const budgetRows = useMemo(() => {
    if (planned === null) return [];
    const table = budgetTable({ planned, totals: transactionTotals(lines), mode: 'month', month, today });
    const marker = elapsedShare('month', month, today);
    // Lines with no plan and no spending say nothing; the rest, least left first (a negative remaining is overspent).
    return table.rows.filter((r) => r.planned > 0 || r.actual > 0).sort((a, b) => a.remaining - b.remaining).slice(0, BUDGET_ROWS).map((r) => toRowVM(r, marker));
  }, [planned, lines, month, today]);

  // The best Next Move on the person's profile (MP6's `rankMoves`).
  const topMove = useMemo(() => {
    const [move] = rankMoves(profile);
    return move === undefined ? null : { id: move.id, kind: move.kind, ...(move.category === undefined ? {} : { category: move.category }), effect10y: move.effect10y };
  }, [profile]);

  const recentTransactions = useMemo(
    () => [...lines].sort(newestFirst).slice(0, RECENT).map((t) => toRow(t, accounts, goalLinks)),
    [lines, accounts, goalLinks],
  );

  const items = useMemo<ChecklistItemVM[]>(
    () => [
      { id: 'duel', labelKey: 'playedDuel', done: duelProgress.played > 0 || state.duelStreak > 0, href: PLANNER_ROUTES.duel },
      { id: 'guess', labelKey: 'guessedOwnMonth', done: guessedOwnMonth, href: PLANNER_ROUTES.guessOwnMonth },
      { id: 'accounts', labelKey: 'addedAccounts', done: accounts.length > 0, href: PLANNER_ROUTES.addAccount },
      { id: 'csv', labelKey: 'importedCsv', done: lines.length > 0, href: PLANNER_ROUTES.importCsv },
      { id: 'planEvent', labelKey: 'createdPlanEvent', done: createdPlanEvent, href: PLANNER_ROUTES.plan },
    ],
    [duelProgress, state.duelStreak, guessedOwnMonth, accounts.length, lines.length, createdPlanEvent],
  );
  const done = items.filter((i) => i.done).length;

  const dismissChecklist = useCallback(() => useDashboardStore.getState().update({ checklistDismissed: true }), []);

  return {
    ready: accountsReady && ledgerReady && budgetReady && dashboardReady,
    greeting: { part: greetingPartOf((now ?? new Date()).getHours()) },
    checklist: { items, done, total: items.length, dismissed: state.checklistDismissed, visible: !state.checklistDismissed && done < items.length },
    netWorth: { value: summary.netWorth, change1m: summary.change1m, sparkline, hasAccounts: accounts.length > 0 },
    spending,
    budget: { hasBudget: planned !== null, rows: budgetRows },
    plan: state.planSuccessRate === null ? { status: 'run' } : { status: 'result', successRate: state.planSuccessRate },
    topMove,
    duel: { playedToday: duelProgress.finished, streak: state.duelStreak },
    recentTransactions,
    links: PLANNER_ROUTES,
    dismissChecklist,
  };
}
