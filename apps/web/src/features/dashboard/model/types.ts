// View-model contract of the Dashboard (MP11, #171). ui/ may import only this file, @/ui-kit/** and
// @/copy (lint-enforced). Hook: useDashboard (./useDashboard.ts), which reads the same data as the
// Accounts, Transactions, Budget and Recurring hooks.
// Units: Money is unrounded US dollars (a balance for net worth, a month's sum for spending); ratios
// are 0..1. Names: copy.dashboard (greeting, checklist[labelKey], card titles), copy.planner and
// copy.budget (categories, statuses). Net worth and the plan figure are estimates from the person's
// inputs ("educational simulation, not financial advice").
import type { CostCategory, MoveKind, Money, Rate, YearMonth } from '@lifeguessr/types';
import type { BalancePointVM } from '@/features/accounts/model/types';
import type { BudgetGroupId, BudgetRowVM } from '@/features/budget/model/types';
import type { SaveUpGoalStatus } from '@/features/goals/model/types';
import type { RecurringItemVM } from '@/features/recurring/model/types';
import type { TransactionRowVM } from '@/features/transactions/model/types';
import type { PlannerLinks } from './links';

export type { CostCategory, MoveKind, Money, Rate, YearMonth } from '@lifeguessr/types';
export type { BalancePointVM } from '@/features/accounts/model/types';
export type { BudgetGroupId, BudgetRowVM } from '@/features/budget/model/types';
export type { SaveUpGoalStatus } from '@/features/goals/model/types';
export type { RecurringItemVM, RecurringLabelKey, RecurringSectionId } from '@/features/recurring/model/types';
export type { StatementClass, TransactionRowVM, TransactionTone } from '@/features/transactions/model/types';
export type { PlannerLinks } from './links';

export type GreetingPart = 'morning' | 'afternoon' | 'evening';

export type ChecklistId = 'duel' | 'guess' | 'accounts' | 'csv' | 'budget' | 'planEvent';
/** Key into copy.dashboard.checklist. */
export type ChecklistLabelKey = 'playedDuel' | 'guessedOwnMonth' | 'addedAccounts' | 'importedCsv' | 'setBudget' | 'createdPlanEvent';

export type ChecklistItemVM = {
  id: ChecklistId;
  done: boolean;
  labelKey: ChecklistLabelKey;
  /** Where the person does it. */
  href: string;
};

/** Day `day` of the month (1-based): the running spending total this month and last month. */
export type SpendingPointVM = {
  day: number;
  /** Null for days after today. */
  thisMonth: Money | null;
  /** Null for days a shorter last month does not have. */
  lastMonth: Money | null;
};

/** The net worth card's periods: the last 1, 3, 6 or 12 months. */
export type NetWorthPeriod = '1m' | '3m' | '6m' | '12m';

export type NetWorthPeriodVM = {
  /** Month-end net worth from the start of the period to this month, oldest first (the start carries the last balance before it). */
  points: BalancePointVM[];
  /** Last point - first point; null with fewer than two points. */
  change: Money | null;
};

/** One budget group this month: planned vs spent. */
export type BudgetGroupBarVM = {
  id: BudgetGroupId;
  planned: Money;
  actual: Money;
  /** planned - actual (negative = over). */
  remaining: Money;
  /** actual / planned, 0 or more (more than 1 = over). */
  progress: number;
};

/** A year of the plan: net worth at the end of the year the person turns `age` (engine plan(), display unit of the scenario). */
export type PlanPointVM = { year: number; age: number; netWorth: Money };

/** The Monte Carlo run behind "Chance of success": the same run as /plan?view=chance (engine monteCarlo()). */
export type ChanceVM =
  | { status: 'running' }
  | { status: 'result'; successRate: Rate; /** At or above the "plan works" bar (80%). */ good: boolean; paths: number }
  | { status: 'error' };

