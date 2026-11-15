// POST /api/ai/parse  { kind: 'life' | 'purchase' | 'loan' | 'spend' | 'plan', text, debts? }
//   200 { ok: true, kind, value, needsConfirmation: true, inferred }
//       value: ProfilePatch | Purchase | LoanInput | SpendItem[] | WhatIfParse, validated with @lifeguessr/types schemas.
//       ('spend' = the daily log: every amount must be written in the text.)
//       ('plan' = "Write your what-if": { items: WhatIfItem[] }, at most 8; a move only to a covered
//       metro; amounts only when written in the text; years may be resolved from "next year".)
//       These are parsed *inputs*: the UI shows them for the user to confirm before they enter
//       the profile. `inferred` lists paths not written literally in the text.
//   4xx/5xx { ok: false, error: { code, ... }, fallback: 'manualForm' }
//       400 bad_request · 413 too_large · 429 rate_limited · 503 unavailable (no API key)
//       422 nothing_found | incomplete (error.missing) | invalid_output · 502 upstream_error
// Spec: docs/ARCHITECTURE.md → Server routes; docs/ENGINEERING.md → AI usage rules.
import { getLlmClient } from '@/server/ai/client';
import { checkAiRateLimit, errorResponse, json, readJsonBody } from '@/server/ai/http';
import { parseText, type ParseErrorCode } from '@/server/ai/parse';
import { MAX_PARSE_BODY_BYTES, ParseRequestSchema } from '@/server/ai/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUS: Record<ParseErrorCode, number> = {
  unavailable: 503,
  nothing_found: 422,
  incomplete: 422,
  invalid_output: 422,
  upstream_error: 502,
};

export async function POST(req: Request): Promise<Response> {
  const limited = checkAiRateLimit(req);
  if (limited) return limited;

  const body = await readJsonBody(req, ParseRequestSchema, MAX_PARSE_BODY_BYTES);
  if ('response' in body) return body.response;

  const outcome = await parseText(body.data, getLlmClient());
  if (!outcome.ok) {
    const { ok: _ok, code, ...details } = outcome;
    return errorResponse(STATUS[code], code, { ...details, fallback: 'manualForm' });
  }
  return json({
    ok: true,
    kind: outcome.kind,
    value: outcome.value,
    needsConfirmation: true,
    inferred: outcome.inferred,
  });
}
