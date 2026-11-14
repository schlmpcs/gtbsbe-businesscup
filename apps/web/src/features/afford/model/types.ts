// View-model types for the afford feature (S11). Tasks: Y7 (model) / Y11 (ui).
// ui/ may import only this file, @/ui-kit/** and @/copy (lint-enforced).
// Hook: useAfford() in ./useAfford.ts.
import type { AffordResult, ForecastPoint, Money, Purchase, Rate } from '@lifeguessr/types';
import type { Loadable, ParseConfirmVM } from '@/lib/model/types';
import type { WishlistItem } from '@/state';

export type { Loadable, ParseConfirmVM, VMError } from '@/lib/model/types';
export type { WishlistItem } from '@/state';

export type PayWithChoice = 'cash' | 'card' | 'loan';

/** The purchase form. `null` = not entered yet. */
export type AffordFormVM = {
  label: string;
  /** Per occurrence. */
  amount: Money | null;
  recurring: Purchase['recurring'];
  payWith: PayWithChoice;
  /** Used when payWith is 'loan'; the loan amount is the purchase amount. */
  loan: { apr: Rate | null; termMonths: number | null; downPayment: Money; fees: Money };
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
  /** canAfford's forecasts are nominal (not today's dollars). */
  todaysDollars: false;
  withPoints: ForecastPoint[];
  withoutPoints: ForecastPoint[];
  /** This month, 12 months, 5 years, 10 years. */
  horizons: AffordHorizonVM[];
};

export type AffordVM = {
  status: 'loading' | 'ready';
  form: AffordFormVM;
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
  /** Save the current purchase; returns its id (null if the form is invalid). */
  addToWishlist: () => string | null;
  removeFromWishlist: (id: string) => void;
  /** Put a saved purchase back in the form. */
  loadFromWishlist: (id: string) => void;
};
