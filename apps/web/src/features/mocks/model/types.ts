// View-model types for the mocks feature: S13 Decision (keep the car or lease). (S14 Monthly check-in
// is the checkin feature.) Task: T11 ("clickable on fixtures"). (S15, the paywall, is the pro feature.)
// ui/ may import only this file, @/ui-kit/** and @/copy (lint-enforced).
// Hook: useDecide() in ./useDecide.ts.
//
// "Mock" means a preview (nothing is saved, no reminders), not made-up numbers: every number comes
// from @lifeguessr/engine on the user's profile (the demo profile until they build their own), from
// what they type, or from a fixture the screen labels (illustrative lease terms, sample statement).
import type { ForecastPoint, Money } from '@lifeguessr/types';
import type { Loadable } from '@/lib/model/types';

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
  setLease: (patch: Partial<LeaseForm>) => void;
  /** Back to the illustrative lease terms. */
  resetLease: () => void;
  /** Null while a lease field is invalid. */
  result: Loadable<DecideResultVM> | null;
};
