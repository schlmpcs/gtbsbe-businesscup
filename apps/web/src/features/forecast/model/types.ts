// View-model types for the forecast feature (S1, S10). Tasks: Y7 (model) / Y10 (ui).
// ui/ may import only this file, @/ui-kit/** and @/copy (lint-enforced).
// Hooks: useToday (S1) in ./useToday.ts, useFuture (S10) in ./useFuture.ts.
import type { MoveCandidate } from '@lifeguessr/engine';
import type {
  CostCategory, ForecastBundle, ForecastPoint, ForecastSource, Money, Move, MoveKind, Profile, Rate, Source,
} from '@lifeguessr/types';
import type { EstimatedField, EstimatedMoney, Loadable, VMError } from '@/lib/model/types';
import type { ProfileOrigin } from '@/state';

export type { EstimatedField, EstimatedMoney, Loadable, VMError } from '@/lib/model/types';
export type { ProfileOrigin } from '@/state';
export type { CostCategory, ForecastPoint, ForecastSource, Money, MoveKind, Source } from '@lifeguessr/types';

/**
 * What the 10-year range band is made of: 'inputs' = the numbers we estimated (rules forecast),
 * 'model' = the AI forecaster's own uncertainty.
 */
export type BandKind = 'inputs' | 'model';

/** A forecast bundle with what it answered: the profile and the candidate moves that were asked about. */
export type ForecastAnswer = { bundle: ForecastBundle; profile: Profile; candidates: MoveCandidate[] };

/**
 * The 10-year forecast of S1 and S10 (POST /api/ai/forecast, else the local rules engine).
 * 'ready' always holds an answer, labeled by `source`. `isRefreshing`: the profile changed and
 * `answer` is still the previous one while the new one is on its way.
 */
export type ForecastState =
  | { status: 'loading' }
  | { status: 'ready'; source: ForecastSource; answer: ForecastAnswer; isRefreshing: boolean }
  | { status: 'error'; error: VMError };

/** A Next Move as the UI shows it. Copy comes from `kind` (+ `category`). */
export type MoveVM = Move & {
  /** `move.id === profile.committedMoveId`. */
  isCommitted: boolean;
  /** What the move sets, read from its patch, for a one-line detail. Null when the patch has neither. */
  target: MoveTarget | null;
  /**
   * Where `effect10y` came from: the forecast the ranking used. Null for a stored committed move
   * that is not in the current ranking (its number is the one frozen when it was committed).
   */
  source: ForecastSource | null;
};

/** The concrete change a move makes: a monthly extra debt payment, or a category's new monthly amount. */
export type MoveTarget =
  | { kind: 'extraPayment'; debtId: string; monthly: Money }
  | { kind: 'spendingTo'; category: CostCategory; monthly: Money };

/** The ranked moves (engine rankCandidates over the forecast's scenarios, top 3) and the unlock state. */
export type NextMovesVM = {
  moves: Loadable<MoveVM[]>;
  /** The forecast the ranking and the screen's numbers come from. */
  forecast: ForecastState;
  /**
   * True until the forecast for the current profile has arrived (first load, or a refresh): the moves on
   * screen are then the previous answer's, so `commit` and `markDone` do nothing and their buttons are disabled.
   */
  actionsDisabled: boolean;
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

/** S1 Today. */
export type TodayVM = {
  /** Saved state loaded. The 10-year number has its own `forecastStatus`: it may take a while. */
  status: 'loading' | 'ready';
  profileOrigin: ProfileOrigin;
  /** Still the sample profile: nudge to the ladder (S5). */
  isDemoProfile: boolean;
  monthEnd: Loadable<MonthEndVM>;
  /** 'loading' until the first forecast arrives (up to the client timeout); 'error' only when nothing could be computed. */
  forecastStatus: 'loading' | 'ready' | 'error';
  forecastError: VMError | null;
  /** Who made the 10-year number: the AI forecaster or the rules engine. Null until there is one. */
  source: ForecastSource | null;
  /** Net worth in 10 years, today's dollars, with the range band (a zero point until `forecastStatus` is 'ready'). */
  in10y: ForecastPoint;
  /** True when the band has no width (no estimated input for the rules, a single number from the model). */
  in10yBandIsZero: boolean;
  /** What the band means: the numbers we estimated, or the model's own uncertainty. */
  in10yBandKind: BandKind;
  /** The move the user committed to, if any. */
  committedMove: MoveVM | null;
  /** Mark the committed move done. Does nothing while `actionsDisabled`. */
  markCommittedDone: () => void;
  /** The forecast is loading or refreshing: the move buttons are disabled (see NextMovesVM.actionsDisabled). */
  actionsDisabled: boolean;
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
  /** Who made the numbers on screen (also on each move). Null until there is an answer. */
  source: ForecastSource | null;
  /** The profile changed and the numbers on screen are the previous answer, until the new one arrives. */
  isRefreshing: boolean;
  /**
   * 'inputs' (rules forecast): the band shows only uncertainty in estimated inputs, zero when nothing is
   * estimated. 'model' (AI forecast): the model's own range, zero when it gave a single number.
   */
  band: { isZero: boolean; kind: BandKind; estimatedFields: EstimatedField[] };
  /** In-10-years with the committed move applied (from the same answer), for a "with your move" line. */
  committedPreview: { moveId: string; in10y: ForecastPoint } | null;
  /**
   * The move the chart can compare against: the committed move while it is ranked, otherwise the
   * top-ranked move. Null when there is no move.
   */
  compareMove: MoveVM | null;
  /** Whether the chart shows the "with this move" line. */
  compareOn: boolean;
  setCompareOn: (on: boolean) => void;
  /** The forecast with `compareMove`'s patch applied (same answer and dollars); null while off. */
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
