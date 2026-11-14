// View-model contract of the Dashboard (MP11, #171). ui/ may import only this file, @/ui-kit/** and
// @/copy (lint-enforced). Hook: useDashboard (./useDashboard.ts), which reads the same data as the
// Accounts, Transactions, Budget and Recurring hooks.
// Units: Money is unrounded US dollars (a balance for net worth, a month's sum for spending); ratios
// are 0..1. Names: copy.dashboard (greeting, checklist[labelKey], card titles), copy.planner and
// copy.budget (categories, statuses). Net worth and the plan figure are estimates from the person's
// inputs ("educational simulation, not financial advice").
import type { CostCategory, MoveKind, Money, Rate, YearMonth } from '@lifeguessr/types';
import type { BalancePointVM } from '@/features/accounts/model/types';
import type { BudgetRowVM } from '@/features/budget/model/types';
import type { TransactionRowVM } from '@/features/transactions/model/types';
import type { PlannerLinks } from './links';

export type { CostCategory, MoveKind, Money, Rate, YearMonth } from '@lifeguessr/types';
export type { BalancePointVM } from '@/features/accounts/model/types';
export type { BudgetRowVM } from '@/features/budget/model/types';
export type { TransactionRowVM } from '@/features/transactions/model/types';
export type { PlannerLinks } from './links';

export type GreetingPart = 'morning' | 'afternoon' | 'evening';

export type ChecklistId = 'duel' | 'guess' | 'accounts' | 'csv' | 'planEvent';
/** Key into copy.dashboard.checklist. */
export type ChecklistLabelKey = 'playedDuel' | 'guessedOwnMonth' | 'addedAccounts' | 'importedCsv' | 'createdPlanEvent';

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
  };
  budget: {
    hasBudget: boolean;
    /** The 3 lines furthest over (or closest to over) this month, most overspent first; empty without a budget. */
    rows: BudgetRowVM[];
  };
  /** The last Chance run's success rate, or "Run" when there is none. */
  plan: { status: 'result'; successRate: Rate } | { status: 'run' };
  /** The best next move by 10-year effect; null when there is none. */
  topMove: TopMoveVM | null;
  duel: { playedToday: boolean; streak: number };
  /** The 5 newest lines. */
  recentTransactions: TransactionRowVM[];
  links: PlannerLinks;
  /** Hides the setup checklist for good. */
  dismissChecklist: () => void;
};
