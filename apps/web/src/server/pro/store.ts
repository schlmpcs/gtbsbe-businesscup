// Server-only: who is Pro, keyed by the anonymous id.
//
// Behind one interface, two durable implementations, picked by `getEntitlementStore`:
// - STORE_URL set: the shared Postgres store (T4; tables from migration 002). On first use it
//   imports the old JSON file once, so grants made before the move survive.
// - otherwise: one JSON file (PRO_DATA_DIR/entitlements.json) owned by a single server process,
//   the stopgap this started as (dev, and a server without the database).
//
// Rules every implementation keeps:
// - Sources rank stripe_test > demo_checkout > demo (SOURCE_RANK). A grant replaces the current
//   one only when it ranks the same or higher, and the promo code (`demo`) never replaces
//   anything: entering it after paying must not downgrade anyone, and re-entering it keeps the
//   original `since`. A demo checkout upgrades a promo grant and can change its own plan.
// - A Checkout Session unlocks Pro for exactly one anonymous id. Claiming it and granting Pro is
//   one atomic step, so a crash in between cannot leave a session claimed but not granted.
// - Anonymous ids are stored as SHA-256 hashes: the raw id also keys the user's saved profile,
//   so neither the file nor the database may hold it.
import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { ProPlanSchema, ProSourceSchema, type ProPlan, type ProSource, type ProStatus } from '@lifeguessr/types';
import { anonKey, getStore, StoreUnavailableError, type Db, type Tx } from '@/server/store';
import { storeConfig } from '@/server/store/config';
import { proDataDir } from './config';

export type Entitlement = { source: ProSource; plan?: ProPlan; since: string };

export type ClaimResult = { ok: true; entitlement: Entitlement } | { ok: false };

export interface EntitlementStore {
  get(anonId: string): Promise<Entitlement | null>;
  /** Grants Pro without a session (the promo code, the simulated checkout); returns the entitlement now in effect. */
  grant(anonId: string, entitlement: Entitlement): Promise<Entitlement>;
  /**
   * Claims a Stripe Checkout Session for `anonId` and grants its entitlement. Claiming a session
   * this anonId already holds changes nothing and returns the current entitlement (the success
   * URL can be reloaded); a session held by another anonId returns `{ ok: false }`.
   */
  claimSession(sessionId: string, anonId: string, entitlement: Entitlement): Promise<ClaimResult>;
}

/** The store cannot be read or written. Routes answer 503; the data on disk is left alone. */
export class EntitlementStoreError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'EntitlementStoreError';
  }
}

export function proStatusOf(entitlement: Entitlement | null): ProStatus {
  return entitlement ? { pro: true, ...entitlement } : { pro: false };
}

// ----- shared logic: a pure state transition per operation ----------------------------------

const EntitlementSchema = z.object({
  source: ProSourceSchema,
  plan: ProPlanSchema.optional(),
  since: z.iso.datetime(),
});

const StateSchema = z.object({
  version: z.literal(1),
  /** sha256(anonId) → entitlement */
  entitlements: z.record(z.string(), EntitlementSchema),
  /** Checkout Session id → sha256(anonId) that claimed it */
  sessions: z.record(z.string(), z.string()),
});
type State = z.infer<typeof StateSchema>;

const emptyState = (): State => ({ version: 1, entitlements: {}, sessions: {} });
const hashId = anonKey;

/** How much each source is worth when two grants meet: a higher one is never replaced by a lower one. */
const SOURCE_RANK = { demo: 0, demo_checkout: 1, stripe_test: 2 } as const satisfies Record<ProSource, number>;

/** SOURCE_RANK as a SQL expression over `column`, so the upserts apply the same order as `effective`. */
const rankSql = (column: string): string =>
  `(CASE ${column} ${Object.entries(SOURCE_RANK).map(([source, rank]) => `WHEN '${source}' THEN ${rank}`).join(' ')} END)`;

function effective(current: Entitlement | undefined, incoming: Entitlement): Entitlement {
  if (!current) return incoming;
  return incoming.source !== 'demo' && SOURCE_RANK[incoming.source] >= SOURCE_RANK[current.source] ? incoming : current;
}

type Persistence = { load(): Promise<State>; save(state: State): Promise<void> };
type Step<T> = { result: T; next?: State };

