'use client';

import { useGuessPayoff } from '@/features/ladder/model/useGuessPayoff';
import { useLadderProgress } from '@/features/ladder/model/useLadderProgress';
import { useStatementUpload } from '@/features/ladder/model/useStatementUpload';
import { StatementUpload } from '@/features/ladder/ui/StatementUpload';
import { forgetStatementFindings } from '@/features/upload/model/statementFindings';
import { useStatementFindings } from '@/features/upload/model/useStatementFindings';
import { StatementFindings } from '@/features/upload/ui/StatementFindings';

// S9 Statement upload + "What we keep": screen UI (ladder, Y9). Reading and categorizing the CSV
// is T6/T7 (features/upload); it plugs into useStatementUpload's readFile / submitTotals. The
// paychecks and debts found in the same statement (JF7) are features/upload's own review, put on
// the screen through StatementUpload's `findings` slot. Discarding the statement forgets them too.
// Once the statement is applied, the S5 guess is paid off against the real month (useGuessPayoff).
export default function UploadPage() {
  const upload = useStatementUpload();
  const discard = () => {
    upload.discard();
    forgetStatementFindings();
  };
  return (
    <StatementUpload
      vm={{ ...upload, discard }}
      progress={useLadderProgress()}
      findings={<StatementFindings vm={useStatementFindings()} />}
      payoff={useGuessPayoff()}
    />
  );
}
