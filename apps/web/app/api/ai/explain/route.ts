// POST /api/ai/explain  { move?: Move & { source?: 'ai' | 'rules' }, loanResult?: LoanResult,
//                         horizon?: { years: 1 | 3 | 5 | 10, effect } }  (a move or a loanResult, at least one)
//   A move's `source` is where its effect10y came from (the model's estimate or the rules engine);
//   the sentence names it. Without `source` the wording is "In our simulation", as before.
//   `horizon` is the year the forecast screen shows and the move's effect there: the sentence and
//   its allowed numbers use it instead of 10 years and effect10y. A loan stays at 10 years, and a
//   horizon with no move is ignored.
//   200 { text, source: 'ai' | 'template' }
//       Exactly two sentences, using only numbers from the input (checked in code). Falls back
//       to a deterministic template when there is no API key, the provider fails, or the
//       model's sentence fails a guard twice.
//   400 bad_request · 413 too_large · 429 rate_limited   ({ ok: false, error: { code, ... } })
// Spec: docs/ARCHITECTURE.md → Server routes; docs/ENGINEERING.md → AI usage rules.
import { getLlmClient } from '@/server/ai/client';
import { explain } from '@/server/ai/explain';
import { checkAiRateLimit, json, readJsonBody } from '@/server/ai/http';
import { ExplainRequestSchema, MAX_EXPLAIN_BODY_BYTES } from '@/server/ai/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  const limited = checkAiRateLimit(req);
  if (limited) return limited;

  const body = await readJsonBody(req, ExplainRequestSchema, MAX_EXPLAIN_BODY_BYTES);
  if ('response' in body) return body.response;

  return json(await explain(body.data, getLlmClient()));
}
