// POST /api/ai/growth  "Estimate with AI" for yearly growth rates (GrowthEstimateRequest, packages/types)
//   { mode: 'account', account: { group, name, value } }   one account: its type, the name typed, its value
//   { mode: 'plan', area?, groups: [{ group, total, count }], defaults }   a suggestion per asset group
//   200 { ok: true, source: 'ai', estimates: [{ group, rate, reason }], rejected: AssetGroup[] }
//       Each rate is a decimal per year that passed the checks in code (finite, inside its group's
//       envelope: aiGrowthEnvelope; a reason that agrees with it). `rejected` = plan groups whose answer
//       failed twice: they keep the engine default. The model only proposes these inputs; plan() and
//       monteCarlo() do every projection. The UI labels them "AI estimate" and the person may edit them.
//   4xx/5xx { ok: false, error: { code, ... }, fallback: 'default' }
//       400 bad_request · 413 too_large · 429 rate_limited (the budget is shared with parse and explain)
//       503 unavailable (no API key) · 422 invalid_output · 502 upstream_error
//   Nothing is stored; the name is never logged.
// Spec: docs/ENGINEERING.md → AI growth estimate.
import { GrowthEstimateRequestSchema } from '@lifeguessr/types';
import { getLlmClient } from '@/server/ai/client';
import { estimateGrowth, type GrowthErrorCode } from '@/server/ai/growth';
import { checkAiRateLimit, errorResponse, json, readJsonBody } from '@/server/ai/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Request body cap in bytes: a 120-character name or six group totals is well under 1 KB. */
const MAX_GROWTH_BODY_BYTES = 4 * 1024;

const STATUS: Record<GrowthErrorCode, number> = {
  unavailable: 503,
  invalid_output: 422,
  upstream_error: 502,
};

export async function POST(req: Request): Promise<Response> {
  const limited = checkAiRateLimit(req);
  if (limited) return limited;

  const body = await readJsonBody(req, GrowthEstimateRequestSchema, MAX_GROWTH_BODY_BYTES);
  if ('response' in body) return body.response;

  const outcome = await estimateGrowth(body.data, getLlmClient());
  if (!outcome.ok) return errorResponse(STATUS[outcome.code], outcome.code, { fallback: 'default' });
  return json({ ok: true, source: 'ai', estimates: outcome.estimates, rejected: outcome.rejected });
}
