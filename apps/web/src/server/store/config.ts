// Server-only: which store backs sessions and funnel events (and, later, the game), from the environment.
// Read on every call rather than at import, so a test's vi.stubEnv applies without a restart.
//
//   STORE_URL=postgres://user:password@host:5432/db   → Postgres (production: the compose service)
//   STORE_URL unset, NODE_ENV !== 'production'         → in-memory (tests, `pnpm dev` without a DB)
//   STORE_URL unset or invalid in production           → not configured: routes answer 503
//
// Production never falls back to memory: a store that forgets everything on restart would look
// like it works while losing every save.

export type StoreConfig =
  | { kind: 'postgres'; url: string }
  | { kind: 'memory' }
  | { kind: 'missing'; problem: string };

const POSTGRES_URL = /^postgres(ql)?:\/\//;

let warnedMemory = false;

export function storeConfig(env: NodeJS.ProcessEnv = process.env): StoreConfig {
  const url = env.STORE_URL?.trim();
  if (url) {
    if (!POSTGRES_URL.test(url) || !URL.canParse(url)) {
      return { kind: 'missing', problem: 'STORE_URL is not a postgres:// URL' };
    }
    return { kind: 'postgres', url };
  }
  if (env.NODE_ENV === 'production') {
    return { kind: 'missing', problem: 'STORE_URL is not set; sessions cannot be saved' };
  }
  if (!warnedMemory && env.NODE_ENV !== 'test') {
    warnedMemory = true;
    console.warn('[store] STORE_URL is not set: using an in-memory store that forgets everything on restart (dev only).');
  }
  return { kind: 'memory' };
}
