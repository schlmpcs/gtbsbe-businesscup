// View-model contract of the Goals screen (MP11, #171). ui/ may import only this file, @/ui-kit/**
// and @/copy (lint-enforced). Hooks: useGoals (./useGoals.ts) for "Save up"; "Pay down" is the existing
// Loan Lab and payoff planner view-models, re-exported from ./payDown.ts (their types below).
// Units: Money is unrounded US dollars (`target`, `saved`, `gap` are balances; `monthlyToStayOnTrack` is
// per month, in today's dollars); `years` counts from now; `progress` and `savedShare` are ratios.
// Names: copy.goals (statuses and labels). Goal names are typed by the person and stay in this browser.
// The numbers are a rules-based estimate (an "educational simulation, not financial advice").
import type { ForecastPoint, GoalVerdict, Money } from '@lifeguessr/types';
import type { Loadable } from '@/lib/model/types';
import type { TransactionRowVM } from '@/features/transactions/model/types';

export type { ForecastPoint, GoalVerdict, Money } from '@lifeguessr/types';
export type { Loadable, VMError } from '@/lib/model/types';
export type { TransactionRowVM } from '@/features/transactions/model/types';
// Pay down: the Loan Lab and the payoff planner, unchanged (features/loan/model).
export type {
  ExtraPaymentVM, LinkComponent, LoanLabVM, LoanOfferVM, PayoffChartVM, PayoffChoice, PayoffColumnVM, PayoffOrderRowVM, PayoffPlannerVM,
  PayoffPlanVM, PayoffStepVM, PayoffTargetVM,
} from '@/features/loan/model/types';

export type SaveUpGoalStatus = 'onTrack' | 'atRisk' | 'completed';

/** The engine's reading of a goal (`goalStatus`, `extraSavingToReach`): net worth against the target at the goal's date. */
export type GoalProjectionVM = {
  verdict: GoalVerdict;
  /** Projected net worth at the goal's date, in today's dollars, with its low-high range. */
  projected: ForecastPoint;
  /** target - projected.mid (a balance; negative = ahead of the target). */
  gap: Money;
  /** projected.mid / target. */
  progress: number;
  /** Extra saving per month that reaches the target on time (0 when already on track). */
  monthlyToStayOnTrack: Money;
  /** False when even all the take-home pay would not reach it. */
  reachable: boolean;
};

export type SaveUpGoalVM = {
  id: string;
  /** What the person called it. */
  name: string;
  target: Money;
  years: number;
  /** The sum of the transactions counted toward this goal (absolute amounts). */
  saved: Money;
  /** saved / target, 0 or more. */
  savedShare: number;
  /** Completed once `saved` reaches `target`; otherwise on track or at risk by the projection. Null while the projection failed. */
  status: SaveUpGoalStatus | null;
  /** Null for a completed goal (nothing left to project). */
  projection: Loadable<GoalProjectionVM | null>;
  /** The lines counted toward it, newest first. */
  transactions: TransactionRowVM[];
};

export type NewGoalInput = { name: string; target: Money; years: number };

export type GoalsVM = {
  /** False until saved state is loaded (always true on fixtures). */
  ready: boolean;
  goals: SaveUpGoalVM[];
  /** The last `addGoal` was refused (blank name, target <= 0, years not a whole number from 1 to 30). */
  inputError: boolean;
  /** Adds a goal; returns its id, or null when the input is invalid. */
  addGoal: (input: NewGoalInput) => string | null;
  /** Counts a transaction toward a goal (`saved` adds its absolute amount); false for an unknown goal or line. */
  allocate: (goalId: string, transactionId: string) => boolean;
  /** Removes a goal; its transactions stay, no longer counted toward it. */
  remove: (goalId: string) => void;
};
