// View-model types for the forecast feature (S1, S10). Tasks: Y7 (model) / Y10 (ui).
// ui/ may import only this file, @/ui-kit/** and @/copy (lint-enforced).
// Hooks: useToday (S1) in ./useToday.ts, useFuture (S10) in ./useFuture.ts.
import type { CostCategory, ForecastPoint, Money, Move } from '@lifeguessr/types';
import type { EstimatedField, EstimatedMoney, Loadable, VMError } from '@/lib/model/types';
import type { ProfileOrigin } from '@/state';

export type { EstimatedField, EstimatedMoney, Loadable, VMError } from '@/lib/model/types';
export type { ProfileOrigin } from '@/state';

/** A Next Move as the UI shows it. Copy comes from `kind` (+ `category`). */
export type MoveVM = Move & {
  /** `move.id === profile.committedMoveId`. */
  isCommitted: boolean;
};

/** The ranked moves (engine rankMoves, top 3) and the unlock state. */
export type NextMovesVM = {
  moves: Loadable<MoveVM[]>;
  /** Highest unlocked level (engine movesLevel): 2 once a level 1 move is done or committed. */
  level: 1 | 2;
  doneCount: number;
  commit: (moveId: string) => void;
  uncommit: () => void;
  /** The user did it: the move's patch enters the profile; the list re-ranks. */
  markDone: (moveId: string) => void;
};

/** S1 month-end card (engine monthEnd). */
export type MonthEndVM = {
  projectedSpend: Money;
  /** Projection − 3-month average; null until ≥ 3 months of statements. */
  vsAverage: Money | null;
  drifts: { category: CostCategory; delta: Money }[];
  /** Uploaded statement months available. */
  historyMonths: number;
  /** False = no current-month statement data: the card shows the profile's implied spend only. */
  fromStatement: boolean;
  takeHome: EstimatedMoney;
};

/** S1 Today. */
export type TodayVM = {
  status: 'loading' | 'ready';
  profileOrigin: ProfileOrigin;
  /** Still the sample profile: nudge to the ladder (S5). */
  isDemoProfile: boolean;
  monthEnd: Loadable<MonthEndVM>;
  /** Net worth in 10 years, today's dollars, with the range band. */
  in10y: ForecastPoint;
  /** The move the user committed to, if any. */
  committedMove: MoveVM | null;
  /** Mark the committed move done. */
  markCommittedDone: () => void;
  /** Best move right now (first of rankMoves), or why there is none. */
  topMove: Loadable<MoveVM | null>;
  /** Daily game call to action. */
  game: { date: string | null; played: number; total: number; finished: boolean };
};

/** S10 You in 10 years + Next Moves. */
export type FutureVM = NextMovesVM & {
  status: 'loading' | 'ready' | 'error';
  error: VMError | null;
  todaysDollars: boolean;
  setTodaysDollars: (on: boolean) => void;
  /** Monthly points, month 0 (today) to 120, for the chart and its range band. */
  points: ForecastPoint[];
  /** One point per year (months 0, 12, …, 120). */
  yearly: ForecastPoint[];
  today: ForecastPoint;
  in10y: ForecastPoint;
  /** The band shows only uncertainty in estimated inputs; it is zero when nothing is estimated. */
  band: { isZero: boolean; estimatedFields: EstimatedField[] };
  /** In-10-years with the committed move applied, for a "with your move" line. */
  committedPreview: { moveId: string; in10y: ForecastPoint } | null;
};
