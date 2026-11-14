// Client for POST /api/ai/forecast (Y16, apps/web/app/api/ai/forecast/route.ts):
//   { profile, rates?: { inflationAnnual }, scenarios: [{ id, patch }] }
//   → 200 ForecastBundle { source: 'ai' | 'rules', model?, base, scenarios: { [id]: Forecast } }
//   → 400 / 413 / 429 { ok: false, error: { code } }
// Every forecast in the bundle is in nominal dollars (todaysDollars: false); the caller deflates.
// The route answers 200 with the rules forecast when the model is unavailable, so an ApiError here
// means the route itself failed (rate limit, bad request, network), and the caller falls back too.
import { ForecastBundleSchema, type ForecastBundle, type Profile, type ProfilePatch, type Rate } from '@lifeguessr/types';
import { postJson } from './http';

/** One what-if the model forecasts next to the base: a candidate move's patch under its id. */
export type ScenarioPatch = { id: string; patch: ProfilePatch };

export type ForecastBundleOptions = {
  /** The area's inflation, so the model and the rules fallback use the rate the screen deflates by. */
  rates?: { inflationAnnual: Rate };
  anonId?: string;
  signal?: AbortSignal;
};

/** Ask the server for the forecast of `profile` and of each scenario (`{ profile, rates, scenarios }`). */
export function fetchForecastBundle(
  profile: Profile,
  scenarios: readonly ScenarioPatch[],
  opts: ForecastBundleOptions = {},
): Promise<ForecastBundle> {
  return postJson('/api/ai/forecast', { profile, rates: opts.rates, scenarios }, ForecastBundleSchema, {
    anonId: opts.anonId,
    signal: opts.signal,
  });
}
