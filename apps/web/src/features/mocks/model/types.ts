// View-model types for the mocks feature: S13 Decision (the car) and S14 Monthly check-in. Task: T11.
// (S15, the paywall, is the pro feature.) ui/ may import only this file, @/ui-kit/** and @/copy
// (lint-enforced). Hooks: useDecision() in ./useDecision.ts, useCheckin() in ./useCheckin.ts.
//
// "Mock" means the feature is a preview (nothing is saved, no reminders), not that its numbers are
// made up: every number here comes from @lifeguessr/engine on the user's profile, or on a fixture
// that the screen labels as sample data.
import type { AffordResult, CostCategory, ForecastPoint, MonthEnd, Money, Rate } from '@lifeguessr/types';
import type { DebtLoadGaugeVM } from '@/lib/model/profile';
import type { Loadable } from '@/lib/model/types';
import type { MoveVM } from '@/features/forecast/model/types';

export type { DebtLoadGaugeVM, DebtLoadZone } from '@/lib/model/profile';
export type { Loadable, VMError } from '@/lib/model/types';
export type { MoveTarget, MoveVM } from '@/features/forecast/model/types';
export type { CostCategory, ForecastPoint, MonthEnd, Money, MoveKind } from '@lifeguessr/types';

/** Where the preview note sends a free user, and whether to show it. */
export type ProPreviewVM = { isPro: boolean; href: string };

// ----- S13 Decision ---------------------------------------------------------------------------

/** The decisions F10 lists. Only the car is built; the rest show as coming with Pro. */
export type DecisionKind = 'car' | 'moving' | 'kid' | 'jobOffer' | 'wedding';

export type DecisionPathId = 'A' | 'B';

/** One way to get the car. `null` = the box is empty. Loan fields are ignored when paying cash. */
export type CarPathForm = {
  price: Money | null;
  payWith: 'loan' | 'cash';
  downPayment: Money;
  apr: Rate | null;
  termMonths: number | null;
  fees: Money;
};

/** What one path does, all from the engine on the user's profile. */
export type DecisionPathResultVM = {
  /** canAfford: buying it now as chosen. */
  verdict: AffordResult['verdict'];
  waitMonths: number | null;
  failsOn: AffordResult['failsOn'] | null;
  baselineFails: boolean;
  /** loan(): the monthly payment; null when paying cash. */
  monthly: Money | null;
  /** loan(): 0 when paying cash. */
  totalInterest: Money;
  /** Everything paid for the car: down payment, fees and interest included (the price when paying cash). */
  totalCost: Money;
  /** loan(): months to pay off; null = the payment never covers the interest. Null when paying cash. */
  payoffMonth: number | null;
  /** Required debt payments / take-home pay with this path. */
  debtLoad: DebtLoadGaugeVM;
  /** Net worth, month 0–120, in today's dollars, with the car bought now as chosen. */
  points: ForecastPoint[];
  in10y: ForecastPoint;
  /** in10y.mid − keeping your current car's in10y.mid (negative = the path costs you net worth). */
  vsKeep10y: Money;
};

export type DecisionPathVM = {
  id: DecisionPathId;
  form: CarPathForm;
  /** Form fields that are invalid: 'price', 'apr', 'termMonths', 'downPayment', 'fees'. */
  invalidFields: string[];
  /** Null while the form is invalid. */
  result: Loadable<DecisionPathResultVM> | null;
};

/** Keeping the car you have: the plan as it is. */
export type KeepCarVM = { points: ForecastPoint[]; in10y: ForecastPoint; debtLoad: DebtLoadGaugeVM };

