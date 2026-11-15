// View-model types for the mocks feature: S13 Decision (keep the car or lease) and S14 Monthly
// check-in. Task: T11 ("clickable on fixtures"). (S15, the paywall, is the pro feature.)
// ui/ may import only this file, @/ui-kit/** and @/copy (lint-enforced).
// Hooks: useDecide() in ./useDecide.ts, useCheckin() in ./useCheckin.ts.
//
// "Mock" means a preview (nothing is saved, no reminders), not made-up numbers: every number comes
// from @lifeguessr/engine on the user's profile (the demo profile until they build their own), from
// what they type, or from a fixture the screen labels (illustrative lease terms, sample statement).
import type { CostCategory, MonthEnd, Money, Rate } from '@lifeguessr/types';
import type { Loadable } from '@/lib/model/types';
import type { MoveVM } from '@/features/forecast/model/types';

export type { Loadable, VMError } from '@/lib/model/types';
export type { MoveTarget, MoveVM } from '@/features/forecast/model/types';
export type { CostCategory, MonthEnd, Money, MoveKind } from '@lifeguessr/types';

/** Where the preview note sends a free user. */
export type ProPreviewVM = { isPro: boolean; href: string };

// ----- S13 Decision: keep my car or switch -------------------------------------------------

/** Where a field's value comes from: the person's accounts / budget, a labelled example, or what they typed. */
export type FieldOrigin = 'accounts' | 'budget' | 'example' | 'typed';

/** The car the person drives today. Money: balances for value / loanBalance, per month otherwise; apr a decimal. */
export type CarField = 'value' | 'loanBalance' | 'loanPayment' | 'loanApr' | 'running';
/** What they would do instead. */
export type AlternativeKind = 'lease' | 'buy' | 'noCar';
export type AlternativeField = 'monthly' | 'termMonths' | 'dueAtSigning' | 'running' | 'price' | 'downPayment' | 'apr';

/** Why a field's value is refused (the screen words it). */
export type DecideFieldError = 'required' | 'negative' | 'tooLarge' | 'term' | 'apr' | 'downAbovePrice' | 'paymentTooLow';

/** One number box. `unit` tells the screen how to show it (money, money per month, a rate, months). */
export type DecideFieldVM<K extends string> = {
  key: K;
  value: number | null;
  unit: 'money' | 'monthly' | 'rate' | 'months';
  origin: FieldOrigin;
  /** The value is an estimate: an example, or a profile value that was itself estimated. */
  isEstimate: boolean;
  error: DecideFieldError | null;
  max: number;
};

/** One path's car cost in a month, split for the stacked bar (engine carDecision). */
export type CarCostVM = { payment: Money; running: Money; signing: Money; total: Money };

export type DecideResultVM = {
  better: 'keep' | 'alternative';
  /** |difference| at the horizon, today's dollars. */
  betterBy: Money;
  /** Within $500 at the horizon: call it a tie. */
  isClose: boolean;
  keepNetWorth: Money;
  alternativeNetWorth: Money;
  /** Net worth of both paths, one point per year (calendar year), today's dollars. */
  years: { year: number; keep: Money; alternative: Money }[];
  keepCost: CarCostVM;
  keepCostAfterPayoff: CarCostVM;
  /** Months until the car loan is paid off; 0 = no loan; null = not within 10 years. */
  keepPayoffMonths: number | null;
  alternativeCost: CarCostVM;
  /** Paid once up front: a new car's down payment (0 otherwise). */
  alternativeUpfront: Money;
  /** Lease signings within 10 years (0 otherwise). */
  signings: number;
  /** Car value − loan left (negative = paid from cash to clear the loan). */
  tradeInEquity: Money;
  isEstimate: boolean;
  source: 'rules';
};

/** "Add to my plan": the chosen path as an Expense event on the active /plan scenario. */
export type DecidePlanVM = {
  /** Which path the button adds (the better one by default; the person can pick). */
  path: 'keep' | 'alternative';
  setPath: (path: 'keep' | 'alternative') => void;
  /** Null = nothing to add for this path (keeping is already in the plan; no car lowers a budget line instead). */
  event: { kind: 'leaseExpense' | 'financedExpense'; amount: Money; year: number } | null;
  /** Why there is no event for this path. */
  noEventReason: 'keep' | 'noCar' | null;
  /** Net worth at retirement with the event − without it, on the active scenario (engine plan()). */
  impact: Loadable<{ atRetirement: Money; retireAge: number }> | null;
  scenarioName: string;
  added: boolean;
  add: () => void;
  href: string;
};

