// Client for POST /api/ai/growth ("Estimate with AI" for growth rates, apps/web/app/api/ai/growth/route.ts):
//   GrowthEstimateRequest → 200 GrowthEstimateResponse (validated here with the contract schema)
//   → 4xx/5xx { ok: false, error: { code }, fallback: 'default' } as an ApiError
// The rates are AI-proposed inputs (decimals per year) that the server already checked against the
// envelope; the view-models check them once more, label them "AI estimate" and let the person edit them.
import { growthEstimateIssues } from '@lifeguessr/engine';
import { GrowthEstimateResponseSchema, type GrowthEstimateRequest, type GrowthEstimateResponse } from '@lifeguessr/types';
import { postJson } from './http';

export type GrowthEstimateOptions = { anonId?: string; signal?: AbortSignal };

/** The server's answer, keeping only estimates that also pass the envelope here (defense in depth). */
export async function estimateGrowth(req: GrowthEstimateRequest, opts: GrowthEstimateOptions = {}): Promise<GrowthEstimateResponse> {
  const res = await postJson('/api/ai/growth', req, GrowthEstimateResponseSchema, opts);
  const estimates = res.estimates.filter((e) => growthEstimateIssues(e.group, e.rate).length === 0);
  const dropped = res.estimates.filter((e) => !estimates.includes(e)).map((e) => e.group);
  return { ...res, estimates, rejected: [...res.rejected, ...dropped] };
}
