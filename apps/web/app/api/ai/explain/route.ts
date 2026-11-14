// POST /api/ai/explain  { move?: Move, loanResult?: LoanResult }  (at least one)
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
