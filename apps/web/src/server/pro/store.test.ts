import { chmod, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setStoreForTests, type Store } from '@/server/store';
import { TEST_STORE_URL, testPostgresStore } from '@/server/store/testUtils';
import {
  createFileEntitlementStore,
  createMemoryEntitlementStore,
  createPostgresEntitlementStore,
  ENTITLEMENTS_FILE,
  EntitlementStoreError,
  getEntitlementStore,
  proStatusOf,
  type Entitlement,
  type EntitlementStore,
} from './store';
import { ANON, OTHER_ANON, SESSION_ID, tempDir } from './testUtils';

const demo = (since = '2026-11-14T10:00:00.000Z'): Entitlement => ({ source: 'demo', since });
const stripe = (plan: 'yearly' | 'monthly' = 'yearly', since = '2026-11-14T11:00:00.000Z'): Entitlement => ({
  source: 'stripe_test',
  plan,
  since,
});

let dir: string;
let cleanup: () => Promise<void>;
/** Postgres stores opened by a test, closed (and their schemas dropped) after it. */
const pgCleanups: (() => Promise<void>)[] = [];
beforeEach(async () => {
  ({ dir, cleanup } = await tempDir());
});
afterEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  setStoreForTests(null);
  for (const c of pgCleanups.splice(0)) await c();
  await cleanup();
});

/** A Postgres store in its own schema (needs TEST_STORE_URL). */
function pgStore(): Store {
  const { store, cleanup: drop } = testPostgresStore();
  pgCleanups.push(drop);
  return store;
}

const implementations: [string, () => EntitlementStore][] = [
  ['memory', () => createMemoryEntitlementStore()],
  ['file', () => createFileEntitlementStore(dir)],
];
if (TEST_STORE_URL) implementations.push(['postgres', () => createPostgresEntitlementStore(pgStore().db!)]);

