// View-model types for the afford feature (S11). Tasks: Y7 (model) / Y11 (ui).
// ui/ may import only this file, @/ui-kit/** and @/copy (lint-enforced).
// Hook: useAfford() in ./useAfford.ts.
import type { WorkTimeUnit } from '@lifeguessr/engine';
import type { AffordResult, ForecastPoint, Money, Purchase, Rate, Source } from '@lifeguessr/types';
import type { Loadable, ParseConfirmVM } from '@/lib/model/types';
import type { WishlistItem } from '@/state';

export type { Loadable, ParseConfirmVM, VMError } from '@/lib/model/types';
export type { WishlistItem } from '@/state';
export type { Purchase } from '@lifeguessr/types';

export type PayWithChoice = 'cash' | 'card' | 'loan';

/** The purchase form. `null` = not entered yet. */
export type AffordFormVM = {
  label: string;
  /** Per occurrence. */
  amount: Money | null;
  recurring: Purchase['recurring'];
  payWith: PayWithChoice;
  /**
   * Used when payWith is 'loan'; the loan amount is the purchase amount. `typical`: the fields still on the
   * typical value for the loan's kind (not typed yet; absent = none). In `AffordVM.form` those fields hold it.
   */
  loan: {
    apr: Rate | null;
    termMonths: number | null;
    downPayment: Money;
    fees: Money;
    typical?: { apr: boolean; termMonths: boolean };
  };
};

/** The loan terms on screen that are typical values, not the user's (shown with an estimate tag and the source). */
export type LoanEstimateVM = {
  kind: 'auto' | 'personal';
  apr: boolean;
  termMonths: boolean;
  source: Source;
};

/** Net worth with vs without the purchase at one horizon (nominal dollars, from canAfford). */
export type AffordHorizonVM = { month: 1 | 12 | 60 | 120; with: ForecastPoint; without: ForecastPoint; deltaMid: Money };

export type AffordResultVM = {
  verdict: AffordResult['verdict'];
  waitMonths: number | null;
  /** First rule buying now breaks (set for 'wait' and 'no'). */
  failsOn: AffordResult['failsOn'] | null;
  /** The plan already breaks a rule without the purchase: say so instead of blaming the purchase. */
  baselineFails: boolean;
  cheapestWay: AffordResult['cheapestWay'];
  /** False when no way to pay fits now: the UI says so instead of recommending `cheapestWay`. */
  cheapestWayFits: boolean;
  /** The goal effect, when a goal is set; null otherwise. */
  goalEffect: AffordGoalEffectVM | null;
  /** canAfford's forecasts are nominal (not today's dollars). */
  todaysDollars: false;
  /**
   * Who made the with / without numbers: always the rules engine (`canAfford`), never the AI model, so
   * they can differ from the 10-year number on S10. The UI labels them with it.
   */
  forecastSource: 'rules';
  withPoints: ForecastPoint[];
  withoutPoints: ForecastPoint[];
  /** This month, 12 months, 5 years, 10 years. */
  horizons: AffordHorizonVM[];
  /** The price per occurrence in work time (engine workTime); null without take-home pay. */
  workTime: AffordWorkTimeVM | null;
};

/** "= 3 days of your work": the engine's rounded unit and amount, how often, and the estimate flag. */
export type AffordWorkTimeVM = {
  unit: WorkTimeUnit;
  amount: number;
  per: Purchase['recurring'];
  hoursPerWeek: number;
  /** Take-home pay is an estimate. */
  isEstimate: boolean;
};

/**
 * When the plan reaches the goal's target (today's dollars), with the purchase vs without.
 * `reachYear` = calendar year it is reached with the purchase (null = not within the goal's years
 * + 10). `delayMonths` = how much later than without (0 = no change; null when either never gets there).
 */
export type AffordGoalEffectVM = {
  target: Money;
  reachYear: number | null;
  delayMonths: number | null;
  /** Reached with the purchase by the goal's own date. */
  onTime: boolean;
};

/** The thresholds canAfford checks (engine assumptions), so the UI can name them in its copy. */
export type AffordRulesVM = {
  /** Month-end cash must stay at or above this many months of outflow. */
  cushionMonths: number;
  /** Debt payments / take-home pay must stay at or below this (red threshold). */
  debtLoadRed: Rate;
};

export type AffordVM = {
  status: 'loading' | 'ready';
  rules: AffordRulesVM;
  /** The form as shown: loan fields not typed yet hold the typical value for the loan's kind. */
  form: AffordFormVM;
  /** Paying with a loan and some of its terms are typical values: which, and their source. Null otherwise. */
  loanEstimate: LoanEstimateVM | null;
  setLabel: (label: string) => void;
  setAmount: (amount: Money | null) => void;
  setRecurring: (recurring: Purchase['recurring']) => void;
  setPayWith: (payWith: PayWithChoice) => void;
  setLoan: (loan: Partial<AffordFormVM['loan']>) => void;
  /** The valid Purchase the form describes, or null. */
  purchase: Purchase | null;
  /** Form paths that are invalid (e.g. 'amount', 'loan.apr'); empty until an amount is entered. */
  invalidFields: string[];
  /** null until the form is valid. */
  result: Loadable<AffordResultVM> | null;
  /** "A $1,200 laptop on my card" → Purchase; fills the form after confirmation. */
  parse: ParseConfirmVM<Purchase>;
  wishlist: WishlistItem[];
  /** Saving to the wishlist is a Pro feature: true unless the user is Pro. Saved items stay usable. */
  wishlistLocked: boolean;
  /** Where the lock notice sends the user to unlock Pro (S15). */
  proHref: string;
  /** Save the current purchase; returns its id (null if the form is invalid or the wishlist is locked). */
  addToWishlist: () => string | null;
  removeFromWishlist: (id: string) => void;
  /** Put a saved purchase back in the form. */
  loadFromWishlist: (id: string) => void;
};
