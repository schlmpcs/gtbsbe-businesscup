// View-model types for the ladder feature (S5–S9 UI). Tasks: Y7 (model) / Y9 (ui).
// ui/ may import only this file, @/ui-kit/** and @/copy (lint-enforced).
// Hooks: useGuessYourself (S5), useClosestLife (S6), useQuickSliders (S7), useBalanceSheet (S8),
// useStatementUpload (S9), and useLadderProgress (the rung indicator and range band on every rung).
import type {
  CategoryTotals, CostCategory, Debt, ForecastPoint, KidAge, Money, ProfilePatch, Rate, Source,
} from '@lifeguessr/types';
import type { DebtLoadGaugeVM } from '@/lib/model/profile';
import type { EstimatedMoney, ParseConfirmVM, SliderVM, VMError } from '@/lib/model/types';
import type { DebtInput, ProfileOrigin } from '@/state';

export type { DebtLoadGaugeVM, DebtLoadZone } from '@/lib/model/profile';
export type { EstimatedMoney, ParseConfirmVM, SliderVM, VMError } from '@/lib/model/types';
export type { ProfileField, DebtInput, ProfileOrigin } from '@/state';

type Status = 'loading' | 'ready';

/** The ladder screens, in order. */
export type LadderScreen = 'S5' | 'S6' | 'S7' | 'S8' | 'S9';

/** One rung of the ladder and whether the user has done it. */
export type LadderRungVM = {
  screen: LadderScreen;
  href: string;
  /**
   * S5: a guess is saved. S6: a life card was picked. S7/S8: the profile is the user's own (not the
   * demo) and at least one of that rung's inputs is measured (S8 also: a debt was added, edited or
   * removed since the starting profile). S9: at least one statement month merged.
   */
  done: boolean;
};

/** Ladder progress shown on every rung: which rungs are done and how narrow the 10-year range is. */
export type LadderProgressVM = {
  status: Status;
  rungs: LadderRungVM[];
  doneCount: number;
  /** Net worth in 10 years (today's dollars) with the range band from the estimated inputs. */
  in10y: ForecastPoint;
  /** in10y.high − in10y.low. */
  bandWidth: Money;
  /** The same profile's band if every input were an estimate: where the ladder starts. */
  bandWidthAllEstimated: Money;
  /** Share of that starting band the user's real numbers have removed (0–1). */
  bandNarrowed: Rate;
  /** Inputs the forecast reads that are still estimates, out of all of them. */
  estimates: { left: number; total: number };
  /** "See your future →" (S10). */
  futureHref: string;
};

/** S5 after a guess is saved: the guess next to the engine's monthly cost for the current profile. */
export type SelfGuessComparisonVM = {
  guess: Money;
  /** This month's spending + debt payments from the engine simulation of the current profile. */
  estimate: Money;
  /** At least one input behind `estimate` is an estimate (a spending category or a minimum payment). */
  isEstimate: boolean;
  /** Which profile the estimate is for: the sample profile, a picked life card, or the user's own numbers. */
  basis: ProfileOrigin;
  /** guess − estimate. */
  difference: Money;
  /** difference / estimate (0 when the estimate is 0). */
  differenceShare: Rate;
  /** 'match' when the guess is within a dollar of the estimate. */
  direction: 'above' | 'below' | 'match';
};

