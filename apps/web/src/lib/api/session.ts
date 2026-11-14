// Session adapter for POST /api/session (task T4): `{ anonId, profile?, wishlist? }` → saved state.
// 'local' mode is a no-op (localStorage already keeps everything). 'api' mode feature-detects the
// route: the first 404/405/501 turns the adapter off for the rest of the page load, so the app
// keeps working before T4 is deployed.
import { ProfileSchema, PurchaseSchema, type Profile, type Purchase } from '@lifeguessr/types';
import { z } from 'zod';
import { sessionSource, type SessionSource } from '@/lib/config';
import { ApiError, postJson } from './http';

export type SessionPayload = { profile?: Profile; wishlist?: Purchase[] };

export interface SessionAdapter {
  /** False in local mode, or once the route turned out not to exist. */
  readonly enabled: boolean;
  /** Save the profile and wishlist under the anonymous id. Never throws. */
  save(anonId: string, payload: SessionPayload): Promise<void>;
  /** The saved state for this anonymous id, or null (none, disabled, or failed). Never throws. */
  load(anonId: string): Promise<SessionPayload | null>;
}

/** Saved state as the route returns it; unknown fields are ignored, broken ones dropped. */
const SavedSessionSchema = z.object({
  profile: ProfileSchema.optional().catch(undefined),
  wishlist: z.array(PurchaseSchema).optional().catch(undefined),
});

const ROUTE_MISSING = new Set([404, 405, 501]);

export function createLocalSessionAdapter(): SessionAdapter {
  return {
    enabled: false,
    save: async () => {},
    load: async () => null,
  };
}

export function createHttpSessionAdapter(url = '/api/session'): SessionAdapter {
  let enabled = true;
  const call = async (anonId: string, payload: SessionPayload): Promise<SessionPayload | null> => {
    if (!enabled) return null;
    try {
      const saved = await postJson(url, { anonId, ...payload }, SavedSessionSchema, { anonId });
      return { profile: saved.profile, wishlist: saved.wishlist };
    } catch (err) {
      if (err instanceof ApiError && ROUTE_MISSING.has(err.status)) enabled = false;
      return null;
    }
  };
  return {
    get enabled() {
      return enabled;
    },
    save: async (anonId, payload) => {
      await call(anonId, payload);
    },
    load: (anonId) => call(anonId, {}),
  };
}

export function createSessionAdapter(source: SessionSource = sessionSource()): SessionAdapter {
  return source === 'api' ? createHttpSessionAdapter() : createLocalSessionAdapter();
}
