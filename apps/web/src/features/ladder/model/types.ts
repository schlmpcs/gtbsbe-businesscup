// View-model types for the ladder feature (S5–S9 UI). Tasks: Y7 (model) / Y9 (ui).
// ui/ may import only this file, @/ui-kit/** and @/copy (lint-enforced).
// Hooks: useGuessYourself (S5), useClosestLife (S6), useQuickSliders (S7), useBalanceSheet (S8),
// useStatementUpload (S9), and useLadderProgress (the rung indicator and range band on every rung).
import type {
  CategoryTotals, CostCategory, Debt, ForecastPoint, KidAge, Money, ProfilePatch, Rate, Source,
} from '@lifeguessr/types';
import type { DebtLoadGaugeVM } from '@/lib/model/profile';
import type { EstimatedMoney, ParseConfirmVM, SliderVM, VMError } from '@/lib/model/types';
import type { DebtInput } from '@/state';

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
   * S5: a guess is saved. S6: the starting life was built or "About you" was answered. S7/S8: the profile is the user's own (not the
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
  /**
   * Who made `in10y`: always the rules engine here, so the number moves as you type (S1 and S10 show
   * the AI forecast). The UI labels it "Rules-based preview".
   */
  in10ySource: 'rules';
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
  /** S7: set your spending by hand, the alternative to importing a statement on S9. */
  byHandHref: string;
};

/**
 * S5 reveal, only once the spending is the user's own (a statement or typed categories): "You guessed
 * $X. You actually spend $Y". Never shown against a sample or estimated profile.
 */
export type SelfGuessRevealVM = {
  guess: Money;
  /** This month's spending (all categories but debtPayments) + minimum debt payments, from the profile. */
  actual: Money;
  /** actual − guess (positive: the month costs more than guessed). */
  difference: Money;
};

/** S5 Guess yourself: one log-scale slider for your own monthly cost. */
export type GuessYourselfVM = {
  status: Status;
  guess: SliderVM;
  /** The guess saved earlier (null until submitted). */
  savedGuess: Money | null;
  /** Guess vs reality: null until a guess is saved AND the spending is the user's own. */
  reveal: SelfGuessRevealVM | null;
  /** Today's game results for the bridge line ("You guessed low on 4 of 5"); null if not played. */
  bridge: { played: number; guessedLow: number; guessedHigh: number } | null;
  setGuess: (value: Money) => void;
  setGuessPosition: (position: number) => void;
  submit: () => void;
};

/**
 * S6: why this card costs what it does, at a glance (1–2 per card, largest difference first).
 * `amount` is the card's own monthly cost line (engine costOfLife); area chips compare its rent with
 * the other cards of the same size.
 */
export type DifferentiatorVM =
  | { kind: 'car'; amount: Money }
  | { kind: 'noCar' }
  | { kind: 'childcare'; amount: Money }
  | { kind: 'pricierArea' | 'cheaperArea'; amount: Money };

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
  /** 1–2 chips that explain the price (car, childcare, neighborhood tier). Empty when unavailable. */
  differentiators: DifferentiatorVM[];
  /** False when we have no area data for its ZIP (can't build a profile). */
  available: boolean;
};

/** S6 "About you": what the person typed. Age and pay are saved as measured values as they type. */
export type AboutYouVM = {
  age: { value: number; isEstimate: boolean; bounds: InputBounds };
  takeHomePay: { value: Money; isEstimate: boolean; bounds: InputBounds };
  adults: 1 | 2;
  /** Children per age band. */
  kids: Record<KidAge, number>;
  kidsPerBandMax: number;
  bedrooms: 0 | 1 | 2 | 3 | 4;
  hasCar: boolean;
  zip: string;
  /**
   * empty / invalid: no 5-digit ZIP yet. exact: we have that ZIP's data. nearby: a covered ZIP with the
   * same first three digits stands in (`areaZip`). none: no data for the area yet.
   */
  zipStatus: 'empty' | 'invalid' | 'exact' | 'nearby' | 'none';
  /** The ZIP whose data is used (the typed one, or the nearby stand-in); null without area data. */
  areaZip: string | null;
};

