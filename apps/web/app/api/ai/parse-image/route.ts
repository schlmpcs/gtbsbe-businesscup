// POST /api/ai/parse-image  { kind: 'debt' | 'loan', mediaType, data (base64) }   (JF9)
//   200 { ok: true, kind, value, needsConfirmation: true }
//       value: { kind, balance, apr, minPayment } for 'debt' (kind/apr/minPayment may be null),
//              LoanInput for 'loan'. Parsed *inputs*: the user confirms them before they are used.
//   4xx/5xx { ok: false, error: { code, ... }, fallback: 'manualForm' }
//       400 bad_request · 413 too_large · 429 rate_limited · 503 unavailable (no API key)
//       422 nothing_found | incomplete (error.missing) | invalid_output · 502 upstream_error
// The file is read in memory for this request and never stored or logged.
import { getLlmClient } from '@/server/ai/client';
import { checkAiRateLimit, errorResponse, json, readJsonBody } from '@/server/ai/http';
import type { ParseErrorCode } from '@/server/ai/parse';
import { ImageParseRequestSchema, MAX_IMAGE_BODY_BYTES, parseImage } from '@/server/ai/parseImage';

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

  const body = await readJsonBody(req, ImageParseRequestSchema, MAX_IMAGE_BODY_BYTES);
  if ('response' in body) return body.response;

  const outcome = await parseImage(body.data, getLlmClient());
  if (!outcome.ok) {
    const { ok: _ok, code, ...details } = outcome;
    return errorResponse(STATUS[code], code, { ...details, fallback: 'manualForm' });
  }
  return json({ ok: true, kind: outcome.kind, value: outcome.value, needsConfirmation: true });
}