export type DashboardPlanVM = {
  /** Net worth by year from this year to the plan's end age (engine plan()). */
  points: PlanPointVM[];
  retireAge: number;
  endAge: number;
  netWorthAtRetirement: Money;
  /** First age the money runs out; null = it lasts. */
  shortfallAge: number | null;
  /** 'today' = in today's dollars; 'future' = nominal. */
  display: 'today' | 'future';
  chance: ChanceVM;
};

/** A recurring bill still due this month. */
export type UpcomingBillVM = RecurringItemVM & {
  /** 'YYYY-MM-DD' it falls on this month. */
  date: string;
};

export type GoalProgressVM = {
  id: string;
  name: string;
  saved: Money;
  target: Money;
  /** saved / target, 0 or more. */
  savedShare: number;
  status: SaveUpGoalStatus | null;
};

export type TopMoveVM = {
  id: string;
  kind: MoveKind;
  /** The spending category it is about, for a category cut. */
  category?: CostCategory;
  /** Net worth added in 10 years, in today's dollars (a rules-based estimate). */
  effect10y: Money;
};

export type DashboardVM = {
  /** False until saved state is loaded (always true on fixtures). */
  ready: boolean;
  greeting: { part: GreetingPart };
  checklist: {
    items: ChecklistItemVM[];
    done: number;
    total: number;
    dismissed: boolean;
    /** Show the card: not dismissed and something left to do. */
    visible: boolean;
  };
  netWorth: {
    /** Assets - liabilities, excluded accounts left out. */
    value: Money;
    /** Over the last month, like for like; null when no account had a balance a month back. */
    change1m: Money | null;
    /** History, oldest first, ending this month. Empty without accounts. */
    sparkline: BalancePointVM[];
    /** The same history cut to each period of the card's selector. */
    periods: Record<NetWorthPeriod, NetWorthPeriodVM>;
    hasAccounts: boolean;
  };
  spending: {
    /** Spent so far this month: money out of spending categories (refunds are not netted). */
    thisMonth: Money;
    /** Spent in the whole of last month. */
    lastMonth: Money;
    /** Spent in last month up to the same day: the fair comparison with `thisMonth`. */
    lastMonthToDate: Money;
    /** 'YYYY-MM' of the month on the card and of the one before. */
    month: YearMonth;
    previousMonth: YearMonth;
    points: SpendingPointVM[];
    /** No spending line in either month. */
    empty: boolean;
  };
  budget: {
    hasBudget: boolean;
    /** The 3 lines furthest over (or closest to over) this month, most overspent first; empty without a budget. */
    rows: BudgetRowVM[];
    /** Essentials, lifestyle, debt this month; groups with nothing planned and nothing spent are left out. Empty without a budget. */
    groups: BudgetGroupBarVM[];
    /** Over every cost category this month. */
    totals: { planned: Money; actual: Money; remaining: Money };
    /** How far into the month today is, 0..1. */
    todayMarker: number;
  };
  /** The active scenario's plan to its end age and its Chance of success; null until the plan can be computed. */
  plan: DashboardPlanVM | null;
  /** The best next move by 10-year effect; null when there is none. */
  topMove: TopMoveVM | null;
  /** Today's Duel in this browser: rounds picked of `total`. `streak` is a placeholder (no store records it yet). */
  duel: { playedToday: boolean; played: number; total: number; streak: number };
  recurring: {
    /** Expense and card items still due this month (due day today or later), soonest first, at most 5. */
    upcoming: UpcomingBillVM[];
    /** Sum of every item still due this month (not only the 5 shown). */
    remainingDue: Money;
    /** Nothing recurring at all: show the empty state. */
    empty: boolean;
  };
  /** Save up goals, in the order they were added. */
  goals: GoalProgressVM[];
  /** The 5 newest lines. */
  recentTransactions: TransactionRowVM[];
  links: PlannerLinks;
  /** Hides the setup checklist for good. */
  dismissChecklist: () => void;
};
