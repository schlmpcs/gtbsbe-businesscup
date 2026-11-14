// View-model types for the forecast feature (S1, S10). Tasks: Y7 (model) / Y10 (ui).
// ui/ may import only this file, @/ui-kit/** and @/copy (lint-enforced).
// Hooks: useToday (S1) in ./useToday.ts, useFuture (S10) in ./useFuture.ts.
import type { CostCategory, ForecastPoint, Money, Move, MoveKind, Rate, Source } from '@lifeguessr/types';
import type { EstimatedField, EstimatedMoney, Loadable, VMError } from '@/lib/model/types';
import type { ProfileOrigin } from '@/state';

export type { EstimatedField, EstimatedMoney, Loadable, VMError } from '@/lib/model/types';
export type { ProfileOrigin } from '@/state';
export type { CostCategory, ForecastPoint, Money, MoveKind, Source } from '@lifeguessr/types';

/** A Next Move as the UI shows it. Copy comes from `kind` (+ `category`). */
export type MoveVM = Move & {
  /** `move.id === profile.committedMoveId`. */
  isCommitted: boolean;
  /** What the move sets, read from its patch, for a one-line detail. Null when the patch has neither. */
  target: MoveTarget | null;
};

/** The concrete change a move makes: a monthly extra debt payment, or a category's new monthly amount. */
export type MoveTarget =
  | { kind: 'extraPayment'; debtId: string; monthly: Money }
  | { kind: 'spendingTo'; category: CostCategory; monthly: Money };

/** The ranked moves (engine rankMoves, top 3) and the unlock state. */
export type NextMovesVM = {
  moves: Loadable<MoveVM[]>;
  /** Highest unlocked level (engine movesLevel): 2 once a level 1 move is done or committed. */
  level: 1 | 2;
  /** Move kinds of level 2 (engine MOVE_LEVELS), for the locked / coming-soon preview. */
  level2Kinds: MoveKind[];
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

/** One of today's game homes, as the public card shows it before a guess (no cost facts). */
export type TodayHomeVM = { id: string; metro: string; played: boolean };

/** S1 Today. */
export type TodayVM = {
  status: 'loading' | 'ready';
  profileOrigin: ProfileOrigin;
  /** Still the sample profile: nudge to the ladder (S5). */
  isDemoProfile: boolean;
  monthEnd: Loadable<MonthEndVM>;
  /** Net worth in 10 years, today's dollars, with the range band. */
  in10y: ForecastPoint;
  /** True when no input is an estimate: low = mid = high, so there is no range to show. */
  in10yBandIsZero: boolean;
  /** The move the user committed to, if any. */
  committedMove: MoveVM | null;
  /** Mark the committed move done. */
  markCommittedDone: () => void;
  /** Best move right now (first of rankMoves), or why there is none. */
  topMove: Loadable<MoveVM | null>;
  /** Daily game call to action. */
  game: {
    date: string | null;
    played: number;
    total: number;
    finished: boolean;
    /** Today's homes in play order, once the day is loaded (empty before the first visit to /play). */
    homes: TodayHomeVM[];
  };
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
  /**
   * The move the chart can compare against: the committed move while it is ranked, otherwise the
   * top-ranked move. Null when there is no move.
   */
  compareMove: MoveVM | null;
  /** Whether the chart shows the "with this move" line. */
  compareOn: boolean;
  setCompareOn: (on: boolean) => void;
  /** The forecast with `compareMove`'s patch applied (same rates and dollars); null while off. */
  withMove: { moveId: string; points: ForecastPoint[]; in10y: ForecastPoint } | null;
  /** "Why?" text per move id (POST /api/ai/explain); absent until asked for that move. */
  explanations: Record<string, Loadable<ExplanationVM>>;
  /** Ask for the explanation of one move (again, after an error). */
  explain: (moveId: string) => void;
  /** The engine assumptions behind these numbers, for the "How we calculate" panel. */
  howWeCalculate: HowWeCalculateVM;
};

/** Two plain sentences about a move. `fromAi` = written by the model, else the server's template. */
export type ExplanationVM = { text: string; fromAi: boolean };

/** How an assumption's value is shown. Rates and shares are decimals (0.06 = 6%). */
export type AssumptionValue =
  | { kind: 'ratePerYear'; value: Rate }
  | { kind: 'share'; value: number }
  | { kind: 'spread'; value: number }
  | { kind: 'money'; value: Money }
  | { kind: 'sameAsInflation' }
  | { kind: 'cardMinPayment'; balanceShare: number; floor: Money };

/** One line of "How we calculate". `isAssumption` = our default, not a published figure. */
export type AssumptionVM = {
  id:
    | 'inflation' | 'incomeGrowth' | 'returnAnnualNominal' | 'cashYieldAnnual' | 'cardAprDefault' | 'cardMinPayment'
    | 'retirementShareDefault' | 'estimateSpread'
    | 'payCardExtraShareOfSurplus' | 'payCardExtraStep' | 'cutCategoryShare' | 'cancelSubscriptionsShare';
  value: AssumptionValue;
  source: Source | null;
  isAssumption: boolean;
};

/** The assumptions behind the forecast and behind Next Moves. */
export type HowWeCalculateVM = { forecast: AssumptionVM[]; moves: AssumptionVM[] };