export type DecisionVM = {
  status: 'loading' | 'ready';
  /** Every decision type in order; `available` = built (the car). */
  kinds: { id: DecisionKind; available: boolean }[];
  kind: 'car';
  keep: Loadable<KeepCarVM>;
  paths: [DecisionPathVM, DecisionPathVM];
  setPath: (id: DecisionPathId, patch: Partial<CarPathForm>) => void;
  /** Back to the sample paths. */
  resetPaths: () => void;
  /**
   * Which path leaves more net worth in 10 years (mid, today's dollars) and by how much (≥ 0).
   * Null until both paths have a result.
   */
  comparison: { leader: DecisionPathId | 'tie'; gap10y: Money } | null;
  /** Some input behind the forecasts is an estimate (the band is not zero). */
  forecastIsEstimate: boolean;
  /** Debt load inputs are estimates (take-home pay or a minimum payment). */
  debtLoadIsEstimate: boolean;
  /** Thresholds the verdict copy names (canAfford's rules). */
  rules: { cushionMonths: number; debtLoadRed: Rate };
  pro: ProPreviewVM;
};

// ----- S14 Monthly check-in -------------------------------------------------------------------

export type CheckinStep = 'month' | 'move' | 'future';

/** Statement months the check-in reads: the user's uploads, or the sample statement (labelled). */
export type CheckinDataSource = 'uploads' | 'sample';

/** Step 1: the month under review against the average of the months before it (engine monthEnd). */
export type CheckinMonthVM = {
  source: CheckinDataSource;
  /** The user has uploaded at least one statement month. */
  hasUploads: boolean;
  /** 'YYYY-MM' of the month under review; null = no statement month (profile spending only). */
  month: string | null;
  /** The month under review is the current calendar month (projected from the days so far). */
  inProgress: boolean;
  /** Full months before it (monthEnd needs 3 for the average and drift flags). */
  historyMonths: number;
  historyNeeded: number;
  result: Loadable<MonthEnd>;
  /** Take-home pay: from the profile, or the sample statement's paychecks for the month. */
  takeHome: { value: Money; isEstimate: boolean } | null;
};

/** What the committed move is doing, from the engine. */
export type MoveProgressVM =
  | {
      kind: 'cardPayoff';
      debtId: string;
      /** Months until the card is paid off with / without the move (null = not within 10 years). */
      payoffMonthWith: number | null;
      payoffMonthWithout: number | null;
    }
  | {
      kind: 'spendingTarget';
      category: CostCategory;
      /** The move's monthly target for the category. */
      target: Money;
      /** The category's monthly amount in the profile now. */
      planned: Money;
      /** What the user's statement shows for the month under review (null without an upload). */
      actual: Money | null;
      /** actual ≤ target (null without an upload). */
      onTrack: boolean | null;
    };

/** This check-in's answer about the move: none yet, done (its patch entered the plan), or keep going. */
export type CheckinMoveAnswer = 'none' | 'done' | 'keepGoing';

export type CheckinMoveVM = {
  /** The move the user committed to (null = none). */
  committed: MoveVM | null;
  progress: Loadable<MoveProgressVM | null> | null;
  /** Ranked moves to commit to when there is none (engine rankMoves). */
  suggestions: Loadable<MoveVM[]>;
  answer: CheckinMoveAnswer;
  /** The move just marked done in this check-in (shown after the answer). */
  doneMove: MoveVM | null;
  /** Highest unlocked move level (engine movesLevel). */
  level: 1 | 2;
  commit: (moveId: string) => void;
  markDone: () => void;
  keepGoing: () => void;
};

/** Step 3: the 10-year forecast after this check-in (today's dollars), with the committed move. */
export type CheckinFutureVM = {
  points: ForecastPoint[];
  in10y: ForecastPoint;
  bandIsZero: boolean;
  /** The forecast with the committed move applied; null without a committed move. */
  withMove: { move: MoveVM; points: ForecastPoint[]; in10y: ForecastPoint } | null;
};

export type CheckinVM = {
  status: 'loading' | 'ready';
  steps: readonly CheckinStep[];
  step: CheckinStep;
  goTo: (step: CheckinStep) => void;
  next: () => void;
  back: () => void;
  /** The user finished the last step: show the summary. */
  finished: boolean;
  finish: () => void;
  restart: () => void;
  month: CheckinMonthVM;
  setSource: (source: CheckinDataSource) => void;
  move: CheckinMoveVM;
  future: Loadable<CheckinFutureVM>;
  pro: ProPreviewVM;
};
