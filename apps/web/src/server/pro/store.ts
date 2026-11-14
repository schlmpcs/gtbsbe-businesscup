// Server-only: who is Pro, keyed by the anonymous id.
//
// A stopgap behind an interface: entitlements move to the shared self-hosted store once task T4
// (STORE_URL) lands, and only `getEntitlementStore` changes then. Until then they live in one
// JSON file (PRO_DATA_DIR/entitlements.json) owned by a single server process.
//
// Rules every implementation keeps:
// - A Stripe grant overwrites a demo grant, never the reverse: entering the promo code after
//   paying must not downgrade anyone. Re-entering the code keeps the original `since`.
// - A Checkout Session unlocks Pro for exactly one anonymous id. Claiming it and granting Pro is
//   one atomic step, so a crash in between cannot leave a session claimed but not granted.
// - Anonymous ids are stored as SHA-256 hashes: the raw id also keys the user's saved profile,
//   so the file must not hold it.
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { ProPlanSchema, ProSourceSchema, type ProPlan, type ProSource, type ProStatus } from '@lifeguessr/types';
import { proDataDir } from './config';

export type Entitlement = { source: ProSource; plan?: ProPlan; since: string };

export type ClaimResult = { ok: true; entitlement: Entitlement } | { ok: false };

export interface EntitlementStore {
  get(anonId: string): Promise<Entitlement | null>;
  /** Grants Pro without a session (the promo code); returns the entitlement now in effect. */
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
const hashId = (anonId: string) => createHash('sha256').update(anonId).digest('hex');

function effective(current: Entitlement | undefined, incoming: Entitlement): Entitlement {
  if (current && incoming.source === 'demo') return current;
  return incoming;
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

// Kept on globalThis, not in a module variable: if the bundler ever gives two routes their own
// copy of this module, two caches over one file would overwrite each other's grants.
const SINGLETON = Symbol.for('lifeguessr.pro.entitlementStore');
type Singleton = { dir: string; store: EntitlementStore };

/** The process-wide store for PRO_DATA_DIR. */
export function getEntitlementStore(): EntitlementStore {
  const dir = proDataDir();
  const slot = globalThis as typeof globalThis & { [SINGLETON]?: Singleton };
  if (slot[SINGLETON]?.dir !== dir) slot[SINGLETON] = { dir, store: createFileEntitlementStore(dir) };
  return slot[SINGLETON].store;
}