function createStore(persistence: Persistence): EntitlementStore {
  let state: State | null = null;
  let tail: Promise<unknown> = Promise.resolve();

  // Operations run one at a time, in arrival order. A new state is committed to memory only
  // after it is saved, so a failed write never leaves memory ahead of the disk. A failed load
  // is not cached: every operation fails until the file is fixed.
  function run<T>(op: (current: State) => Step<T>): Promise<T> {
    const task = tail.then(async () => {
      state ??= await persistence.load();
      const { result, next } = op(state);
      if (next) {
        await persistence.save(next);
        state = next;
      }
      return result;
    });
    tail = task.catch(() => undefined);
    return task;
  }

  const withEntitlement = (s: State, key: string, entitlement: Entitlement): State => ({
    ...s,
    entitlements: { ...s.entitlements, [key]: entitlement },
  });

  return {
    get(anonId) {
      const key = hashId(anonId);
      return run((s) => ({ result: s.entitlements[key] ?? null }));
    },

    grant(anonId, entitlement) {
      const key = hashId(anonId);
      return run((s) => {
        const current = s.entitlements[key];
        const next = effective(current, entitlement);
        return next === current ? { result: next } : { result: next, next: withEntitlement(s, key, next) };
      });
    },

    claimSession(sessionId, anonId, entitlement) {
      const key = hashId(anonId);
      return run((s): Step<ClaimResult> => {
        const owner = s.sessions[sessionId];
        if (owner !== undefined && owner !== key) return { result: { ok: false } };
        const current = s.entitlements[key];
        if (owner === key && current) return { result: { ok: true, entitlement: current } };
        const granted = effective(current, entitlement);
        const next = withEntitlement({ ...s, sessions: { ...s.sessions, [sessionId]: key } }, key, granted);
        return { result: { ok: true, entitlement: granted }, next };
      });
    },
  };
}

// ----- implementations ------------------------------------------------------------------------

/** In-memory store (tests, and a reference for the T4 implementation). */
export function createMemoryEntitlementStore(): EntitlementStore {
  return createStore({ load: async () => emptyState(), save: async () => {} });
}

export const ENTITLEMENTS_FILE = 'entitlements.json';

/**
 * The durable store: one JSON file in `dir`. A missing file is an empty store. A file that cannot
 * be read or does not parse fails closed (EntitlementStoreError) and is never overwritten, so a
 * bad deploy or a hand edit cannot silently wipe who paid. Writes go to a temp file that is
 * flushed and then renamed over the old one, so a crash leaves either the old or the new file.
 */
export function createFileEntitlementStore(dir: string): EntitlementStore {
  const file = path.join(dir, ENTITLEMENTS_FILE);

  return createStore({
    async load() {
      let raw: string;
      try {
        raw = await readFile(file, 'utf8');
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return emptyState();
        throw new EntitlementStoreError(`cannot read ${ENTITLEMENTS_FILE}`, { cause: err });
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        throw new EntitlementStoreError(`${ENTITLEMENTS_FILE} is not valid JSON; refusing to overwrite it`, { cause: err });
      }
      const state = StateSchema.safeParse(parsed);
      if (!state.success) {
        throw new EntitlementStoreError(`${ENTITLEMENTS_FILE} does not match the expected shape; refusing to overwrite it`);
      }
      return state.data;
    },

    async save(state) {
      const tmp = `${file}.${randomUUID()}.tmp`;
      try {
        await mkdir(dir, { recursive: true });
        const handle = await open(tmp, 'wx', 0o600);
        try {
          await handle.writeFile(JSON.stringify(state));
          await handle.sync();
        } finally {
          await handle.close();
        }
        await rename(tmp, file);
      } catch (err) {
        await rm(tmp, { force: true });
        throw new EntitlementStoreError(`cannot write ${ENTITLEMENTS_FILE}`, { cause: err });
      }
    },
  });
}

/**
 * Entitlements in the shared Postgres store (migration 002). Each operation is one transaction,
 * so the rules above hold across processes too. Any database failure becomes an
 * EntitlementStoreError, so the routes answer 503 (fail closed) exactly as with the file.
 *
 * `legacyDir`: where the JSON file of the stopgap lives. Before the first operation its grants and
 * claims are copied in (idempotent: nothing already in the database is overwritten, except that a
 * Stripe grant still replaces a demo one). A file that cannot be read or parsed fails closed. The
 * file itself is left untouched.
 */
export function createPostgresEntitlementStore(db: Db, opts: { legacyDir?: string } = {}): EntitlementStore {
  let imported: Promise<void> | null = null;
  const ready = (): Promise<void> => {
    if (!opts.legacyDir) return Promise.resolve();
    imported ??= importLegacyFile(db, opts.legacyDir).catch((err: unknown) => {
      imported = null;
      throw err;
    });
    return imported;
  };

  async function run<T>(op: () => Promise<T>): Promise<T> {
    try {
      await ready();
      return await op();
    } catch (err) {
      if (err instanceof StoreUnavailableError) throw new EntitlementStoreError(err.message, { cause: err });
      throw err;
    }
  }

  return {
    get(anonId) {
      return run(async () => {
        const { rows } = await db.query<EntitlementRow>(`SELECT ${ENTITLEMENT_COLUMNS} FROM pro_entitlements WHERE anon_key = $1`, [
          hashId(anonId),
        ]);
        return rows[0] ? fromRow(rows[0]) : null;
      });
    },

    grant(anonId, entitlement) {
      return run(() => db.transaction((tx) => upsertEntitlement(tx, hashId(anonId), entitlement)));
    },

    claimSession(sessionId, anonId, entitlement) {
      const key = hashId(anonId);
      return run(() =>
        db.transaction(async (tx): Promise<ClaimResult> => {
          // The primary key makes the claim atomic: a concurrent claim of the same session waits
          // here for this transaction, then finds the row and its owner.
          const inserted = await tx.query(
            'INSERT INTO pro_checkout_sessions (session_id, anon_key) VALUES ($1, $2) ON CONFLICT (session_id) DO NOTHING RETURNING anon_key',
            [sessionId, key],
          );
          if (inserted.rows.length === 0) {
            const { rows } = await tx.query<{ anon_key: string }>('SELECT anon_key FROM pro_checkout_sessions WHERE session_id = $1', [sessionId]);
            if (rows[0]?.anon_key !== key) return { ok: false };
            const current = await tx.query<EntitlementRow>(
              `SELECT ${ENTITLEMENT_COLUMNS} FROM pro_entitlements WHERE anon_key = $1 FOR UPDATE`,
              [key],
            );
            if (current.rows[0]) return { ok: true, entitlement: fromRow(current.rows[0]) };
          }
          return { ok: true, entitlement: await upsertEntitlement(tx, key, entitlement) };
        }),
      );
    },
  };
}

