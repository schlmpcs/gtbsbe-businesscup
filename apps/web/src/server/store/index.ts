// Server-only: the app's store (sessions, the T5 daily game, T8 funnel events).
//
//   getStore()            the process-wide Store for STORE_URL (Postgres), or in memory in dev and
//                         tests. Throws StoreUnavailableError('not_configured') in production
//                         without STORE_URL: it never falls back to memory there.
//   store.sessions        SessionStore (./sessions.ts)
//   store.game            GameStore (./game.ts): clues opened, scored guesses, leaderboard
//   store.events          EventStore (./events.ts): funnel events and the funnel report
//   store.db              the Postgres connection (null in memory), for server modules that own
//                         their tables, e.g. Pro entitlements (server/pro/store.ts)
//   storeHealth()         { status, backend, reason } for /api/health, with a short timeout
//   storeErrorResponse()  StoreUnavailableError → 503 (./http.ts)
//
// Adding a domain (e.g. T5 guesses): write `<domain>.ts` (interface + pure rules), then
// `<domain>.postgres.ts` and `<domain>.memory.ts`, add the field to Store and to both factories
// below, and add a migration (./migrations/index.ts explains the rules).
import { storeConfig } from './config';
import { StoreUnavailableError, type StoreUnavailableReason } from './errors';
import type { GameStore } from './game';
import { createMemoryGameStore } from './game.memory';
import { createPostgresGameStore } from './game.postgres';
import { createDb, type Db, type DbOptions } from './postgres';
import type { EventStore } from './events';
import { createMemoryEventStore } from './events.memory';
import { createPostgresEventStore } from './events.postgres';
import type { SessionStore } from './sessions';
import { createMemorySessionStore } from './sessions.memory';
import { createPostgresSessionStore } from './sessions.postgres';

export { StoreUnavailableError, type StoreUnavailableReason } from './errors';
export { anonKey } from './anonKey';
export type { Db, Tx } from './postgres';
export type { SaveOptions, SaveResult, SessionState, SessionStore, SessionUpdate } from './sessions';
export type { GameStore, Leaderboard, PlayerDay, PlayKey, StoredResult, SubmitOutcome } from './game';
export type { EventStore, FunnelWindow, StoredEvent } from './events';

export interface Store {
  readonly backend: 'postgres' | 'memory';
  readonly sessions: SessionStore;
  readonly game: GameStore;
  readonly events: EventStore;
  /** The Postgres connection, or null for the memory store. */
  readonly db: Db | null;
  /** Resolves when the store is usable (connected and migrated); throws StoreUnavailableError otherwise. */
  check(): Promise<void>;
  close(): Promise<void>;
}

export function createPostgresStore(url: string, opts: DbOptions = {}): Store {
  const db = createDb(url, opts);
  return {
    backend: 'postgres',
    sessions: createPostgresSessionStore(db),
    game: createPostgresGameStore(db),
    events: createPostgresEventStore(db),
    db,
    check: () => db.check(),
    close: () => db.close(),
  };
}

export function createMemoryStore(): Store {
  return {
    backend: 'memory',
    sessions: createMemorySessionStore(),
    game: createMemoryGameStore(),
    events: createMemoryEventStore(),
    db: null,
    check: async () => {},
    close: async () => {},
  };
}

// Kept on globalThis, not in a module variable: if the bundler ever gives two routes their own
// copy of this module, they still share one pool (and, in dev, one memory store).
const SINGLETON = Symbol.for('lifeguessr.store');
const OVERRIDE = Symbol.for('lifeguessr.store.override');
type Slot = { key: string; store: Store };
type Holder = typeof globalThis & { [SINGLETON]?: Slot; [OVERRIDE]?: Store | null };
const holder = globalThis as Holder;

const loggedProblems = new Set<string>();

/** The process-wide store. Throws StoreUnavailableError when STORE_URL is missing in production. */
export function getStore(): Store {
  const override = holder[OVERRIDE];
  if (override) return override;

  const config = storeConfig();
  if (config.kind === 'missing') {
    if (!loggedProblems.has(config.problem)) {
      loggedProblems.add(config.problem);
      console.error(`[store] ${config.problem}`);
    }
    throw new StoreUnavailableError('not_configured', config.problem);
  }
  const key = config.kind === 'postgres' ? `postgres:${config.url}` : 'memory';
  if (holder[SINGLETON]?.key !== key) {
    holder[SINGLETON] = { key, store: config.kind === 'postgres' ? createPostgresStore(config.url) : createMemoryStore() };
  }
  return holder[SINGLETON].store;
}

/** Tests: make getStore() return `store` (null restores the environment's store). */
export function setStoreForTests(store: Store | null): void {
  holder[OVERRIDE] = store;
}

export type StoreHealth = {
  status: 'ok' | 'unavailable';
  backend: 'postgres' | 'memory' | null;
  /** Why the store is unavailable (no details: /api/health is public). */
  reason?: StoreUnavailableReason | 'timeout';
};

/**
 * For /api/health: never throws, and answers within `timeoutMs` even when the database hangs, so
 * the container's liveness probe never waits on the store.
 */
export async function storeHealth(timeoutMs = 2_000): Promise<StoreHealth> {
  let store: Store;
  try {
    store = getStore();
  } catch (err) {
    const reason = err instanceof StoreUnavailableError ? err.reason : 'not_configured';
    return { status: 'unavailable', backend: null, reason };
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), timeoutMs);
  });
  try {
    const outcome = await Promise.race([store.check().then(() => 'ok' as const), timeout]);
    if (outcome === 'timeout') return { status: 'unavailable', backend: store.backend, reason: 'timeout' };
    return { status: 'ok', backend: store.backend };
  } catch (err) {
    const reason = err instanceof StoreUnavailableError ? err.reason : 'unreachable';
    if (!(err instanceof StoreUnavailableError)) console.error('[store] health check failed:', err);
    return { status: 'unavailable', backend: store.backend, reason };
  } finally {
    clearTimeout(timer);
  }
}
