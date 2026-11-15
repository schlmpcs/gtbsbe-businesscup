// JF7: the income and debts found in the statement just read, and what the person decided about
// each one, for the S9 "We found" review. In memory only, like `lastStatementRead`:
//
// - never written to storage and gone on reload. The findings carry payer and lender names (from
//   the masked labels or the engine's lender list), and CLAUDE.md rule 6 keeps only category totals
//   from a statement. What a person confirms goes into the profile as numbers and kinds only
//   (take-home pay; a debt's kind, payment, APR and balance), and that is what is saved.
// - the decisions live next to the findings so that leaving S9 for S8 and coming back does not
//   offer the same paycheck or debt twice (a debt confirmed twice would be added twice).
//
// `readStatementFile` replaces the findings on every read; discarding the statement forgets them.
import type { StatementFindings } from '@lifeguessr/types';
import { create } from 'zustand';

export type FindingDecision = 'confirmed' | 'dismissed';

type FindingsState = {
  findings: StatementFindings | null;
  decisions: Readonly<Record<string, FindingDecision>>;
};

export const useStatementFindingsStore = create<FindingsState>(() => ({ findings: null, decisions: {} }));

/** The findings of a new read (decisions start over: the ids belong to that statement). */
export function rememberStatementFindings(findings: StatementFindings): void {
  useStatementFindingsStore.setState({ findings, decisions: {} });
}

/** Forget the findings, e.g. when the statement is discarded or another one is being read. */
export function forgetStatementFindings(): void {
  useStatementFindingsStore.setState({ findings: null, decisions: {} });
}

/** Record what the person decided about one finding. */
export function decideFinding(id: string, decision: FindingDecision): void {
  useStatementFindingsStore.setState((s) => ({ decisions: { ...s.decisions, [id]: decision } }));
}
