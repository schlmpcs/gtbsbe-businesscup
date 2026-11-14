'use client';

import { useGuessPayoff } from '@/features/ladder/model/useGuessPayoff';
import { useLadderProgress } from '@/features/ladder/model/useLadderProgress';
import { useStatementUpload } from '@/features/ladder/model/useStatementUpload';
import { StatementUpload } from '@/features/ladder/ui/StatementUpload';

// S9 Statement upload + "What we keep": screen UI (ladder, Y9). Reading and categorizing the CSV
// is T6/T7 (features/upload); it plugs into useStatementUpload's readFile / submitTotals. Once the
// statement is applied, the S5 guess is paid off against the real month (useGuessPayoff).
export default function UploadPage() {
  return <StatementUpload vm={useStatementUpload()} progress={useLadderProgress()} payoff={useGuessPayoff()} />;
}
