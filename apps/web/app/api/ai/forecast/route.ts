// POST /api/ai/forecast  { profile, rates?: { inflationAnnual }, scenarios?: [{ id, patch }] }
//   200 ForecastBundle { source: 'ai' | 'rules', model?, base, scenarios: { [id]: Forecast } }
//       The 10-year forecast of the profile and of each scenario (a candidate move's patch), in
//       nominal dollars (todaysDollars: false), 121 monthly points each, month 0 = today's net
//       worth. 'ai' = a model answer that passed the checks in code; 'rules' = the rules engine,
//       which is also the answer with no API key, a provider error, a refusal, a timeout or two
//       failed answers. Always 200 for a valid request: the screen never goes blank.
//       An identical request (same profile numbers, scenarios, rates, model and prompt version) is
//       answered from an in-memory cache for an hour, and requests in flight together share one
//       model call. Only 'ai' answers are kept, never the rules fallback (forecastCache.ts).
//   400 bad_request · 413 too_large · 429 rate_limited   ({ ok: false, error: { code, ... } })
//       Has its own rate limit (checkForecastRateLimit), apart from parse and explain.
// Spec: docs/ARCHITECTURE.md → Server routes; docs/ENGINEERING.md → AI forecast.
import { forecastModel, getLlmClient } from '@/server/ai/client';
import { forecastWithModel } from '@/server/ai/forecast';
import { forecastCache, forecastKey } from '@/server/ai/forecastCache';
import { checkForecastRateLimit, json, readJsonBody } from '@/server/ai/http';
import { ForecastRequestSchema, MAX_FORECAST_BODY_BYTES } from '@/server/ai/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  const limited = checkForecastRateLimit(req);
  if (limited) return limited;

  const body = await readJsonBody(req, ForecastRequestSchema, MAX_FORECAST_BODY_BYTES);
  if ('response' in body) return body.response;

  // An identical request is answered from memory (AI answers only) or joins the call in flight.
  const bundle = await forecastCache.getOrCompute(
    forecastKey(body.data, forecastModel()),
    () => forecastWithModel(body.data, getLlmClient()),
  );
  return json(bundle);
}
