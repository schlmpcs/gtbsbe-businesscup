// View-model types for the loan feature (S12). Tasks: Y7 (model) / Y11 (ui).
// ui/ may import only this file, @/ui-kit/** and @/copy (lint-enforced).
// Hook: useLoanLab() in ./useLoanLab.ts.
import type { ComponentType, ReactNode } from 'react';
import type { Debt, LoanInput, LoanResult, Money, PayoffComparison, PayoffMethod, PayoffPlan, Rate } from '@lifeguessr/types';
import type { DebtLoadGaugeVM } from '@/lib/model/profile';
import type { Loadable, ParseConfirmVM, SliderVM, VMError } from '@/lib/model/types';
import type { PayoffDate } from './payoffDates';

export type { DebtLoadGaugeVM, DebtLoadZone } from '@/lib/model/profile';
export type { ParseConfirmVM, SliderVM, VMError } from '@/lib/model/types';
export type { LoanInput, LoanResult } from '@lifeguessr/types';
export type { Loadable } from '@/lib/model/types';
export type { PayoffComparison, PayoffMethod, PayoffPlan } from '@lifeguessr/types';
export type { PayoffDate } from './payoffDates';

/** One loan offer and its engine result (compareLoans). */
export type LoanOfferVM = {
  id: string;
  input: LoanInput;
  /** Null when the input is invalid (see `invalidFields`) or the engine failed (see `error`). */
  result: LoanResult | null;
  invalidFields: string[];
  error: VMError | null;
  /** Lowest total cost among the valid offers (ties: all flagged). */
  isLowestCost: boolean;
  isLowestMonthly: boolean;
  /** Debt load before → with this loan. */
  debtLoadAfter: DebtLoadGaugeVM | null;
};

/** The extra-payment slider on the selected offer. */
export type ExtraPaymentVM = SliderVM & {
  /** Payoff month / total interest with the extra payment (null = never pays off). */
  payoffMonth: number | null;
  totalInterest: Money;
  /** Same without any extra payment. */
  basePayoffMonth: number | null;
  baseTotalInterest: Money;
  /** baseTotalInterest − totalInterest. */
  interestSaved: Money;
  /** basePayoffMonth − payoffMonth (null when either never pays off). */
  monthsSaved: number | null;
};

/** One debt in the suggested payoff order (engine payoffOrder, avalanche: highest APR first). */
export type PayoffStepVM = {
  id: string;
  kind: Debt['kind'];
  /** The selected offer, added as a new debt. */
  isNew: boolean;
  apr: Rate;
  /** Balance today (for the new loan: the financed principal). */
  balance: Money;
};

/** Your debts plus the selected offer, in the order to pay them off with the minimums. */
export type PayoffPlanVM = {
  steps: PayoffStepVM[];
  /** Months until every debt is paid (null = not within the simulation cap). */
  payoffMonth: number | null;
  totalInterest: Money;
};

export type LoanLabVM = {
  status: 'loading' | 'ready';
  /** Up to MAX_OFFERS offers, in the order entered. */
  offers: LoanOfferVM[];
  /** Still the illustrative sample offers (fixture): nothing added, edited or removed yet. The screen labels them. */
  offersAreExamples: boolean;
  canAddOffer: boolean;
  addOffer: (input?: LoanInput) => string | null;
  updateOffer: (id: string, patch: Partial<LoanInput>) => void;
  removeOffer: (id: string) => void;
  selectedOfferId: string | null;
  selectOffer: (id: string) => void;
  /** Debt-load gauge: today (before) and with the selected offer (after). */
  /** `max` is the end of the dial (a display scale; loads above it pin the needle). */
  gauge: { before: DebtLoadGaugeVM; after: DebtLoadGaugeVM | null; isEstimate: boolean; max: Rate };
  /** Null when no valid offer is selected. */
  extra: ExtraPaymentVM | null;
  setExtraPayment: (value: Money) => void;
  /** Null when there are no debts and no valid selected offer. */
  payoffPlan: PayoffPlanVM | null;
  /** "28k at 6.9% for 5 years, $495 fees" → LoanInput; added (or replaces the selected offer when full). */
  parse: ParseConfirmVM<LoanInput>;
  /**
   * JF14: money left over each month (take-home − spending − debt payments, engine simulate, first month):
   * today, and with the selected offer's payment added (null without a valid selected offer). Negative = short.
   */
  leftOver: { before: Money; after: Money | null } | null;
};

// ----- Debt payoff planner (M13): usePayoffPlanner() in ./usePayoffPlanner.ts ----------------------
// A section of Loan Lab beside the payoff order. All numbers come from the engine (comparePayoff and
// extraToFinishBy); dates are the injected `today` plus the plan's months. Nothing here is advice.

/** A link component (next/link in the app): the planner points at the balance sheet, which is another route. */
export type LinkComponent = ComponentType<{ href: string; className?: string; children?: ReactNode }>;

/** The two methods a person can pick; minimums only is always shown beside them as the baseline. */
export type PayoffChoice = Exclude<PayoffMethod, 'minimum'>;

/** Why the methods come out the same, when they do (payoffTie.ts explains each). */
export type PayoffTie = 'noExtra' | 'tooSmall' | 'oneDebt' | 'sameOrder' | 'sameResult';

/**
 * Where the planner's extra starts before the person picks one: the engine's suggestedPayoffExtra for the profile and
 * these debts. `share` of this month's `surplus` (after spending and every required payment, the new loan's included),
 * rounded down to the slider step; `extra` is 0 when the month has no room for one step.
 */
