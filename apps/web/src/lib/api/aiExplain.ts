// Client for POST /api/ai/explain (Y12, apps/web/app/api/ai/explain/route.ts):
//   ExplainRequest { move?: Move & { source?: 'ai' | 'rules' }, loanResult?: ExplainLoanResult }  → 200 { text, source: 'ai' | 'template' }
//   → 4xx { ok: false, error: { code } }
// The text is two sentences of language about an engine result; it never carries a new number
// (the server checks). When the model is unavailable the server answers with a template.
import type { ExplainRequest, ExplainResponse, ForecastSource, LoanResult, Move, Rate } from '@lifeguessr/types';
import { z } from 'zod';
import { postJson } from './http';

export type ExplainResult = ExplainResponse;

const ExplainResponseSchema = z.object({
  text: z.string().min(1),
  source: z.enum(['ai', 'template']),
}) satisfies z.ZodType<ExplainResponse>;

/**
 * A debt load as the request carries it. The engine returns Infinity when there are debt payments
 * but no take-home pay; JSON has no Infinity (it would turn into a bare null the server can't tell
 * from a bug), so that case is sent as an explicit null: "no take-home pay to measure it against".
 */
function debtLoadForRequest(load: Rate): Rate | null {
  if (load === Number.POSITIVE_INFINITY) return null;
  if (!Number.isFinite(load)) throw new RangeError(`Invalid debt load: ${load}`);
  return load;
}

/**
 * What callers pass: engine results as they are (a debt load may be Infinity; it is converted here).
 * A move may carry the forecast its `effect10y` came from (a MoveVM does); the server words the
 * sentence by it. `null` means unknown and is not sent, which keeps the server's default wording.
 */
export type ExplainInput = {
  move?: Move & { source?: ForecastSource | null };
  loanResult?: Omit<LoanResult, 'schedule'>;
};

export type ExplainOptions = { anonId?: string; signal?: AbortSignal };

/** Ask the server to explain a move and/or a loan result in two plain sentences. */
export async function explainResult(input: ExplainInput, opts: ExplainOptions = {}): Promise<ExplainResult> {
  const body: ExplainRequest = {};
  // Send only the contract fields (a MoveVM carries UI flags; a LoanResult's schedule is unused).
  if (input.move) {
    const { id, kind, level, category, effect10y, patch, source } = input.move;
    body.move = { id, kind, level, effect10y, patch, ...(category ? { category } : {}), ...(source ? { source } : {}) };
  }
  if (input.loanResult) {
    const { monthly, totalInterest, totalCost, payoffMonth, debtLoadBefore, debtLoadAfter, effect10y } = input.loanResult;
    body.loanResult = {
      monthly, totalInterest, totalCost, payoffMonth, effect10y,
      debtLoadBefore: debtLoadForRequest(debtLoadBefore),
      debtLoadAfter: debtLoadForRequest(debtLoadAfter),
    };
  }
  return postJson('/api/ai/explain', body, ExplainResponseSchema, opts);
}