type EntitlementRow = { source: ProSource; plan: ProPlan | null; since: Date };
const ENTITLEMENT_COLUMNS = 'source, plan, since';

function fromRow(row: EntitlementRow): Entitlement {
  return { source: row.source, ...(row.plan && { plan: row.plan }), since: row.since.toISOString() };
}

/**
 * `effective()` as one statement: a new key gets the grant; an existing one is replaced only by a
 * grant that is not a promo one and ranks the same or higher. Returns the entitlement now in effect.
 */
async function upsertEntitlement(tx: Tx, key: string, entitlement: Entitlement): Promise<Entitlement> {
  await tx.query(
    `INSERT INTO pro_entitlements (anon_key, source, plan, since) VALUES ($1, $2, $3, $4::timestamptz)
     ON CONFLICT (anon_key) DO UPDATE
        SET source = EXCLUDED.source, plan = EXCLUDED.plan, since = EXCLUDED.since, updated_at = now()
      WHERE EXCLUDED.source <> 'demo' AND ${rankSql('EXCLUDED.source')} >= ${rankSql('pro_entitlements.source')}`,
    [key, entitlement.source, entitlement.plan ?? null, entitlement.since],
  );
  const { rows } = await tx.query<EntitlementRow>(`SELECT ${ENTITLEMENT_COLUMNS} FROM pro_entitlements WHERE anon_key = $1`, [key]);
  return fromRow(rows[0]!);
}

async function importLegacyFile(db: Db, dir: string): Promise<void> {
  const file = path.join(dir, ENTITLEMENTS_FILE);
  let raw: string;
  try {
    raw = await readFile(file, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw new EntitlementStoreError(`cannot read ${ENTITLEMENTS_FILE} to import it`, { cause: err });
  }
  let state: State;
  try {
    state = StateSchema.parse(JSON.parse(raw));
  } catch (err) {
    throw new EntitlementStoreError(`${ENTITLEMENTS_FILE} is not a valid entitlement file; not importing it`, { cause: err });
  }
  const entitlements = Object.entries(state.entitlements);
  const sessions = Object.entries(state.sessions);
  if (entitlements.length === 0 && sessions.length === 0) return;
  await db.transaction(async (tx) => {
    for (const [key, e] of entitlements) {
      await tx.query(
        `INSERT INTO pro_entitlements (anon_key, source, plan, since) VALUES ($1, $2, $3, $4::timestamptz)
         ON CONFLICT (anon_key) DO UPDATE
            SET source = EXCLUDED.source, plan = EXCLUDED.plan, since = EXCLUDED.since, updated_at = now()
          WHERE ${rankSql('EXCLUDED.source')} > ${rankSql('pro_entitlements.source')}`,
        [key, e.source, e.plan ?? null, e.since],
      );
    }
    for (const [sessionId, key] of sessions) {
      await tx.query(
        'INSERT INTO pro_checkout_sessions (session_id, anon_key) VALUES ($1, $2) ON CONFLICT (session_id) DO NOTHING',
        [sessionId, key],
      );
    }
  });
  console.info(`[pro] imported ${entitlements.length} entitlement(s) and ${sessions.length} claim(s) from ${ENTITLEMENTS_FILE} into the store`);
}

// Kept on globalThis, not in a module variable: if the bundler ever gives two routes their own
// copy of this module, two caches over one file would overwrite each other's grants.
const SINGLETON = Symbol.for('lifeguessr.pro.entitlementStore');
type Singleton = { dir: string; db: Db | null; store: EntitlementStore };

/**
 * The process-wide store: Postgres when STORE_URL is set (importing PRO_DATA_DIR's file once),
 * otherwise the file in PRO_DATA_DIR.
 */
export function getEntitlementStore(): EntitlementStore {
  const dir = proDataDir();
  const db = storeConfig().kind === 'postgres' ? getStore().db : null;
  const slot = globalThis as typeof globalThis & { [SINGLETON]?: Singleton };
  const current = slot[SINGLETON];
  if (current?.dir !== dir || current.db !== db) {
    const store = db ? createPostgresEntitlementStore(db, { legacyDir: dir }) : createFileEntitlementStore(dir);
    slot[SINGLETON] = { dir, db, store };
  }
  return slot[SINGLETON]!.store;
}
