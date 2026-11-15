// View-model of the Dashboard (MP11, #171). Composes the real stores behind the other planner screens:
// the Accounts store (MP8, net worth by the engine's `netWorthSummary`), the Transactions store (MP10),
// the person's budget plan (the table is the engine's `budgetRows`, MP9), the Recurring and Goals
// view-models, and the profile (Next Moves' `rankMoves`). The plan card is /plan's own: the active
// scenario's engine plan() (planEngine.planOf) and the Chance of success run by useChanceOfSuccess (the
// engine's seeded monteCarlo() on the same inputs); the dashboard starts that run when there is none, and
// the result lands in the plan store, so /plan?view=chance shows the same number. The setup checklist
// reads the stores: the Duel's rounds today, the guess of their own month, accounts, ledger lines, the
// budget and a plan the person changed. The Duel streak is a placeholder in ./dashboardStore.ts. No
// network, no clock besides `now`.
import { useCallback, useEffect, useMemo } from 'react';
import { addMonths, netWorthSummary, rankMoves } from '@lifeguessr/engine';
import { usEasternDate } from '@/lib/dates';
import { useAccountsReady, useAccountsStore } from '@/lib/model/accounts';
import { transactionTotals } from '@/lib/model/transactions';
import { useProfile } from '@/state/profile';
import { useAppStore } from '@/state/store';
import { netWorthSeries } from '@/features/accounts/model/series';
import { useBudgetStore } from '@/features/budget/model/budgetStore';
import { budgetTable, elapsedShare } from '@/features/budget/model/budgetTable';
import { progressOf, toGroupVMs, toRowVM } from '@/features/budget/model/view';
import { dueDateIn } from '@/features/bills/model/calendar';
import { readDuelDayProgress } from '@/features/game/model/duelProgress';
import { useGoals } from '@/features/goals/model/useGoals';
import { NO_MOVES, planOf, usePlanInputs } from '@/features/plan/model/planEngine';
import { usePlanStore } from '@/features/plan/model/planStore';
import { GOOD_SUCCESS_RATE, useChanceOfSuccess } from '@/features/plan/model/useChanceOfSuccess';
import { useScenarios } from '@/features/plan/model/useScenarios';
import { useRecurring } from '@/features/recurring/model/useRecurring';
import { useGoalLinks } from '@/features/transactions/model/goalLinks';
import { newestFirst, toRow } from '@/features/transactions/model/rows';
import { useLedger } from '@/features/transactions/model/transactionsStore';
import { useDashboardStore } from './dashboardStore';
import { PLANNER_ROUTES } from './links';
import { usePersistedReady } from './persisted';
import { spendingPoints, toDailyEntries } from './spending';
import type {
  BalancePointVM, BudgetGroupBarVM, ChanceVM, ChecklistItemVM, DashboardPlanVM, DashboardVM, GreetingPart, NetWorthPeriod,
  NetWorthPeriodVM, UpcomingBillVM,
} from './types';

const RECENT = 5;
const BUDGET_ROWS = 3;
const UPCOMING = 5;
export const NET_WORTH_PERIODS: Record<NetWorthPeriod, number> = { '1m': 1, '3m': 3, '6m': 6, '12m': 12 };

/**
 * The net worth history from `months` before `month` on. The period's first month carries the last
 * balance before it, so a period always starts at its left edge when there is any history before it.
 */
