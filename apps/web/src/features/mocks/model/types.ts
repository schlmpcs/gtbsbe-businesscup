// View-model types for the mocks feature: S13 Decision (keep the car or lease) and S14 Monthly
// check-in. Task: T11 ("clickable on fixtures"). (S15, the paywall, is the pro feature.)
// ui/ may import only this file, @/ui-kit/** and @/copy (lint-enforced).
// Hooks: useDecide() in ./useDecide.ts, useCheckin() in ./useCheckin.ts.
//
// "Mock" means a preview (nothing is saved, no reminders), not made-up numbers: every number comes
// from @lifeguessr/engine on the user's profile (the demo profile until they build their own), from
// what they type, or from a fixture the screen labels (illustrative lease terms, sample statement).
import type { CostCategory, ForecastPoint, MonthEnd, Money, Rate } from '@lifeguessr/types';
import type { Loadable } from '@/lib/model/types';
import type { MoveVM } from '@/features/forecast/model/types';

export type { Loadable, VMError } from '@/lib/model/types';
export type { MoveTarget, MoveVM } from '@/features/forecast/model/types';
export type { CostCategory, ForecastPoint, MonthEnd, Money, MoveKind } from '@lifeguessr/types';

/** Where the preview note sends a free user. */
export type ProPreviewVM = { isPro: boolean; href: string };

// ----- S13 Decision: keep the car or lease a new one ------------------------------------------


/** The lease inputs. `null` = the box is empty. Money is per month except `dueAtSigning` (per term). */
export type LeaseForm = { monthly: Money | null; termMonths: number | null; dueAtSigning: Money | null; running: Money | null };
export type LeaseField = keyof LeaseForm;

export type DecideResultVM = {
  keep: {
    /** Σ balances of the profile's auto loans today. */
    loanLeft: Money;
    /** Months until they are paid off at the required payments (engine simulate); null = not within 10 years. */
    monthsLeft: number | null;
    /** Required auto-loan payments, per month. */
    loanPayment: Money;
    /** The profile's car running costs (insurance, fuel, upkeep), per month. */
    running: Money;
    runningIsEstimate: boolean;
    /** Net worth at month 120, today's dollars (engine forecast). */
    in10y: ForecastPoint;
  };
  lease: {
    in10y: ForecastPoint;
    /** How many times the amount due at signing is paid within the 10 years. */
    signings: number;
  };
  /** keep.in10y.mid − lease.in10y.mid (positive = keeping is ahead). */
  keepAdvantage10y: Money;
  /** (lease payment + lease running costs) − today's running costs: what keeping saves each month once the loan is paid. */
  monthlySavingAfterPayoff: Money;
  better: 'keep' | 'lease';
  /** |keepAdvantage10y| */
  betterBy10y: Money;
  /** Some input behind the two forecasts is an estimate. */
  isEstimate: boolean;
  /** Who made the two 10-year numbers: always the rules engine (`forecast`), never the AI model, so they can differ from S10's. */
  forecastSource: 'rules';
};

export type DecideVM = {
  status: 'loading' | 'ready';
  /** Still the demo profile: the screen names its cars (the Camry and the RAV4). */
  isDemoProfile: boolean;
  /** Calendar year at the 10-year horizon. */
  horizonYear: number;
  todaysDollars: true;
  lease: {
    form: LeaseForm;
    /** Per field: still the illustrative sample value (not typed by the user). */
    isEstimate: Record<LeaseField, boolean>;
    invalidFields: LeaseField[];
  };
  /** Some lease term is still the illustrative sample (the screen labels the comparison as an example). */
  leaseIsExample: boolean;
  setLease: (patch: Partial<LeaseForm>) => void;
  /** Back to the illustrative lease terms. */
  resetLease: () => void;
  /** Null while a lease field is invalid. */
  result: Loadable<DecideResultVM> | null;
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