export type ClosestLifeVM = {
  status: Status;
  selfGuess: Money | null;
  about: AboutYouVM;
  setAge: (age: number) => void;
  setTakeHomePay: (pay: Money) => void;
  setAdults: (adults: number) => void;
  setKidCount: (age: KidAge, count: number) => void;
  setBedrooms: (bedrooms: number) => void;
  setHasCar: (hasCar: boolean) => void;
  setZip: (zip: string) => void;
  /**
   * The starting life built from the answers (engine lifeCardFromFacts → costOfLife), preselected as
   * the one to start from; null until a ZIP we have data for. Its `cardId` is OWN_LIFE_CARD_ID.
   */
  candidate: LifeCandidateVM | null;
  /** Spending came from a bank statement: the starting life is skipped, only "About you" is asked. */
  spendingFromStatement: boolean;
  chosenCardId: string | null;
  /**
   * The card shown as selected (JF13): the built `candidate`, preselected so the CTA starts from it in
   * one tap. null while there is none (no ZIP with data yet, or spending from a statement).
   */
  selectedCardId: string | null;
  /** Build the profile from `candidate` (engine cardToProfile; typed values kept). */
  choose: () => void;
};

/** /future and /afford: typed pay next to a sample life's spending (JF1). */
export type MixedProfileVM = {
  /** The S5 guess (null when there is none: then only the link to set the spending is offered). */
  guess: Money | null;
  /** Scale the sample categories so the month costs the guess. null without a guess. */
  useGuess: (() => void) | null;
  /** Where to set the spending for real (the statement import). */
  spendingHref: string;
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
  /** Who made `in10y`: always the rules engine (a drag needs instant feedback). Not shown on this screen. */
  in10ySource: 'rules';
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
  /**
   * Prefill for a new debt of each kind when the user only types the balance: an APR default
   * (engine debtAprDefaults; the card one is Fed G.19). Always shown as an estimate, editable.
   */
  debtAprDefaults: Record<Debt['kind'], Rate>;
  /** The engine's estimate of a skipped minimum payment (card formula: interest + 1%, floor $25). */
  estimateMinPayment: (balance: Money, apr: Rate) => Money;
  /**
   * Debt payments found in the uploaded statement (mean per month over the months that have them),
   * offered as a card to confirm or dismiss. The statement only tells us the payment, not the kind
   * or balance: the user picks the kind and types the balance. Null when there is no statement, it
   * has no debt payments, debts were already added, or the card was dismissed.
   */
  detectedDebt: { monthlyPayment: Money; months: number } | null;
  /** Add the detected payment as one debt of this kind (APR prefilled, payment from the statement). */
  confirmDetected: (kind: Debt['kind'], balance: Money) => string;
  dismissDetected: () => void;
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
  whatWeKeep: { avatarPublished?: boolean; months: string[]; categories: CostCategory[]; takeHomePay: boolean; savedProfileToServer: boolean };
  /**
   * Read a CSV statement in the browser and categorize it (T6/T7), ending in `submitTotals`.
   * null when no reader is available: the screen then shows the file picker as unavailable.
   */
  readFile: ((file: File) => void) | null;
  /**
   * "Try with sample statement": the sample statement fixture, read through the same pipeline as
   * `readFile` (parsed and masked in the browser, then categorized). Ends in review like a file.
   */
  trySample: () => void;
  /** The seam for T6/T7: CategoryTotals from /api/statement/categorize. Validated, then reviewed. */
  submitTotals: (totals: CategoryTotals[]) => void;
  /** Merge the pending months into the profile as measured values. */
  apply: () => void;
  discard: () => void;
};
