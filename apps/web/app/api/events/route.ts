// POST /api/events  { anonId, events: [{ id, name, props? }, …] }   (header x-anon-id, if sent, must match)
//   200 { ok: true, accepted }   accepted = events stored now (a resent id is skipped)
//   400 bad_request · 413 too_large · 429 rate_limited · 503 unavailable (no store, or it is down)
//
// Funnel events (T8; docs/PRODUCT.md → Metrics to show), sent in small batches by the browser
// (src/lib/events.ts). Only names from CLIENT_EVENT_NAMES, and props of small enums and counts
// (EventsRequestSchema refuses anything else), so no personal data can be stored. Rows are keyed
// by the hash of the anonymous id and carry the server's clock. GET /api/events/funnel reads them.
// Spec: docs/ARCHITECTURE.md → Server routes; contract: EventsRequestSchema, EventsResponseSchema.
import { EventsRequestSchema } from '@lifeguessr/types';
import { json, readJsonBody } from '@/server/ai/http';
import { checkEventsAnonLimit, checkEventsIpLimit, eventsError, MAX_EVENTS_BODY_BYTES } from '@/server/events/http';
import { readAnonIdHeader } from '@/server/session/http';
import { getStore } from '@/server/store';
import { storeErrorResponse } from '@/server/store/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  const ipLimited = checkEventsIpLimit(req);
  if (ipLimited) return ipLimited;

  const header = readAnonIdHeader(req);
  if ('response' in header) return header.response;

  const body = await readJsonBody(req, EventsRequestSchema, MAX_EVENTS_BODY_BYTES);
  if ('response' in body) return body.response;
  const { anonId, events } = body.data;
  if (header.anonId !== null && header.anonId !== anonId) {
    return eventsError(400, 'bad_request', { issues: ['x-anon-id does not match anonId'] });
  }

  const anonLimited = checkEventsAnonLimit(anonId);
  if (anonLimited) return anonLimited;

  try {
    const accepted = await getStore().events.record(anonId, events);
    return json({ ok: true, accepted });
  } catch (err) {
    return storeErrorResponse(err, 'events');
  }
}
