// View-model types for the ladder feature (S5–S9 UI). Tasks: Y7 (model) / Y9 (ui).
// ui/ may import only this file, @/ui-kit/** and @/copy (lint-enforced).
// Hooks: useGuessYourself (S5), useClosestLife (S6), useQuickSliders (S7), useBalanceSheet (S8),
// useStatementUpload (S9).
import type {
  CategoryTotals, CostCategory, Debt, ForecastPoint, KidAge, Money, ProfilePatch, Rate,
} from '@lifeguessr/types';
import type { DebtLoadGaugeVM } from '@/lib/model/profile';
import type { EstimatedMoney, ParseConfirmVM, SliderVM, VMError } from '@/lib/model/types';
import type { DebtInput } from '@/state';

export type { DebtLoadGaugeVM, DebtLoadZone } from '@/lib/model/profile';
export type { EstimatedMoney, ParseConfirmVM, SliderVM, VMError } from '@/lib/model/types';
export type { ProfileField, DebtInput } from '@/state';

type Status = 'loading' | 'ready';

/** S5 Guess yourself: one log-scale slider for your own monthly cost. */
export type GuessYourselfVM = {
  status: Status;
  guess: SliderVM;
  /** The guess saved earlier (null until submitted). */
  savedGuess: Money | null;
  /** Today's game results for the bridge line ("You guessed low on 4 of 5"); null if not played. */
  bridge: { played: number; guessedLow: number; guessedHigh: number } | null;
  setGuess: (value: Money) => void;
  setGuessPosition: (position: number) => void;
  submit: () => void;
};

/** S6: one life card to start from. */
export type LifeCandidateVM = {
  cardId: string;
  metro: string;
  caption: string;
  adults: 1 | 2;
  kids: KidAge[];
  bedrooms: 0 | 1 | 2 | 3 | 4;
  carPrice: Money | null;
  /** The card's monthly cost range (engine costOfLife). */
  monthly: { low: Money; mid: Money; high: Money };
  /** Played in today's game (else a sample life). */
  fromToday: boolean;
  /** Closest to your own guess (S5). */
  isNearest: boolean;
  /** False when we have no area data for its ZIP (can't build a profile). */
  available: boolean;
};

export type ClosestLifeVM = {
  status: Status;
  selfGuess: Money | null;
  /** Nearest to the self guess first (card order when there is no guess). */
  candidates: LifeCandidateVM[];
  nearestCardId: string | null;
  chosenCardId: string | null;
  /** Build the profile from this card (engine cardToProfile; every field an estimate). */
  choose: (cardId: string) => void;
};

export type SpendingSliderVM = SliderVM & { category: CostCategory; isEstimate: boolean };

/** S7 Quick sliders. */
export type QuickSlidersVM = {
  status: Status;
  sliders: SpendingSliderVM[];
  /** Share of a monthly surplus saved to retirement (decimal). */
  savings: SliderVM & { isEstimate: boolean };
  /** This month from the engine simulation (point values). */
  month: { takeHome: EstimatedMoney; spending: Money; debtPayments: Money; surplus: Money };
  /** Spending + debt payments: compare with the S5 guess. */
  monthlyCost: Money;
  selfGuess: Money | null;
  /** Net worth in 10 years, today's dollars, with the range band. */
  in10y: ForecastPoint;
  setSpending: (category: CostCategory, value: Money) => void;
  setSavingsShare: (share: Rate) => void;
  /** "I pay 1,800 rent and eat out twice a week" → ProfilePatch, applied after confirmation. */
  parse: ParseConfirmVM<ProfilePatch>;
};

export type BalanceFieldKey = 'age' | 'takeHomePay' | 'cash' | 'retirement';

export type DebtRowVM = {
  id: string;
  kind: Debt['kind'];
  balance: Money;
  apr: Rate;
  minPayment: Money;
  minPaymentIsEstimate: boolean;
};

/** S8 Balance sheet: six taps; a skipped field stays an estimate. */
export type BalanceSheetVM = {
  status: Status;
  fields: Record<BalanceFieldKey, { value: number; isEstimate: boolean }>;
  debts: DebtRowVM[];
  /** Debt payments / take-home pay this month, with zone and thresholds. */
  debtLoad: DebtLoadGaugeVM;
  /** Cash + retirement − debts today. */
  netWorth: Money;
  setField: (field: BalanceFieldKey, value: number) => void;
  skipField: (field: BalanceFieldKey) => void;
  /** `minPayment: null` = skipped (estimated with the card formula). Returns the new id. */
  addDebt: (input: DebtInput) => string;
  updateDebt: (id: string, input: DebtInput) => void;
  removeDebt: (id: string) => void;
};

/** One statement month as shown for review. */
export type StatementMonthVM = {
  month: string;
  totals: Record<CostCategory, Money>;
  /** Σ totals for the month. */
  total: Money;
  oneOffs: { label: string; amount: Money }[];
  detectedPay: Money | null;
};

/** S9 Statement upload (screen state; parsing and categorizing are T6/T7 in features/upload). */
export type StatementUploadVM = {
  status: 'loading' | 'idle' | 'review' | 'applied' | 'error';
  error: VMError | null;
  /** Months waiting for the user to confirm. */
  pending: StatementMonthVM[];
  /** Months already merged into the profile ('YYYY-MM', oldest first). */
  history: string[];
  /** Drift flags on Today need ≥ 3 months. */
  hasDriftHistory: boolean;
  /** "What we keep": exactly what is persisted. */
  whatWeKeep: { months: string[]; categories: CostCategory[]; takeHomePay: boolean };
  /** The seam for T6/T7: CategoryTotals from /api/statement/categorize. Validated, then reviewed. */
  submitTotals: (totals: CategoryTotals[]) => void;
  /** Merge the pending months into the profile as measured values. */
  apply: () => void;
  discard: () => void;
};
