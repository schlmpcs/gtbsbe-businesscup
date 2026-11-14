// Server-only: asks the model for the demo profile's forecast once, when the server starts
// (instrumentation.ts), so the first visitor (the demo path: no sign-up, the demo profile, no
// statement) gets the AI answer from the cache instead of waiting ~15–20 s for it. The answer is
// kept for as long as the process runs; every other profile keeps the cache's normal time to live.
// Without an API key, or when the model's answer fails the checks, nothing is stored (rules answers
// never are) and the first visitor's request asks again, as before.
import { moveCandidates } from '@lifeguessr/engine';
import { buildRequest } from '@/features/forecast/model/forecastAnswer';
import { cloneProfileDemo } from '@/fixtures';
import { areaRates } from '@/lib/model/profile';
import { forecastModel, getLlmClient } from './client';
import { forecastWithModel } from './forecast';
import { forecastCache, forecastKey, type ForecastCache } from './forecastCache';
import { ForecastRequestSchema, type ForecastRequest } from './schemas';

/**
 * The request a new visitor's S1/S10 sends, parsed as the route parses it: the demo profile (the
 * store's starting state), Next Moves' candidates with no statement uploaded
 * (`subscriptionsDetected: false`), no committed move, the ZIP's inflation.
 */
export function demoForecastRequest(): ForecastRequest {
  const profile = cloneProfileDemo();
  const candidates = moveCandidates(profile, { rates: areaRates(profile), subscriptionsDetected: false });
  const { scenarios, rates } = buildRequest(profile, candidates, undefined);
  return ForecastRequestSchema.parse({ profile, rates, scenarios });
}

/**
 * Computes and stores the demo answer (for as long as the process runs) and logs one line with the
 * source and the time it took. Never throws: a failure here only means the first visitor waits.
 */
export async function prewarmDemoForecast(cache: ForecastCache = forecastCache): Promise<void> {
  const client = getLlmClient();
  if (!client) return; // no key: the rules engine answers at once anyway
  const startedAt = Date.now();
  try {
    const req = demoForecastRequest();
    const bundle = await cache.getOrCompute(
      forecastKey(req, forecastModel()),
      () => forecastWithModel(req, client),
      { ttlMs: Number.POSITIVE_INFINITY },
    );
    console.info(`[ai/forecast] prewarm: demo profile answered by ${bundle.source} in ${Date.now() - startedAt} ms`);
  } catch (error) {
    console.warn(`[ai/forecast] prewarm failed: ${error instanceof Error ? error.constructor.name : typeof error}`);
  }
}