/** S5 Guess yourself: one log-scale slider for your own monthly cost. */
export type GuessYourselfVM = {
  status: Status;
  guess: SliderVM;
  /** The guess saved earlier (null until submitted). */
  savedGuess: Money | null;
  /** The saved guess against the engine's estimate (null until a guess is saved). */
  comparison: SelfGuessComparisonVM | null;
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
  /**
   * The cost lines behind `monthly`, largest first, each with its source (empty when unavailable).
   * A category can appear more than once (the car: loan, insurance, fuel); `id` is unique.
   */
  items: { id: string; category: CostCategory; amount: Money; source: Source; isEstimate: boolean }[];
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

/** What one parsed value would change, for the S7 confirmation list. */
export type ParsedTargetVM =
  | { kind: 'spending'; category: CostCategory }
  | { kind: 'debtApr'; debtId: string; debtKind: Debt['kind'] | null }
  | { kind: 'debtExtraPayment'; debtId: string; debtKind: Debt['kind'] | null }
  | { kind: 'retirementShare' };

/** One value read from the user's text, awaiting confirmation. */
export type ParsedRowVM = {
  /** The parser's path ('spending.groceries', 'debts.0.apr', 'retirementShare'). */
  path: string;
  target: ParsedTargetVM;
  /** Monthly dollars for 'money', a decimal for 'rate'. */
  value: number;
  unit: 'money' | 'rate';
  /** Today's value in the profile (null when the debt is unknown or has no extra payment). */
  current: number | null;
  /** Not written literally in the text: highlight it. */
  inferred: boolean;
};

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
  /** monthlyCost − selfGuess (positive: the month costs more than guessed); null without a guess. */
  guessGap: Money | null;
  /** Net worth in 10 years, today's dollars, with the range band. */
  in10y: ForecastPoint;
  setSpending: (category: CostCategory, value: Money) => void;
  setSavingsShare: (share: Rate) => void;
  /** "I pay 1,800 rent and eat out twice a week" → ProfilePatch, applied after confirmation. */
  parse: ParseConfirmVM<ProfilePatch>;
  /** `parse.parsed` as rows for the confirmation list (empty unless status is 'confirming'). */
  parsedRows: ParsedRowVM[];
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

/** Input bounds (the values the profile contract accepts). Setters clamp to them as well. */
export type InputBounds = { min: number; max: number; step: number };

/** S8 Balance sheet: six taps; a skipped field stays an estimate. */
export type BalanceSheetVM = {
  status: Status;
  fields: Record<BalanceFieldKey, { value: number; isEstimate: boolean }>;
  /** Bounds per field (age 16–110 whole years; cash may be negative; the rest ≥ 0). */
  fieldBounds: Record<BalanceFieldKey, InputBounds>;
  debts: DebtRowVM[];
  /** Debt kinds the user can add, in display order. */
  debtKinds: readonly Debt['kind'][];
  /** Bounds for a debt's balance, APR (decimal, 0–1) and minimum payment. */
  debtBounds: { balance: InputBounds; apr: InputBounds; minPayment: InputBounds };
  /** Debt payments / take-home pay this month, with zone and thresholds. */
  debtLoad: DebtLoadGaugeVM;
  /** End of the debt-load gauge's dial (a display scale, not a threshold). */
  debtLoadMax: Rate;
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

/** Why a statement file couldn't be used (read in the browser, before anything was sent). */
export type StatementUnreadableReason =
  | 'notCsv' | 'tooLarge' | 'tooMany' | 'empty' | 'malformed' | 'noColumns' | 'noTransactions';

export type StatementUploadError = VMError | { kind: 'unreadable'; reason: StatementUnreadableReason };

/** What the last file held, shown with the review. */
export type StatementReadVM = {
  transactions: number;
  skippedPending: number;
  /** Lines that weren't transactions (totals, notes, balance lines). */
  skippedOther: number;
  /** First and last transaction date, 'YYYY-MM-DD'. */
  from: string;
  to: string;
  /** Who sorted the labels into categories; the totals are always summed in code. */
  categorizedBy: 'ai' | 'rules' | 'mixed';
};

/** S9 Statement upload (screen state; parsing and categorizing are T6/T7 in features/upload). */
export type StatementUploadVM = {
  /** 'reading': a file is being parsed in the browser and categorized. */
  status: 'loading' | 'idle' | 'reading' | 'review' | 'applied' | 'error';
  error: StatementUploadError | null;
  /** The file behind `pending` (null before a file was read, and after apply or discard). */
  lastRead: StatementReadVM | null;
  /** Months waiting for the user to confirm. */
  pending: StatementMonthVM[];
  /** Months already merged into the profile ('YYYY-MM', oldest first). */
  history: string[];
  /** Drift flags on Today need ≥ 3 months. */
  hasDriftHistory: boolean;
  /**
   * "What we keep": exactly what is persisted. `months`, `categories` and `takeHomePay` describe the
   * statement history kept in this browser; `savedProfileToServer` is true when the profile (which
   * holds the category averages and take-home pay) is also saved to /api/session.
   */
  whatWeKeep: { months: string[]; categories: CostCategory[]; takeHomePay: boolean; savedProfileToServer: boolean };
  /**
   * Read a CSV statement in the browser and categorize it (T6/T7), ending in `submitTotals`.
   * null when no reader is available: the screen then shows the file picker as unavailable.
   */
  readFile: ((file: File) => void) | null;
  /** The seam for T6/T7: CategoryTotals from /api/statement/categorize. Validated, then reviewed. */
  submitTotals: (totals: CategoryTotals[]) => void;
  /** Merge the pending months into the profile as measured values. */
  apply: () => void;
  discard: () => void;
};
