// The last statement this page read, kept in memory so another tool can reuse it without a second upload
// (JF8: the subscription audit opens on what it finds in the statement already imported on S9).
//
// Privacy (CLAUDE.md rule 6): only the masked lines that were already sent to the categorizer (masked
// label, amount, month, day) and how each label was sorted. Never written to storage, gone on reload,
// and taken once: the first reader clears it.
import type { StatementCategorizeResponse, StatementItem } from '@lifeguessr/types';

export type StatementRead = {
  items: StatementItem[];
  classes: StatementCategorizeResponse['classes'];
};

let last: StatementRead | null = null;

/** Records a statement read (called by `readStatementFile` once the categorizer answered). */
export function rememberStatementRead(read: StatementRead): void {
  last = { items: [...read.items], classes: read.classes ? [...read.classes] : read.classes };
}

/** The last statement read, if any, and forgets it. */
export function takeStatementRead(): StatementRead | null {
  const read = last;
  last = null;
  return read;
}
