// POST /api/session  { anonId, profile?, wishlist? }   (header x-anon-id, if sent, must match)
//   { anonId } alone loads; with profile and/or wishlist it saves those fields (each one whole).
//   200 SessionResponse { ok: true, profile?, wishlist, revision, updatedAt }
//   400 bad_request · 402 not_paid (the save would add to the wishlist without Pro) · 413 too_large
//   429 rate_limited · 503 unavailable (no store configured, the database is down, or the Pro
//   store cannot be read)
// GET /api/session   (header x-anon-id)  → the same 200 reply: a load without a body.
//
// anonId = crypto.randomUUID() from the browser; it travels in the body or a header, never in a
// URL. The store keys rows by its sha256 (server/store/anonKey.ts). Gate: saving to the wishlist
// is Pro (docs/ARCHITECTURE.md → What is gated); without Pro a save may keep or remove saved
// purchases but not add one, and the profile always saves.
// Spec: docs/ARCHITECTURE.md → Server routes; contract: SessionRequestSchema, SessionResponseSchema.
import { SessionRequestSchema, type SessionState } from '@lifeguessr/types';
import { json, readJsonBody } from '@/server/ai/http';
import { proStatusFor } from '@/server/pro/http';
import {
  checkAnonLimit, checkIpLimit, MAX_SESSION_BODY_BYTES, readAnonIdHeader, sessionError,
} from '@/server/session/http';
import { getStore } from '@/server/store';
import { storeErrorResponse } from '@/server/store/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const reply = (session: SessionState): Response => json({ ok: true, ...session });

export async function POST(req: Request): Promise<Response> {
  const ipLimited = checkIpLimit(req);
  if (ipLimited) return ipLimited;

  const header = readAnonIdHeader(req);
  if ('response' in header) return header.response;

  const body = await readJsonBody(req, SessionRequestSchema, MAX_SESSION_BODY_BYTES);
  if ('response' in body) return body.response;
  const { anonId, profile, wishlist, goal } = body.data;
  if (header.anonId !== null && header.anonId !== anonId) {
    return sessionError(400, 'bad_request', { issues: ['x-anon-id does not match anonId'] });
  }

  const anonLimited = checkAnonLimit(anonId);
  if (anonLimited) return anonLimited;

  try {
    const { sessions } = getStore();

    // Only a non-empty wishlist can add anything, so only then is Pro looked up.
    let mayAddToWishlist = false;
    if (wishlist !== undefined && wishlist.length > 0) {
      const status = await proStatusFor(anonId);
      if ('response' in status) return status.response;
      mayAddToWishlist = status.pro;
    }

    const result = await sessions.save(anonId, { profile, wishlist, goal }, { mayAddToWishlist });
    if (!result.ok) {
      return sessionError(402, 'not_paid', { issues: ['adding to the wishlist needs Pro; saved items stay and can be removed'] });
    }
    return reply(result.session);
  } catch (err) {
    return storeErrorResponse(err, 'session');
  }
}

export async function GET(req: Request): Promise<Response> {
  const ipLimited = checkIpLimit(req);
  if (ipLimited) return ipLimited;

  const header = readAnonIdHeader(req);
  if ('response' in header) return header.response;
  if (header.anonId === null) return sessionError(400, 'bad_request', { issues: ['x-anon-id header is missing'] });

  const anonLimited = checkAnonLimit(header.anonId);
  if (anonLimited) return anonLimited;

  try {
    return reply(await getStore().sessions.load(header.anonId));
  } catch (err) {
    return storeErrorResponse(err, 'session');
  }
}
