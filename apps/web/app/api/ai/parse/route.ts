// POST /api/ai/parse  { kind: 'life' | 'purchase' | 'loan', text, debts? }
//                     { kind: 'scenario', text, homeZip? }  ("What if…": one ScenarioChange)
//   200 { ok: true, kind, value, needsConfirmation: true, inferred }
//       value: ProfilePatch | Purchase | LoanInput, validated with @lifeguessr/types schemas.
//       kind 'scenario': value is a ScenarioChange, plus parsedBy: 'ai' | 'rules' (the rules reader
//       answers with no API key or when the model's answer does not validate).
//       These are parsed *inputs*: the UI shows them for the user to confirm before they enter
//       the profile. `inferred` lists paths not written literally in the text.
//   4xx/5xx { ok: false, error: { code, ... }, fallback: 'manualForm' }
//       400 bad_request · 413 too_large · 429 rate_limited · 503 unavailable (no API key)
//       422 nothing_found | incomplete (error.missing) | invalid_output · 502 upstream_error
// Spec: docs/ARCHITECTURE.md → Server routes; docs/ENGINEERING.md → AI usage rules.
import { getLlmClient } from '@/server/ai/client';
import { checkAiRateLimit, errorResponse, json, readJsonBody } from '@/server/ai/http';
import { parseText, type ParseErrorCode } from '@/server/ai/parse';
import { parseScenario, ScenarioParseRequestSchema } from '@/server/ai/parseScenario';
import { MAX_PARSE_BODY_BYTES, ParseRequestSchema } from '@/server/ai/schemas';
import { z } from 'zod';

const AnyParseRequestSchema = z.union([ParseRequestSchema, ScenarioParseRequestSchema]);

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

  const body = await readJsonBody(req, AnyParseRequestSchema, MAX_PARSE_BODY_BYTES);
  if ('response' in body) return body.response;

  if (body.data.kind === 'scenario') {
    const outcome = await parseScenario(body.data, getLlmClient());
    if (!outcome.ok) {
      const { ok: _ok, code, ...details } = outcome;
      return errorResponse(STATUS[code], code, { ...details, fallback: 'manualForm' });
    }
    return json({
      ok: true, kind: 'scenario', value: outcome.value, needsConfirmation: true, inferred: outcome.inferred, parsedBy: outcome.parsedBy,
    });
  }

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
