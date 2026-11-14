// View-model types for the loan feature (S12). Tasks: Y7 (model) / Y11 (ui).
// ui/ may import only this file, @/ui-kit/** and @/copy (lint-enforced).
// Hook: useLoanLab() in ./useLoanLab.ts.
import type { LoanInput, LoanResult, Money, Rate } from '@lifeguessr/types';
import type { DebtLoadGaugeVM } from '@/lib/model/profile';
import type { ParseConfirmVM, SliderVM, VMError } from '@/lib/model/types';

export type { DebtLoadGaugeVM, DebtLoadZone } from '@/lib/model/profile';
export type { ParseConfirmVM, SliderVM, VMError } from '@/lib/model/types';
export type { LoanInput, LoanResult } from '@lifeguessr/types';

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

export type LoanLabVM = {
  status: 'loading' | 'ready';
  /** Up to MAX_OFFERS offers, in the order entered. */
  offers: LoanOfferVM[];
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
  /** "28k at 6.9% for 5 years, $495 fees" → LoanInput; added (or replaces the selected offer when full). */
  parse: ParseConfirmVM<LoanInput>;
};
