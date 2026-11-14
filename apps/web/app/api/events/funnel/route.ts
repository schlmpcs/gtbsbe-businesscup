// GET /api/events/funnel?days=7
//   200 FunnelResponse { ok: true, from, to, users, steps, events, game }
//   400 bad_request (days not a whole number from 1 to FUNNEL_MAX_DAYS) · 429 rate_limited
//   503 unavailable (no store, or it is down)
//
// The funnel and game metrics of docs/PRODUCT.md → Metrics to show, over the last `days` days
// (default 7): distinct anonymous ids per step, how many went through every step before it, and
// the conversion between steps; clues opened per home, blind-guess, finish and share rates.
// Aggregates only: nothing in the reply identifies a person or an anonymous id.
// Spec: docs/ARCHITECTURE.md → Server routes; contract: FunnelResponseSchema.
import { FUNNEL_MAX_DAYS } from '@lifeguessr/types';
import { json } from '@/server/ai/http';
import { checkFunnelLimit, eventsError, parseFunnelDays } from '@/server/events/http';
import { getStore } from '@/server/store';
import { lastDays } from '@/server/store/events';
import { storeErrorResponse } from '@/server/store/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  const limited = checkFunnelLimit(req);
  if (limited) return limited;

  const days = parseFunnelDays(new URL(req.url).searchParams.get('days'));
  if (days === null) return eventsError(400, 'bad_request', { issues: [`days must be a whole number from 1 to ${FUNNEL_MAX_DAYS}`] });

  try {
    const report = await getStore().events.funnel(lastDays(days));
    return json({ ok: true, ...report });
  } catch (err) {
    return storeErrorResponse(err, 'events/funnel');
  }
}
