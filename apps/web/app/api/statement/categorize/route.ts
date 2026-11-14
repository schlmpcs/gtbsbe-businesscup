// POST /api/statement/categorize  { items: StatementItem[] }            (T7)
//   200 { ok: true, months: CategoryTotals[], categorizedBy: 'ai' | 'rules' | 'mixed' }
//       One CategoryTotals per month, oldest first. `totals` leave out one-off charges (listed in
//       `oneOffs`); `detectedPay` is the take-home pay that came in that month.
//   4xx { ok: false, error: { code, ... } }
//       400 bad_request · 413 too_large · 429 rate_limited
// Nothing is stored: the items live only for this request. Labels arrive masked from the browser
// and are masked again before the LLM sees them; without an API key the keyword rules sort them.
// Spec: docs/ARCHITECTURE.md → Server routes, Privacy design; docs/ENGINEERING.md → Statements.
import { StatementCategorizeRequestSchema } from '@lifeguessr/types';
import { getLlmClient } from '@/server/ai/client';
import { checkAiRateLimit, json, readJsonBody } from '@/server/ai/http';
import { categorizeStatement, MAX_STATEMENT_BODY_BYTES } from '@/server/statement/categorize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  // The strictest limits in the app: this route can make up to four LLM calls.
  const limited = checkAiRateLimit(req);
  if (limited) return limited;

  const body = await readJsonBody(req, StatementCategorizeRequestSchema, MAX_STATEMENT_BODY_BYTES);
  if ('response' in body) return body.response;

  const result = await categorizeStatement(body.data.items, getLlmClient());
  return json({ ok: true, ...result });
}
