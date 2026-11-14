// View-model types for the forecast feature (S1, S10). Tasks: Y7 (model) / Y10 (ui).
// ui/ may import only this file, @/ui-kit/** and @/copy (lint-enforced).
// Hooks: useToday (S1) in ./useToday.ts, useFuture (S10) in ./useFuture.ts.
import type { CushionBand, MoveCandidate } from '@lifeguessr/engine';
import type {
  Goal, GoalStatus, GoalVerdict, SavingToReach, MovesTowardGoal, CostCategory, ForecastBundle, ForecastPoint, ForecastSource, HorizonYears,
  LifeEventKind, LifeEventPreset, Money, Move, MoveKind, Profile, Rate, Source, YearMonth,
} from '@lifeguessr/types';
import type { EstimatedField, EstimatedMoney, Loadable, VMError } from '@/lib/model/types';
import type { FoldedNote, LifeEventCategory, ProfileOrigin } from '@/state';
import type { SpendSummaryVM } from '@/features/spend/model/types';
import type { NextBillVM } from '@/features/bills/model/types';

export type { EstimatedField, EstimatedMoney, Loadable, VMError } from '@/lib/model/types';
export type { FoldedNote, LifeEventCategory, ProfileOrigin } from '@/state';
export type { SpendSummaryVM } from '@/features/spend/model/types';
export type {
  CostCategory, ForecastPoint, ForecastSource, HorizonYears, LifeEventKind, LifeEventPreset, Money, MoveKind, Source, YearMonth,
} from '@lifeguessr/types';

/**
 * What the range band is made of: 'inputs' = the numbers we estimated (rules forecast),
 * 'model' = the AI forecaster's own uncertainty.
 */
export type BandKind = 'inputs' | 'model';

/** A forecast bundle with what it answered: the profile and the candidate moves that were asked about. */
export type ForecastAnswer = { bundle: ForecastBundle; profile: Profile; candidates: MoveCandidate[] };

/**
 * The 10-year forecast of S1 and S10 (POST /api/ai/forecast, else the local rules engine).
 * 'ready' always holds an answer, labeled by `source`. `isRefreshing`: a newer answer is on its way.
 * `isStale` says whether `answer` is out of date for it: true when it answers another profile (the
 * profile changed, so its ids, patches and numbers are the previous one's); false when it answers
 * the current one and only the route's rules answer or the local fallback is being asked for again
 * to see whether the model is back (the numbers on screen are right, they may just get upgraded).
 */
export type ForecastState =
  | { status: 'loading' }
  | { status: 'ready'; source: ForecastSource; answer: ForecastAnswer; isRefreshing: boolean; isStale: boolean }
  | { status: 'error'; error: VMError };

/**
 * A Next Move as the UI shows it. Copy comes from `kind` (+ `category`). The number to show is `effect`
 * (at `horizonYears`); `effect10y` stays the 10-year effect from the same answer (what a commit stores).
 */
export type MoveVM = Move & {
  /** `move.id === profile.committedMoveId`. */
  isCommitted: boolean;
  /** What the move sets, read from its patch, for a one-line detail. Null when the patch has neither. */
  target: MoveTarget | null;
  /**
   * Where `effect` and `effect10y` came from: the forecast the ranking used. Null for a stored committed
   * move that is not in the current ranking (its number is the one frozen when it was committed).
   */
  source: ForecastSource | null;
  /**
   * Scenario − base net worth at `horizonYears`, today's dollars: what the list is ranked by. For a stored
   * committed move that is not ranked, its frozen `effect10y` (and `horizonYears` is 10).
   */
  effect: Money;
  /** The year `effect` is measured at. */
  horizonYears: HorizonYears;
};

/** The concrete change a move makes: a monthly extra debt payment, or a category's new monthly amount. */
export type MoveTarget =
  | { kind: 'extraPayment'; debtId: string; monthly: Money }
  | { kind: 'spendingTo'; category: CostCategory; monthly: Money };

/**
 * The ranked moves (engine rankCandidates over the forecast's scenarios by the effect at the chosen year,
 * top 3), the unlock state and the forecast horizon (one for the app, remembered in the store).
 */
