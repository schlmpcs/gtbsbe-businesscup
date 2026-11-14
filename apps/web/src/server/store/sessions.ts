// Server-only: sessions (T4). The profile and wishlist saved under an anonymous id, so a reload
// (or a browser that lost its app state but kept its id) restores them without an account.
//
// The rules live here once, as pure functions; the Postgres and memory stores only load and
// write rows around them, so both behave the same:
// - A save replaces each field it carries, whole. A field it leaves out stays as it was.
// - Saving to the wishlist is a Pro feature (docs/ARCHITECTURE.md → What is gated). Without Pro a
//   save may keep or remove saved purchases but not add one; items saved earlier stay.
// - Each save bumps `revision`, under the row lock, so concurrent saves for one id apply one
//   after the other and the result is always exactly one request's fields.
import { ProfileSchema, PurchaseSchema, type Profile, type Purchase, type SessionState } from '@lifeguessr/types';

export type { SessionState } from '@lifeguessr/types';

export type SessionUpdate = { profile?: Profile; wishlist?: Purchase[] };

export type SaveOptions = {
  /** True for a Pro user: the wishlist may grow. Otherwise it may only keep or drop items. */
  mayAddToWishlist: boolean;
};

export type SaveResult = { ok: true; session: SessionState } | { ok: false; reason: 'wishlist_locked' };

export interface SessionStore {
  /** The saved state for this id; an empty state (revision 0) when nothing was saved. */
  load(anonId: string): Promise<SessionState>;
  /** Applies `update` atomically. An update with no fields is a load and writes nothing. */
  save(anonId: string, update: SessionUpdate, opts: SaveOptions): Promise<SaveResult>;
}

export const emptySession = (): SessionState => ({ wishlist: [], revision: 0, updatedAt: null });

/** JSON with object keys sorted, so equal values compare equal whatever order they were built in. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** True when `next` holds a purchase (counting duplicates) that `saved` does not. */
export function addsToWishlist(saved: readonly Purchase[], next: readonly Purchase[]): boolean {
  const available = new Map<string, number>();
  for (const p of saved) {
    const key = canonicalJson(p);
    available.set(key, (available.get(key) ?? 0) + 1);
  }
  for (const p of next) {
    const key = canonicalJson(p);
    const left = available.get(key) ?? 0;
    if (left === 0) return true;
    available.set(key, left - 1);
  }
  return false;
}

/** The pure state transition of a save. `now` is an ISO timestamp. */
export function applySessionUpdate(current: SessionState, update: SessionUpdate, opts: SaveOptions, now: string): SaveResult {
  if (update.profile === undefined && update.wishlist === undefined) return { ok: true, session: current };
  if (update.wishlist !== undefined && !opts.mayAddToWishlist && addsToWishlist(current.wishlist, update.wishlist)) {
    return { ok: false, reason: 'wishlist_locked' };
  }
  const profile = update.profile ?? current.profile;
  return {
    ok: true,
    session: {
      ...(profile !== undefined && { profile }),
      wishlist: update.wishlist ?? current.wishlist,
      revision: current.revision + 1,
      updatedAt: now,
    },
  };
}

/**
 * Reads stored JSON back through the current contracts. A profile saved under an older contract
 * that no longer parses is dropped (the browser keeps its own copy), and so is a broken wishlist
 * item; neither turns a load into an error.
 */
export function decodeStored(profile: unknown, wishlist: unknown): Pick<SessionState, 'profile' | 'wishlist'> {
  const parsedProfile = profile == null ? undefined : ProfileSchema.safeParse(profile);
  if (parsedProfile && !parsedProfile.success) console.warn('[store] a saved profile no longer matches the Profile contract; ignoring it');
  const items = Array.isArray(wishlist) ? wishlist : [];
  const purchases = items.flatMap((item) => {
    const parsed = PurchaseSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
  return {
    ...(parsedProfile?.success && { profile: parsedProfile.data }),
    wishlist: purchases,
  };
}