export type DecideVM = {
  status: 'loading' | 'ready';
  /** This calendar year and the year at the 10-year horizon. */
  startYear: number;
  horizonYear: number;
  /** Still the demo profile (sample numbers). */
  isDemoProfile: boolean;
  /** The car fields come from the person's accounts / budget (else every car field is an example). */
  carFromProfile: boolean;
  car: DecideFieldVM<CarField>[];
  setCar: (key: CarField, value: number | null) => void;
  resetCar: () => void;
  alternativeKind: AlternativeKind;
  setAlternativeKind: (kind: AlternativeKind) => void;
  alternative: DecideFieldVM<AlternativeField>[];
  setAlternative: (key: AlternativeField, value: number | null) => void;
  resetAlternative: () => void;
  /** Null while a field is refused. */
  result: Loadable<DecideResultVM> | null;
  plan: DecidePlanVM;
};

// ----- S14 Monthly check-in -------------------------------------------------------------------

/** Statement months the check-in reads: the user's uploads, or the sample statement (labelled). */
export type CheckinDataSource = 'uploads' | 'sample';

/** The month under review against the average of the 3 before it (engine monthEnd). */
export type CheckinMonthVM = {
  source: CheckinDataSource;
  /** The user has uploaded at least one statement month. */
  hasUploads: boolean;
  /** 'YYYY-MM' of the month under review; null = no statement month (profile spending only). */
  month: string | null;
  /** The month under review is the current calendar month (projected to its end). */
  inProgress: boolean;
  /** 'YYYY-MM' of the statement to add next (the month after the one under review, or this month). */
  nextStatementMonth: string;
  historyMonths: number;
  historyNeeded: number;
  result: Loadable<MonthEnd>;
};

/** Headline numbers from monthEnd (null until there are 3 months of history). */
export type CheckinCompareVM = {
  projected: Money;
  /** projected − vsAverage. */
  average: Money;
  /** vsAverage (positive = over). */
  difference: Money;
  /** By whole dollars. */
  direction: 'over' | 'under' | 'even';
  drifts: { category: CostCategory; delta: Money }[];
  /** Tile categories that did not drift. */
  onTrack: CostCategory[];
};

/** What the committed move is doing, from the engine. */
export type MoveProgressVM =
  | {
      kind: 'cardPayoff';
      debtId: string;
      /** The card balance today. */
      balance: Money;
      /** Paid off it by the end of this month with the move (engine simulate). */
      paidThisMonth: Money;
      /** paidThisMonth / balance, 0–1. */
      share: Rate;
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
      /** The user's own finished statement month for the category (null otherwise). */
      actual: Money | null;
      onTrack: boolean | null;
    };

/** This check-in's answer about the move. */
export type CheckinMoveAnswer = 'none' | 'done' | 'keepGoing';

export type CheckinMoveVM = {
  committed: MoveVM | null;
  progress: Loadable<MoveProgressVM | null> | null;
  /** Ranked moves to commit to when there is none (the forecast's ranking; each carries who made its number). */
  suggestions: Loadable<MoveVM[]>;
  /** True while the list on screen is a previous profile's answer: committing and "I did it" wait for the new one. */
  actionsDisabled: boolean;
  answer: CheckinMoveAnswer;
  /** The move marked done in this check-in. */
  doneMove: MoveVM | null;
  /** Highest unlocked move level (engine movesLevel). */
  level: 1 | 2;
  commit: (moveId: string) => void;
  markDone: () => void;
  keepGoing: () => void;
};

export type CheckinVM = {
  status: 'loading' | 'ready';
  month: CheckinMonthVM;
  setSource: (source: CheckinDataSource) => void;
  compare: CheckinCompareVM | null;
  move: CheckinMoveVM;
  /** Where "Add statement" goes (S9 upload). */
  uploadHref: string;
  /** Where "see all moves" goes (S10). */
  movesHref: string;
  pro: ProPreviewVM;
};
