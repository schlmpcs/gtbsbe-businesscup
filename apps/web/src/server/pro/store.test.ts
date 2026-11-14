import { chmod, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createFileEntitlementStore,
  createMemoryEntitlementStore,
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
beforeEach(async () => {
  ({ dir, cleanup } = await tempDir());
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await cleanup();
});

describe.each([
  ['memory', () => createMemoryEntitlementStore()],
  ['file', () => createFileEntitlementStore(dir)],
])('%s entitlement store', (_name, make: () => EntitlementStore) => {
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