export type PayoffSuggestionVM = { extra: Money; surplus: Money; share: Rate };

/** How far a plan is from minimums only, as a size and a direction (never a negative "saving"). */
export type PayoffDelta = { kind: 'saves' | 'costs' | 'same'; amount: number };

/** One column of the comparison: one method's plan, with its debt-free date. */
export type PayoffColumnVM = {
  method: PayoffMethod;
  /** The method picked in the toggle (minimums only is never selected). */
  isSelected: boolean;
  /** Months until every debt is paid (null = not at these payments). */
  monthsToDebtFree: number | null;
  debtFreeDate: PayoffDate | null;
  /** Null when the plan never pays off: its interest over the 100 simulated years is not a total. */
  totalInterest: Money | null;
  /** Against minimums only; signed: negative = this method costs more interest. Null when either plan never pays off. */
  interestSaved: Money | null;
  /** Against minimums only; signed: negative = later; null when either plan never pays off. */
  monthsSaved: number | null;
};

/** One debt in the selected plan's payoff order. */
export type PayoffOrderRowVM = {
  id: string;
  kind: Debt['kind'];
  /** The selected offer, added as a new debt. */
  isNew: boolean;
  apr: Rate;
  /** Balance today (for the new loan: the financed principal). */
  balance: Money;
  /** The minimum payment is a default, not a figure the person gave. */
  minIsEstimate: boolean;
  /** Null = not within the simulation (about 100 years). */
  payoffDate: PayoffDate | null;
};

/** Total balance by month for the selected plan and for minimums only, cut at `horizonMonths`. */
export type PayoffChartVM = {
  horizonMonths: number;
  selected: { month: number; balance: Money }[];
  minimum: { month: number; balance: Money }[];
};

/**
 * A plan that never pays off, and the total extra per month that would clear it within `months` (`years` is the same
 * span in years; extra null = no extra could).
 */
export type PayoffFixVM = { months: number; years: number; extra: Money | null };

/** The target-date solver: the extra per month needed to be debt-free by a chosen month. */
export type PayoffTargetVM =
  | { status: 'none' }
  /** Not a 'YYYY-MM' month. */
  | { status: 'invalid' }
  /** This month or earlier. */
  | { status: 'past' }
  /** Beyond the longest plan the engine simulates (`years` long). */
  | { status: 'tooFar'; years: number }
  | { status: 'error'; error: VMError }
  /**
   * The picked plan, at the extra now set (even $0), already finishes by then. `atMinimums`: no extra at all would be enough,
   * which holds only when the Minimums-only plan (the baseline column) also finishes by then, besides the picked method at $0.
   */
  | { status: 'onTrack'; date: PayoffDate; months: number; atMinimums: boolean }
  /**
   * `extraNeeded`: the total extra per month, rounded up to a whole dollar so paying it does finish by then.
   * `moreThanNow`: how much more than the extra now set that is, rounded up to a whole dollar.
   */
  | { status: 'needs'; date: PayoffDate; months: number; extraNeeded: Money; moreThanNow: Money }
  /** Even the largest extra the solver tries does not finish by then. */
  | { status: 'unreachable'; date: PayoffDate; months: number };

export type PayoffPlannerVM = {
  status: 'loading' | 'ready';
  /** Streamer mode: nothing personal is computed or shown; the section says so. */
  hidden: boolean;
  /** At least one debt with a balance (the profile's, or the selected offer). */
  hasDebts: boolean;
  method: PayoffChoice;
  setMethod: (method: PayoffChoice) => void;
  /** The planner's own extra per month, on all debts (not the selected offer's slider). */
  extra: SliderVM;
  /** Largest extra the box accepts; the slider track is shorter. */
  extraLimit: Money;
  setExtra: (value: Money) => void;
  /** The suggested starting extra; null when it was not worked out (loading, streamer mode, no debts, the engine failed). */
  suggestion: PayoffSuggestionVM | null;
  /** The extra on screen is the suggestion: the person has not set one, here or in an earlier visit. */
  extraIsSuggested: boolean;
  /** The engine's comparePayoff for the current debts and extra; null when there is nothing to compare (no debts, streamer mode). */
  comparison: Loadable<PayoffComparison> | null;
  /** Avalanche, snowball, minimums only; empty until the comparison is ready. */
  columns: PayoffColumnVM[];
  /** The plan of the picked method. */
  selected: PayoffPlan | null;
  order: PayoffOrderRowVM[];
  debtFreeDate: PayoffDate | null;
  /** The picked method against minimums only, signed (see PayoffColumnVM); null when either plan never pays off. */
  interestSaved: Money | null;
  monthsSaved: number | null;
  /** The same two, as a size and a direction for the sentence under the comparison. */
  savings: { interest: PayoffDelta; months: PayoffDelta | null } | null;
  /** Why avalanche and snowball (and with 'noExtra' or 'tooSmall', minimums only too) come out the same; null when they differ. */
  tie: PayoffTie | null;
  /** A debt's minimum was defaulted, so the dates and interest are estimates too. */
  isEstimate: boolean;
  chart: PayoffChartVM | null;
  /** Set when the picked method never pays off at the current payments. */
  fix: PayoffFixVM | null;
  /** The chosen target month ('YYYY-MM'), as typed; null = none. */
  targetDate: string | null;
  setTargetDate: (month: string | null) => void;
  /** Earliest and latest month the target can be (next month, and 100 years on); null until today is known. */
  targetBounds: { min: string; max: string } | null;
  target: PayoffTargetVM;
  /** Where debts are edited (S8). */
  balanceSheetHref: string;
};
