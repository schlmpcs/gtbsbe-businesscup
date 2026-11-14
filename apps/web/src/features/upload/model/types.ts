// View-model types for the upload feature (S9 logic). Tasks: T6 / T7.
// The S9 screen itself is the ladder feature's (features/ladder: useStatementUpload + ui); this
// feature owns the pipeline behind its `readFile`: CSV file → in-browser parse and masking →
// /api/statement/categorize → CategoryTotals[] (readStatementFile.ts).
import type { ClassifiedStatementItem } from '@lifeguessr/engine';
import type { CategoryTotals, StatementCategorizeResponse, StatementFollowUp } from '@lifeguessr/types';
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
};