describe.each(implementations)('%s entitlement store', (_name, make: () => EntitlementStore) => {
  it('knows nobody at first', async () => {
    expect(await make().get(ANON)).toBeNull();
  });

  it('grants Pro by promo code, keeping the first `since` when the code is entered again', async () => {
    const store = make();
    expect(await store.grant(ANON, demo('2026-11-14T10:00:00.000Z'))).toEqual(demo('2026-11-14T10:00:00.000Z'));
    expect(await store.grant(ANON, demo('2026-11-14T12:00:00.000Z'))).toEqual(demo('2026-11-14T10:00:00.000Z'));
    expect(await store.get(ANON)).toEqual(demo('2026-11-14T10:00:00.000Z'));
    expect(await store.get(OTHER_ANON)).toBeNull();
  });

  it('upgrades a demo grant to Stripe, and never downgrades Stripe to demo', async () => {
    const store = make();
    await store.grant(ANON, demo());
    expect(await store.claimSession(SESSION_ID, ANON, stripe())).toEqual({ ok: true, entitlement: stripe() });
    expect(await store.grant(ANON, demo('2026-11-15T00:00:00.000Z'))).toEqual(stripe());
    expect(await store.get(ANON)).toEqual(stripe());
  });

  it('lets one anonId claim a session; a replay changes nothing, another anonId is refused', async () => {
    const store = make();
    expect(await store.claimSession(SESSION_ID, ANON, stripe('monthly'))).toEqual({ ok: true, entitlement: stripe('monthly') });
    const replay = stripe('monthly', '2026-11-20T00:00:00.000Z');
    expect(await store.claimSession(SESSION_ID, ANON, replay)).toEqual({ ok: true, entitlement: stripe('monthly') });
    expect(await store.claimSession(SESSION_ID, OTHER_ANON, stripe())).toEqual({ ok: false });
    expect(await store.get(OTHER_ANON)).toBeNull();
  });

  it('lets a second purchase replace the plan of the first', async () => {
    const store = make();
    await store.claimSession('cs_test_first0000', ANON, stripe('monthly'));
    const yearly = stripe('yearly', '2026-12-01T00:00:00.000Z');
    expect(await store.claimSession('cs_test_second000', ANON, yearly)).toEqual({ ok: true, entitlement: yearly });
  });

  it('gives a contested session to exactly one of two concurrent claimants', async () => {
    const store = make();
    const results = await Promise.all([
      store.claimSession(SESSION_ID, ANON, stripe()),
      store.claimSession(SESSION_ID, OTHER_ANON, stripe()),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });

  it('gives a session contested by many to exactly one, and grants nobody else', async () => {
    const store = make();
    const ids = Array.from({ length: 12 }, (_, i) => `anon-${String(i).padStart(8, '0')}`);
    const results = await Promise.all(ids.map((id) => store.claimSession(SESSION_ID, id, stripe())));
    const winners = ids.filter((_, i) => results[i]!.ok);
    expect(winners).toHaveLength(1);
    for (const id of ids) expect(await store.get(id)).toEqual(id === winners[0] ? stripe() : null);
  });

  it('never lets concurrent promo grants downgrade a concurrent purchase', async () => {
    const store = make();
    await Promise.all([
      store.grant(ANON, demo()),
      store.claimSession(SESSION_ID, ANON, stripe()),
      store.grant(ANON, demo('2026-11-14T12:00:00.000Z')),
    ]);
    expect(await store.get(ANON)).toEqual(stripe());
  });
});

describe('file entitlement store', () => {
  const file = () => path.join(dir, ENTITLEMENTS_FILE);

  it('persists grants and claims across store instances', async () => {
    const first = createFileEntitlementStore(dir);
    await first.grant(OTHER_ANON, demo());
    await first.claimSession(SESSION_ID, ANON, stripe());

    const second = createFileEntitlementStore(dir);
    expect(await second.get(ANON)).toEqual(stripe());
    expect(await second.get(OTHER_ANON)).toEqual(demo());
    expect(await second.claimSession(SESSION_ID, OTHER_ANON, stripe())).toEqual({ ok: false });
  });

  it('creates a missing data directory on the first write', async () => {
    const nested = path.join(dir, 'a', 'b');
    await createFileEntitlementStore(nested).grant(ANON, demo());
    expect(await createFileEntitlementStore(nested).get(ANON)).toEqual(demo());
  });

  it('loses no write when many grants race', async () => {
    const store = createFileEntitlementStore(dir);
    const ids = Array.from({ length: 40 }, (_, i) => `anon-${String(i).padStart(8, '0')}`);
    await Promise.all(ids.map((id) => store.grant(id, demo())));

    const reloaded = createFileEntitlementStore(dir);
    for (const id of ids) expect(await reloaded.get(id)).toEqual(demo());
    expect(await readdir(dir)).toEqual([ENTITLEMENTS_FILE]); // no temp files left behind
  });

  it('stores hashed anonymous ids, never the raw ones', async () => {
    await createFileEntitlementStore(dir).claimSession(SESSION_ID, ANON, stripe());
    const raw = await readFile(file(), 'utf8');
    expect(raw).not.toContain(ANON);
    expect(raw).toContain(SESSION_ID);
  });

  it.each([
    ['not JSON', '{"version": 1, "entitlements": {'],
    ['the wrong shape', JSON.stringify({ version: 1, entitlements: { x: { source: 'gift', since: 'now' } }, sessions: {} })],
    ['an unknown version', JSON.stringify({ version: 2, entitlements: {}, sessions: {} })],
  ])('fails closed on a file that is %s, and never overwrites it', async (_name, content) => {
    await writeFile(file(), content);
    const store = createFileEntitlementStore(dir);
    await expect(store.get(ANON)).rejects.toBeInstanceOf(EntitlementStoreError);
    await expect(store.grant(ANON, demo())).rejects.toBeInstanceOf(EntitlementStoreError);
    await expect(store.claimSession(SESSION_ID, ANON, stripe())).rejects.toBeInstanceOf(EntitlementStoreError);
    expect(await readFile(file(), 'utf8')).toBe(content);
  });

  it('recovers once the file is fixed', async () => {
    await writeFile(file(), 'garbage');
    const store = createFileEntitlementStore(dir);
    await expect(store.get(ANON)).rejects.toBeInstanceOf(EntitlementStoreError);
    await writeFile(file(), JSON.stringify({ version: 1, entitlements: {}, sessions: {} }));
    expect(await store.grant(ANON, demo())).toEqual(demo());
  });

  it('does not keep a grant in memory that it failed to write', async () => {
    const store = createFileEntitlementStore(dir);
    expect(await store.get(ANON)).toBeNull(); // loaded while the directory is writable
    await chmod(dir, 0o500);
    try {
      await expect(store.grant(ANON, demo())).rejects.toBeInstanceOf(EntitlementStoreError);
      expect(await store.get(ANON)).toBeNull();
    } finally {
      await chmod(dir, 0o700);
    }
    expect(await readdir(dir)).toEqual([]);
  });
});

describe.skipIf(!TEST_STORE_URL)('postgres entitlement store', () => {
  const fileWith = (state: unknown) => writeFile(path.join(dir, ENTITLEMENTS_FILE), JSON.stringify(state));

  it('imports the JSON file of the stopgap once, before the first operation, and leaves the file alone', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const legacy = createFileEntitlementStore(dir);
    await legacy.grant(OTHER_ANON, demo());
    await legacy.claimSession(SESSION_ID, ANON, stripe('monthly'));
    const before = await readFile(path.join(dir, ENTITLEMENTS_FILE), 'utf8');

    const db = pgStore().db!;
    const store = createPostgresEntitlementStore(db, { legacyDir: dir });
    expect(await store.get(ANON)).toEqual(stripe('monthly'));
    expect(await store.get(OTHER_ANON)).toEqual(demo());
    expect(await store.claimSession(SESSION_ID, OTHER_ANON, stripe())).toEqual({ ok: false }); // the claim came along
    expect(await readFile(path.join(dir, ENTITLEMENTS_FILE), 'utf8')).toBe(before);

    // A restart imports again: nothing changes, and nothing newer is overwritten.
    await store.grant(OTHER_ANON, demo('2026-12-01T00:00:00.000Z')); // a demo grant keeps `since`
    await store.claimSession('cs_test_second000', ANON, stripe('yearly', '2026-12-02T00:00:00.000Z'));
    const restarted = createPostgresEntitlementStore(db, { legacyDir: dir });
    expect(await restarted.get(ANON)).toEqual(stripe('yearly', '2026-12-02T00:00:00.000Z'));
    expect(await restarted.get(OTHER_ANON)).toEqual(demo());
  });

  it('lets an imported Stripe grant replace a demo grant made in the database, never the reverse', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const db = pgStore().db!;
    const fresh = createPostgresEntitlementStore(db);
    await fresh.grant(ANON, demo('2026-11-20T00:00:00.000Z'));
    await fresh.claimSession('cs_test_dbonly0000', OTHER_ANON, stripe('monthly'));

    const legacy = createFileEntitlementStore(dir);
    await legacy.claimSession(SESSION_ID, ANON, stripe());
    await legacy.grant(OTHER_ANON, demo());
    const store = createPostgresEntitlementStore(db, { legacyDir: dir });
    expect(await store.get(ANON)).toEqual(stripe());
    expect(await store.get(OTHER_ANON)).toEqual(stripe('monthly'));
  });

  it('fails closed on a broken file (503 upstream) and recovers once it is fixed', async () => {
    await writeFile(path.join(dir, ENTITLEMENTS_FILE), 'not json');
    const store = createPostgresEntitlementStore(pgStore().db!, { legacyDir: dir });
    await expect(store.get(ANON)).rejects.toBeInstanceOf(EntitlementStoreError);
    await fileWith({ version: 1, entitlements: {}, sessions: {} });
    expect(await store.get(ANON)).toBeNull();
  });

  it('turns an unreachable database into EntitlementStoreError, so the routes answer 503', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { createPostgresStore } = await import('@/server/store');
    const down = createPostgresStore('postgres://nobody:wrong@127.0.0.1:1/none', { connectTimeoutMs: 1_000 });
    pgCleanups.push(() => down.close());
    const store = createPostgresEntitlementStore(down.db!);
    await expect(store.get(ANON)).rejects.toBeInstanceOf(EntitlementStoreError);
    await expect(store.grant(ANON, demo())).rejects.toBeInstanceOf(EntitlementStoreError);
  });

  it('stores hashed anonymous ids, never the raw ones', async () => {
    const db = pgStore().db!;
    await createPostgresEntitlementStore(db).claimSession(SESSION_ID, ANON, stripe());
    const { rows } = await db.query<{ dump: string }>(
      'SELECT (SELECT string_agg(e::text, \'\') FROM pro_entitlements e) || (SELECT string_agg(s::text, \'\') FROM pro_checkout_sessions s) AS dump',
    );
    expect(rows[0]!.dump).not.toContain(ANON);
    expect(rows[0]!.dump).toContain(SESSION_ID);
  });

  it('is what getEntitlementStore returns when STORE_URL is set', async () => {
    const store = pgStore();
    setStoreForTests(store);
    vi.stubEnv('STORE_URL', TEST_STORE_URL!);
    vi.stubEnv('PRO_DATA_DIR', dir);
    await getEntitlementStore().grant(ANON, demo());
    const { rows } = await store.db!.query<{ n: number }>('SELECT count(*)::int AS n FROM pro_entitlements');
    expect(rows[0]!.n).toBe(1);
    expect(getEntitlementStore()).toBe(getEntitlementStore());
  });
});

describe('getEntitlementStore', () => {
  it('returns one store per PRO_DATA_DIR', async () => {
    vi.stubEnv('PRO_DATA_DIR', dir);
    const store = getEntitlementStore();
    expect(getEntitlementStore()).toBe(store);
    await store.grant(ANON, demo());
    expect(await readFile(path.join(dir, ENTITLEMENTS_FILE), 'utf8')).toContain('"demo"');

    const other = path.join(dir, 'other');
    await mkdir(other);
    vi.stubEnv('PRO_DATA_DIR', other);
    expect(getEntitlementStore()).not.toBe(store);
    expect(await getEntitlementStore().get(ANON)).toBeNull();
  });
});

describe('proStatusOf', () => {
  it('maps an entitlement to the shared ProStatus', () => {
    expect(proStatusOf(null)).toEqual({ pro: false });
    expect(proStatusOf(stripe())).toEqual({ pro: true, ...stripe() });
  });
});