export function netWorthPeriod(points: readonly BalancePointVM[], month: string, months: number): NetWorthPeriodVM {
  const from = addMonths(month, -months);
  const inside = points.filter((p) => p.month >= from);
  const before = points.filter((p) => p.month < from).at(-1);
  const cut = before && inside[0]?.month !== from ? [{ month: from, value: before.value }, ...inside] : inside;
  const first = cut[0];
  const last = cut.at(-1);
  return { points: cut, change: cut.length >= 2 && first && last ? last.value - first.value : null };
}

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
  // The scenarios are seeded with Retire and Social Security events, so "your plan" counts once the person changed one.
  const changedPlan = usePlanStore((s) => s.touched);
  const duelProgress = useMemo(() => readDuelDayProgress(today), [today]);
  const recurringVM = useRecurring({ today });
  const goalsVM = useGoals();

  const summary = useMemo(() => netWorthSummary(accounts), [accounts]);
  const sparkline = useMemo(() => netWorthSeries(accounts, month), [accounts, month]);
  const periods = useMemo(
    () => Object.fromEntries(Object.entries(NET_WORTH_PERIODS).map(([k, n]) => [k, netWorthPeriod(sparkline, month, n)])) as Record<NetWorthPeriod, NetWorthPeriodVM>,
    [sparkline, month],
  );

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
      empty: points.every((p) => !p.thisMonth && !p.lastMonth),
    };
  }, [lines, month, previousMonth, day]);

  const budget = useMemo((): DashboardVM['budget'] => {
    const todayMarker = elapsedShare('month', month, today);
    if (planned === null) return { hasBudget: false, rows: [], groups: [], totals: { planned: 0, actual: 0, remaining: 0 }, todayMarker };
    const table = budgetTable({ planned, totals: transactionTotals(lines), mode: 'month', month, today });
    // Lines with no plan and no spending say nothing; the rest, least left first (a negative remaining is overspent).
    const rows = table.rows.filter((r) => r.planned > 0 || r.actual > 0).sort((a, b) => a.remaining - b.remaining).slice(0, BUDGET_ROWS).map((r) => toRowVM(r, todayMarker));
    const groups = toGroupVMs(table, todayMarker)
      .filter((g) => g.totals.planned > 0 || g.totals.actual > 0)
      .map((g): BudgetGroupBarVM => ({ id: g.id, planned: g.totals.planned, actual: g.totals.actual, remaining: g.totals.remaining, progress: progressOf(g.totals.planned, g.totals.actual) }));
    const { planned: p, actual, remaining } = table.totals;
    return { hasBudget: true, rows, groups, totals: { planned: p, actual, remaining }, todayMarker };
  }, [planned, lines, month, today]);

  // The plan card: /plan's active scenario, seeded the way /plan seeds it.
  useScenarios();
  const scenario = usePlanStore((s) => s.scenarios.find((x) => x.id === s.activeId));
  const moves = usePlanStore((s) => s.movesApplied[s.activeId] ?? NO_MOVES);
  const planInputs = usePlanInputs();
  const ready = accountsReady && ledgerReady && budgetReady && dashboardReady;
  // No Chance run yet (or the plan changed since): run it, once the person's data is loaded.
  const { status: chanceStatus, run: runChance } = useChanceOfSuccess();
  useEffect(() => {
    if (ready && scenario && chanceStatus === 'idle') runChance();
  }, [ready, scenario, chanceStatus, runChance]);

  const chanceResult = usePlanStore((s) => s.chanceResult);
  const chance = useMemo((): ChanceVM => {
    if (chanceStatus === 'error') return { status: 'error' };
    if (chanceStatus !== 'done' || chanceResult === null) return { status: 'running' };
    const { successRate, paths } = chanceResult;
    return { status: 'result', successRate, good: successRate >= GOOD_SUCCESS_RATE, paths };
  }, [chanceStatus, chanceResult]);

  const planResult = useMemo(() => (scenario ? planOf(planInputs, scenario, moves) : null), [planInputs, scenario, moves]);
  const plan = useMemo((): DashboardPlanVM | null => {
    if (!scenario || !planResult || planResult.years.length === 0) return null;
    const { kpis } = planResult;
    return {
      points: planResult.years.map((y) => ({ year: y.year, age: y.age, netWorth: y.netWorth })),
      retireAge: kpis.retireAge,
      endAge: scenario.assumptions.endAge,
      netWorthAtRetirement: kpis.netWorthAtRetirement,
      shortfallAge: kpis.shortfallAge,
      display: planResult.display,
      chance,
    };
  }, [scenario, planResult, chance]);

  const recurring = useMemo((): DashboardVM['recurring'] => {
    const year = Number(month.slice(0, 4));
    const m = Number(month.slice(5, 7));
    const due = recurringVM.sections
      .filter((s) => s.id !== 'income')
      .flatMap((s) => s.items)
      .flatMap((item): UpcomingBillVM[] => {
        if (item.dayOfMonth === null) return [];
        const d = dueDateIn(item.dayOfMonth, year, m).day;
        return d >= day ? [{ ...item, date: `${month}-${String(d).padStart(2, '0')}` }] : [];
      })
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : b.amount - a.amount));
    return { upcoming: due.slice(0, UPCOMING), remainingDue: due.reduce((sum, i) => sum + i.amount, 0), empty: recurringVM.empty };
  }, [recurringVM.sections, recurringVM.empty, month, day]);

  const goals = useMemo(
    () => goalsVM.goals.map((g) => ({ id: g.id, name: g.name, saved: g.saved, target: g.target, savedShare: g.savedShare, status: g.status })),
    [goalsVM.goals],
  );

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
      { id: 'budget', labelKey: 'setBudget', done: planned !== null, href: PLANNER_ROUTES.budget },
      { id: 'planEvent', labelKey: 'createdPlanEvent', done: changedPlan, href: PLANNER_ROUTES.plan },
    ],
    [duelProgress, state.duelStreak, guessedOwnMonth, accounts.length, lines.length, planned, changedPlan],
  );
  const done = items.filter((i) => i.done).length;

  const dismissChecklist = useCallback(() => useDashboardStore.getState().update({ checklistDismissed: true }), []);

  return {
    ready: ready && recurringVM.ready && goalsVM.ready,
    greeting: { part: greetingPartOf((now ?? new Date()).getHours()) },
    checklist: { items, done, total: items.length, dismissed: state.checklistDismissed, visible: !state.checklistDismissed && done < items.length },
    netWorth: { value: summary.netWorth, change1m: summary.change1m, sparkline, periods, hasAccounts: accounts.length > 0 },
    spending,
    budget,
    plan,
    topMove,
    duel: { playedToday: duelProgress.finished, played: duelProgress.played, total: duelProgress.total, streak: state.duelStreak },
    recurring,
    goals,
    recentTransactions,
    links: PLANNER_ROUTES,
    dismissChecklist,
  };
}