export type NextMovesVM = {
  moves: Loadable<MoveVM[]>;
  /** The forecast the ranking and the screen's numbers come from. */
  forecast: ForecastState;
  /** The year the numbers and the ranking are read at (default 10). */
  horizonYears: HorizonYears;
  /**
   * False until the saved state is loaded: `horizonYears` is then the default (10), not necessarily the
   * user's pick, so screens show no year-specific title or intro yet, and the picker is off with no year
   * chosen (no "10 years" flash for someone who picked 3).
   */
  horizonReady: boolean;
  /** The years the picker offers (FORECAST_HORIZONS). */
  horizons: readonly HorizonYears[];
  /** Pick the year: reads the same answer again (no request); counted when it changes. */
  setHorizonYears: (years: HorizonYears) => void;
  /**
   * True until the forecast for the current profile has arrived (first load, or after the profile changed): the
   * moves on screen are then the previous profile's, so `commit` and `markDone` do nothing and their buttons are
   * disabled. Not true while only a background revalidation of the current profile's rules answer runs.
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
  /** Uploaded statement months before this one (the history the 3-month average needs). */
  historyMonths: number;
  /**
   * Why there is no comparison with the 3-month average (vsAverage is null), or null when there is:
   * 'history' = fewer than 3 statement months before this one; 'thisMonth' = the history is there,
   * but no uploaded statement has lines for this month yet.
   */
  noAverage: 'history' | 'thisMonth' | null;
  /** False = no current-month statement data: the card shows the profile's implied spend only. */
  fromStatement: boolean;
  /** This calendar month, 'YYYY-MM'. */
  month: string;
  /** Day of this month the projection runs to (the statement's latest line); null without one. */
  asOfDay: number | null;
  takeHome: EstimatedMoney;
};

/** One of today's game homes, as the public card shows it before a guess (no cost facts). */
export type TodayHomeVM = { id: string; metro: string; played: boolean };

/** S1 Today. */
export type TodayVM = {
  /** Saved state loaded. The forecast number has its own `forecastStatus`: it may take a while. */
  status: 'loading' | 'ready';
  /**
   * First visit: no profile of the user's own (nor the sample life asked for), nothing entered, no
   * home played. The screen shows what the app is (Play, Try with sample data) and no numbers.
   * False while loading.
   */
  firstVisit: boolean;
  /** The sample life ("Try with sample data") is on; the site-wide banner already says so. */
  isSample: boolean;
  profileOrigin: ProfileOrigin;
  /** Still the sample profile: nudge to the ladder (S5). */
  isDemoProfile: boolean;
  monthEnd: Loadable<MonthEndVM>;
  /** 'loading' until the first forecast arrives (up to the client timeout); 'error' only when nothing could be computed. */
  forecastStatus: 'loading' | 'ready' | 'error';
  forecastError: VMError | null;
  /** Who made the forecast number: the AI forecaster or the rules engine. Null until there is one. */
  source: ForecastSource | null;
  /** The year picked on S10 (store), which the number and the move gains are read at. */
  horizonYears: HorizonYears;
  /** False until the saved state is loaded (see NextMovesVM.horizonReady): no year-specific title yet. */
  horizonReady: boolean;
  /**
   * Net worth at `horizonYears`, today's dollars, with the range band (a zero point until `forecastStatus`
   * is 'ready').
   */
  atHorizon: ForecastPoint;
  /** True when the band has no width (no estimated input for the rules, a single number from the model). */
  bandIsZero: boolean;
  /** What the band means: the numbers we estimated, or the model's own uncertainty. */
  bandKind: BandKind;
  /** The move the user committed to, if any. */
  committedMove: MoveVM | null;
  /** Mark the committed move done. Does nothing while `actionsDisabled`. */
  markCommittedDone: () => void;
  /**
   * A newer answer is on its way (the profile changed, or a rules answer is being asked for again): the
   * number on screen may be the previous one's. Same flag as FutureVM.isRefreshing.
   */
  isRefreshing: boolean;
  /** The forecast is loading or out of date for the profile: the move buttons are disabled (see NextMovesVM.actionsDisabled). */
  actionsDisabled: boolean;
  /** Best move right now at the chosen year (first of the ranking), or why there is none. */
  topMove: Loadable<MoveVM | null>;
  /** Add a ranked move to the plan (same action as S10). Does nothing while `actionsDisabled`. */
  commit: (moveId: string) => void;
  /** Take the committed move out of the plan. */
  uncommit: () => void;
  /**
   * The saved net worth goal and its verdict (engine goalStatus, the rules forecast in today's dollars,
   * same as S10's goal card). Null without a goal, or when it could not be computed.
   */
  goal: { target: Money; years: number; verdict: GoalVerdict } | null;
  /** At least one input the forecast reads is an estimate (the "Make it exact" nudge). */
  hasEstimates: boolean;
  /** Emergency cushion: months cash covers with zero income (engine emergencyCushion). */
  cushion: Loadable<CushionVM>;
  /** Daily game call to action. */
  game: {
    /** Which game /play is: the duel (rounds; the default) or the slider (homes). Picks the copy. */
    kind: 'duel' | 'slider';
    date: string | null;
    played: number;
    total: number;
    finished: boolean;
    /**
     * Today's homes in play order, once the day is loaded (empty before the first visit to /play).
     * Always empty for the duel: its rounds are pairs of lives, not homes.
     */
    homes: TodayHomeVM[];
  };
  /** The daily log's month so far (spent, usual, projected month end, safe to spend today). */
  daily?: Loadable<SpendSummaryVM>;
  /** The next bill due (bills calendar), or null when no bill is known. Optional: absent means none. */
  nextBill?: NextBillVM;
};

