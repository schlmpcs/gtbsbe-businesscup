// View-model types for the upload feature (S9 logic). Tasks: T6 / T7, JF7.
// The S9 screen itself is the ladder feature's (features/ladder: useStatementUpload + ui); this
// feature owns the pipeline behind its `readFile`: CSV file → in-browser parse and masking →
// /api/statement/categorize → CategoryTotals[] (readStatementFile.ts), and the "We found" review of
// the paychecks and debts in the statement (JF7: useStatementFindings + ui/StatementFindings).
import type { ClassifiedStatementItem } from '@lifeguessr/engine';
import type {
  CategoryTotals, Debt, Money, PayCadence, Rate, Source, StatementCategorizeResponse, StatementFindings, StatementFollowUp,
} from '@lifeguessr/types';
import type { SignConvention, StatementReadErrorCode } from '@/lib/statement/read';

/** Why a file could not be used, before anything was sent. */
export type StatementFileProblem =
  | 'notCsv'    // not a CSV or text file
  | 'tooLarge'  // over MAX_STATEMENT_FILE_BYTES
  | 'tooMany'   // more lines than one request may carry (MAX_STATEMENT_ITEMS)
  | StatementReadErrorCode;

/** What was read from the file, for the review step. */
export type StatementReadSummary = {
  /** Transactions read (money in and out). */
  transactions: number;
  /** Lines skipped because they are still pending. */
  skippedPending: number;
  /** Lines skipped because they aren't transactions (totals, notes, balances). */
  skippedOther: number;
  /** First and last transaction date, 'YYYY-MM-DD'. */
  from: string;
  to: string;
  convention: SignConvention;
  categorizedBy: StatementCategorizeResponse['categorizedBy'];
};

export type StatementFileResult = {
  months: CategoryTotals[];
  summary: StatementReadSummary;
  /**
   * The masked lines that were sent, each with how the server sorted it, so an answered follow-up
   * can re-sort a merchant and the totals be summed again in the browser (statementTotals). Null
   * when the server did not say how it sorted them (then follow-ups can't be answered). Held in
   * memory only, never saved (CLAUDE.md rule 6).
   */
  classified: ClassifiedStatementItem[] | null;
  /** What the statement could not settle (JF6), worst first; empty when nothing is unclear. */
  followUps: StatementFollowUp[];
  /** `findings`: paychecks and debt payments found in the file (JF7), for the S9 "We found" review. */
  findings: StatementFindings;
};

// ----- JF7: the S9 "We found" review ------------------------------------------------------------
// Spec: GitHub issue #139. Logic in useStatementFindings; the screen part in ../ui/StatementFindings.

/** Where one finding stands: not decided yet, added to the profile, or set aside by the person. */
export type FindingStatus = 'pending' | 'confirmed' | 'dismissed';

/** A paycheck (or other regular deposit) found in the statement. */
export type FoundIncomeVM = {
  id: string;
  /** From the masked label ("Acme Logistics Inc"); null when the mask left no name. */
  payer: string | null;
  /** The label says payroll or direct deposit; otherwise it is shown as a regular deposit. */
  payroll: boolean;
  cadence: PayCadence;
  deposits: number;
  /** Typical deposit (median). */
  perDeposit: Money;
  /** What it adds to take-home pay per month (engine: perDeposit × paydays a year ÷ 12). */
  monthly: Money;
  status: FindingStatus;
};

/** Regular payments to a lender found in the statement. */
export type FoundDebtVM = {
  id: string;
  kind: Debt['kind'];
  /** A lender name ("Toyota Financial"); null when the lender is not on the engine's list and the label has no name. */
  creditor: string | null;
  payments: number;
  /** Measured average per month: kept as the debt's monthly payment. */
  monthlyPayment: Money;
  /** The kind's typical APR, always an estimate, and where it comes from. */
  apr: Rate;
  aprSource: Source;
  status: FindingStatus;
};

export type StatementFindingsVM = {
  /**
   * hidden: no statement read in this visit (or it was discarded) · none: read, nothing found ·
   * found: at least one paycheck or debt to review.
   */
  status: 'hidden' | 'none' | 'found';
  income: FoundIncomeVM[];
  debts: FoundDebtVM[];
  /** Take-home pay set from the paychecks confirmed so far (their sum), or null before the first. */
  confirmedTakeHome: Money | null;
  /** Bounds for a typed balance (the profile contract's). */
  balanceBounds: { min: number; max: number; step: number };
  /** Use this paycheck: take-home pay becomes the sum of the confirmed paychecks (measured). */
  confirmIncome: (id: string) => void;
  dismissIncome: (id: string) => void;
  /** Add this debt with the balance typed: its measured payment, the kind's APR tagged estimate. */
  confirmDebt: (id: string, balance: Money) => void;
  dismissDebt: (id: string) => void;
};
