// The statement path of the audit: the existing browser pipeline (S9: `readStatementFile` reads the CSV
// on this device, masks every label, sends only masked label, amount, month and day to
// /api/statement/categorize) with the two things the audit needs from it kept: the masked lines and
// how each label was sorted. The pipeline itself is not changed: its categorizer is wrapped.
import type { StatementCategorizeResponse, StatementItem } from '@lifeguessr/types';
import { readStatementFile, StatementFileError } from '@/features/upload/model/readStatementFile';
import { categorizeStatement, type CategorizeOptions } from '@/lib/api/statement';
import { toVMError } from '@/lib/model/errors';
import type { StatementErrorVM } from './types';

export type StatementForAudit = {
  /** The masked lines the browser sent, as the detector reads them. Held in memory only. */
  items: StatementItem[];
  /** How the categorizer sorted each distinct label; absent on a server that does not send it. */
  classes: StatementCategorizeResponse['classes'];
};

export type ReadForAuditDeps = CategorizeOptions & {
  /** The statement categorizer client (lib/api/statement `categorizeStatement`). */
  categorize?: typeof categorizeStatement;
};

/** Reads a statement file for the audit. Throws what `readStatementFile` throws (`StatementFileError`, `ApiError`). */
export async function readStatementForAudit(file: File, deps: ReadForAuditDeps = {}): Promise<StatementForAudit> {
  const { categorize = categorizeStatement, ...opts } = deps;
  let items: StatementItem[] = [];
  let classes: StatementCategorizeResponse['classes'];
  await readStatementFile(file, {
    ...opts,
    remember: false, // the audit keeps its own findings; nothing to hand on

    categorize: async (sent, options) => {
      items = [...sent];
      const response = await categorize(sent, options);
      classes = response.classes;
      return response;
    },
  });
  return { items, classes };
}

/** A failure of the statement path as the UI maps it to the S9 messages. */
export function toStatementError(err: unknown): StatementErrorVM {
  return err instanceof StatementFileError ? { kind: 'unreadable', reason: err.problem } : toVMError(err);
}
