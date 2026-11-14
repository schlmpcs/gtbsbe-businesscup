// Server-only: sessions in process memory (tests, and `pnpm dev` without STORE_URL). Same rules
// as Postgres (./sessions.ts); each save runs without an await in between, so saves for one id
// cannot interleave. Values are copied in and out, like a database would.
import { anonKey } from './anonKey';
import { applySessionUpdate, emptySession, type SessionState, type SessionStore } from './sessions';

export function createMemorySessionStore(): SessionStore {
  const rows = new Map<string, SessionState>();

  return {
    async load(anonId) {
      return structuredClone(rows.get(anonKey(anonId)) ?? emptySession());
    },

    async save(anonId, update, opts) {
      const key = anonKey(anonId);
      const current = rows.get(key) ?? emptySession();
      const result = applySessionUpdate(current, structuredClone(update), opts, new Date().toISOString());
      if (result.ok && result.session !== current) rows.set(key, result.session);
      return structuredClone(result);
    },
  };
}