/**
 * The Home cushion card (engine emergencyCushion). Months are unrounded; null = no spending to cover.
 * `bands` = the guideline edges in months (assumption cushionBandMonths), for the meter.
 */
export type CushionVM = {
  monthsEssential: number | null;
  monthsFull: number | null;
  band: CushionBand;
  bands: { thin: number; okay: number; solid: number };
  /** The next band up and the extra cash it takes (null at 6+ or with nothing to cover). */
  next: { months: number; extraCash: Money } | null;
  /** Cash or an essential input is an estimate. */
  isEstimate: boolean;
};

/** S10 You in N years (the picked horizon) + Next Moves. */
/**
 * The "why" under the headline (rules engine, this month, the user's inputs): take-home pay vs
 * everything that goes out. `short` = outflow − income when positive, else 0. `cashRunsOutInMonths`:
 * the first month cash is gone while short (null when not short, or not within 10 years).
 */
export type WhyLineVM = {
  income: Money;
  outflow: Money;
  short: Money;
  cashRunsOutInMonths: number | null;
};

export type FutureVM = NextMovesVM & {
  status: 'loading' | 'ready' | 'error';
  error: VMError | null;
  todaysDollars: boolean;
  setTodaysDollars: (on: boolean) => void;
  /** Monthly points, month 0 (today) to 12·horizonYears, for the chart and its range band. */
  points: ForecastPoint[];
  /** One point per year (months 0, 12, …, 12·horizonYears). */
  yearly: ForecastPoint[];
  today: ForecastPoint;
  /** Net worth at `horizonYears` (month 12·horizonYears), in the shown dollars. */
  atHorizon: ForecastPoint;
  /** Why the number moves: pay vs outflow this month, and when cash runs out if short. */
  why: WhyLineVM;
  /** Who made the numbers on screen (also on each move). Null until there is an answer. */
  source: ForecastSource | null;
  /**
   * A newer answer is on its way: the profile changed and the numbers on screen are the previous one's, or
   * a rules answer is being asked for again in the background to see whether the model is back.
   */
  isRefreshing: boolean;
  /**
   * 'inputs' (rules forecast): the band shows only uncertainty in estimated inputs, zero when nothing is
   * estimated. 'model' (AI forecast): the model's own range, zero when it gave a single number.
   */
  band: { isZero: boolean; kind: BandKind; estimatedFields: EstimatedField[] };
  /** Net worth at `horizonYears` with the committed move applied (from the same answer), for a "with your move" line. */
  committedPreview: { moveId: string; point: ForecastPoint } | null;
  /**
   * The move the chart can compare against: the committed move while it is ranked, otherwise the
   * top-ranked move. Null when there is no move.
   */
  compareMove: MoveVM | null;
  /** Whether the chart shows the "with this move" line. */
  compareOn: boolean;
  setCompareOn: (on: boolean) => void;
  /**
   * The forecast with `compareMove`'s patch applied (same answer, dollars and months as `points`), and its
   * point at `horizonYears`; null while off.
   */
  withMove: { moveId: string; points: ForecastPoint[]; point: ForecastPoint } | null;
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

export type GoalVM = {
  goal: Goal | null;
  setGoal: (goal: Goal) => void;
  clearGoal: () => void;
  status: Loadable<GoalStatus | null>;
  saving: Loadable<SavingToReach | null>;
  moves: Loadable<MovesTowardGoal | null>;
  moveLabels: {id:string;kind:MoveKind;category?:CostCategory}[];
  inputError: boolean;
  presets: {targets:Money[];years:number[]};
};

// ----- S10 "Coming up": future life events (useLifeEvents) -----------------------------------

/**
 * What the event form edits. `category` is read only for a spending event and `direction` only for a
 * one-off; the others are kept so switching the kind back and forth loses nothing. `month` is '' and
 * `amount` null while empty. `preset` = the shortcut it came from (it only picks the label).
 */
export type LifeEventDraft = {
  kind: LifeEventKind;
  preset?: LifeEventPreset;
  month: YearMonth | '';
  amount: Money | null;
  category: LifeEventCategory;
  direction: 'cost' | 'income';
  /**
   * Our estimate of the amount (the kid shortcut's childcare prefill, or an estimated event being edited).
   * The saved value is an estimate only while `amount` is still exactly this; a typed amount is the person's.
   */
  estimatedAmount?: Money;
};

/** Why a draft cannot be saved, per field (absent = fine). */
export type LifeEventErrors = {
  month?: 'missing' | 'past' | 'tooFar';
  amount?: 'missing' | 'negative' | 'zero' | 'tooLarge';
  /** The store refused the event: the list is full (MAX_LIFE_EVENTS), or it could not be saved (e.g. it was removed meanwhile). */
  event?: 'full' | 'refused';
};

/** One planned event as the list shows it. */
export type LifeEventVM = {
  id: string;
  kind: LifeEventKind;
  preset?: LifeEventPreset;
  /** Its name in the list (from the shortcut, else kind and category or direction). */
  label: string;
  month: YearMonth;
  /** The new monthly pay or cost (pay, spending), or the one-off amount; today's dollars. */
  amount: Money;
  /** The amount is our estimate (the kid shortcut's childcare figure). */
  isEstimate: boolean;
  category?: LifeEventCategory;
  direction?: 'cost' | 'income';
  /** The event as a draft, to edit it. */
  draft: LifeEventDraft;
};

/** Where the kid shortcut's childcare figure comes from: the area's, or the median of our areas. */
export type KidChildcareVM =
  | { basis: 'area'; infantMonthly: Money; source: Source }
  | { basis: 'median'; infantMonthly: Money; source: Source; areaCount: number };

/** A shortcut button and the draft it opens, prefilled. */
export type LifeEventShortcutVM = {
  preset: LifeEventPreset;
  draft: LifeEventDraft;
  /** The kid shortcut only: the childcare figure added to today's childcare, and its source. */
  childcare?: KidChildcareVM;
};

/** A started event folded into today's numbers, with its line of text. */
export type FoldedNoteVM = FoldedNote & { text: string };

/** S10 "Coming up". */
export type LifeEventsVM = {
  status: 'loading' | 'ready';
  /** Planned events, by month (same month: in the order added). */
  events: LifeEventVM[];
  /** raise (today's take-home), kid (area infant childcare + today's), move (today's rent), big purchase (empty). */
  shortcuts: LifeEventShortcutVM[];
  /** "Something else": a blank monthly cost change. */
  custom: LifeEventDraft;
  /** The months an event may start in: next month to LIFE_EVENT_MAX_YEARS_AHEAD years ahead. */
  monthRange: { min: YearMonth; max: YearMonth };
  /** The years `monthRange.max` is ahead (LIFE_EVENT_MAX_YEARS_AHEAD), for the error text. */
  maxYearsAhead: number;
  /** Largest amount accepted per kind (sanity caps, as on the balance sheet). */
  amountMax: Record<LifeEventKind, Money>;
  /** The categories a monthly cost change may set (every one but debt payments: debts are modelled as debts). */
  categories: readonly LifeEventCategory[];
  /** Fewer than `maxEvents` events: the shortcuts can add one. */
  canAdd: boolean;
  maxEvents: number;
  /** Whether the draft's amount would be saved as an estimate (it is still our prefill). */
  isEstimate: (draft: LifeEventDraft) => boolean;
  /** Errors in a draft, or null when it can be saved. */
  validate: (draft: LifeEventDraft) => LifeEventErrors | null;
  /** Add the draft as a new event; returns its errors (nothing added) or null (added). */
  add: (draft: LifeEventDraft) => LifeEventErrors | null;
  /** Save the draft over event `id`; returns its errors (nothing saved) or null (saved). */
  update: (id: string, draft: LifeEventDraft) => LifeEventErrors | null;
  remove: (id: string) => void;
  /** Events that started since S10 last showed them (shown once). */
  foldedNotes: FoldedNoteVM[];
  dismissFolded: () => void;
};
