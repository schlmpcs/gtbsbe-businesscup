import { afterEach, describe, expect, it, vi } from 'vitest';
import { StoreUnavailableError } from './errors';
import { checkMigrationList, checksumOf } from './migrate';
import { createPostgresStore } from './index';
import { MIGRATIONS, type Migration } from './migrations';
import { adminQuery, describePostgres, newSchemaName, testPostgresStore } from './testUtils';

const m = (version: number, name: string, sql: string): Migration => ({ version, name, sql });

describe('the migration list', () => {
  it('is valid: unique, ascending versions, snake_case names, SQL in each', () => {
    expect(() => checkMigrationList(MIGRATIONS)).not.toThrow();
    expect(MIGRATIONS.map((x) => x.version)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it.each([
    ['a duplicate version', [m(1, 'a', 'SELECT 1'), m(1, 'b', 'SELECT 1')]],
    ['a version out of order', [m(2, 'a', 'SELECT 1'), m(1, 'b', 'SELECT 1')]],
    ['version 0', [m(0, 'a', 'SELECT 1')]],
    ['a fractional version', [m(1.5, 'a', 'SELECT 1')]],
    ['a name that is not snake_case', [m(1, 'Add-Table', 'SELECT 1')]],
    ['empty SQL', [m(1, 'a', '  ')]],
  ])('rejects %s', (_name, list) => {
    expect(() => checkMigrationList(list)).toThrow();
  });
});

describePostgres('migrate (Postgres)', () => {
  const cleanups: (() => Promise<void>)[] = [];
  afterEach(async () => {
    vi.restoreAllMocks();
    for (const c of cleanups.splice(0)) await c();
  });
  const open = (migrations: readonly Migration[], schema?: string) => {
    const h = testPostgresStore({ migrations, schema });
    cleanups.push(h.cleanup);
    return h;
  };
  const tables = async (schema: string) =>
    (await adminQuery('SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY 1', [schema])).rows.map(
      (r: { table_name: string }) => r.table_name,
    );
  const applied = async (schema: string) =>
    (await adminQuery(`SELECT version, name, checksum FROM ${schema}.schema_migrations ORDER BY version`)).rows;

  it('creates the schema of the app once, records each migration, and is idempotent', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { store, schema } = open(MIGRATIONS);
    await store.check();
    await store.check();
    expect(await tables(schema)).toEqual([
      'avatars', 'funnel_events', 'game_clues', 'game_results', 'pro_checkout_sessions', 'pro_entitlements', 'schema_migrations', 'sessions',
    ]);
    expect(await applied(schema)).toEqual(MIGRATIONS.map((x) => ({ version: x.version, name: x.name, checksum: checksumOf(x.sql) })));

    // A second process on the same database finds nothing to do.
    const second = testPostgresStore({ migrations: MIGRATIONS, schema });
    await second.store.check();
    await second.store.close();
    expect(await applied(schema)).toHaveLength(MIGRATIONS.length);
  });

  it('lets many processes start at once: the advisory lock runs each migration exactly once', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const schema = newSchemaName();
    const racers = Array.from({ length: 6 }, () => testPostgresStore({ migrations: MIGRATIONS, schema }));
    try {
      await Promise.all(racers.map((r) => r.store.check()));
      expect(await applied(schema)).toHaveLength(MIGRATIONS.length);
    } finally {
      for (const r of racers.slice(1)) await r.store.close();
      await racers[0]!.cleanup();
    }
  });

  it('applies a later migration on top, in order, even when merged out of order', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const schema = newSchemaName();
    const first = testPostgresStore({ migrations: [m(1, 'one', 'CREATE TABLE one (id int)'), m(3, 'three', 'CREATE TABLE three (id int)')], schema });
    await first.store.check();
    await first.store.close();

    const later = open([m(1, 'one', 'CREATE TABLE one (id int)'), m(2, 'two', 'CREATE TABLE two (id int)'), m(3, 'three', 'CREATE TABLE three (id int)')], schema);
    await later.store.check();
    expect((await applied(schema)).map((r: { version: number }) => r.version)).toEqual([1, 2, 3]);
  });

  it('runs a lower version that lands after a higher one (3 after 4), once', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const schema = newSchemaName();
    // A database migrated by a build where 4 had merged and 3 was still open: 1, 2, 4.
    const without3 = MIGRATIONS.filter((x) => x.version !== 3);
    const first = testPostgresStore({ migrations: without3, schema });
    await first.store.check();
    await first.store.close();

    // Then 3 lands. It runs; 1, 2 and 4 are not run again (they would fail: CREATE TABLE without
    // IF NOT EXISTS) and their checksums still match.
    const later = open(MIGRATIONS, schema);
    await later.store.check();
    expect((await applied(schema)).map((r: { version: number }) => r.version)).toEqual(MIGRATIONS.map((x) => x.version));
    expect(await tables(schema)).toEqual(expect.arrayContaining(['funnel_events', 'game_clues', 'game_results']));

    // And a third process finds nothing left to do.
    const again = testPostgresStore({ migrations: MIGRATIONS, schema });
    await again.store.check();
    await again.store.close();
    expect(await applied(schema)).toHaveLength(MIGRATIONS.length);
  });

  it('rolls back every pending migration when one fails, and fails the store until fixed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const schema = newSchemaName();
    const broken = testPostgresStore({ migrations: [m(1, 'ok', 'CREATE TABLE ok (id int)'), m(2, 'bad', 'CREATE TABLE ok (id int)')], schema });
    try {
      const err = await broken.store.check().catch((e: unknown) => e);
      expect(err).toBeInstanceOf(StoreUnavailableError);
      expect((err as StoreUnavailableError).reason).toBe('migration_failed');
      expect((err as Error).message).toContain('migration 2 (bad) failed');
      expect(await tables(schema)).toEqual([]); // table `ok` and the bookkeeping were rolled back too
      // Still failing on the next try (not cached as a success, not half-applied).
      await expect(broken.store.sessions.load('0f8e2b4c-1d2e-4f5a-9b8c-7d6e5f4a3b2c')).rejects.toBeInstanceOf(StoreUnavailableError);
    } finally {
      await broken.cleanup();
    }
  });

  it('refuses to run when an applied migration was edited afterwards', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const schema = newSchemaName();
    const original = testPostgresStore({ migrations: [m(1, 'one', 'CREATE TABLE one (id int)')], schema });
    await original.store.check();
    await original.store.close();

    const edited = open([m(1, 'one', 'CREATE TABLE one (id bigint)')], schema);
    await expect(edited.store.check()).rejects.toThrow(/migration 1 \(one\) was changed after it was applied/);
  });

  it('tolerates migrations from a newer build (a rollback) and says so', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const schema = newSchemaName();
    const newer = testPostgresStore({ migrations: [m(1, 'one', 'CREATE TABLE one (id int)'), m(2, 'two', 'CREATE TABLE two (id int)')], schema });
    await newer.store.check();
    await newer.store.close();

    const older = open([m(1, 'one', 'CREATE TABLE one (id int)')], schema);
    await expect(older.store.check()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('does not know (2)'));
  });

});

describe('an unreachable database', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reports an unreachable database as StoreUnavailableError, without hanging', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = createPostgresStore('postgres://nobody:wrong@127.0.0.1:1/none', { connectTimeoutMs: 1_000 });
    try {
      const err = await store.check().catch((e: unknown) => e);
      expect(err).toBeInstanceOf(StoreUnavailableError);
      expect((err as StoreUnavailableError).reason).toBe('unreachable');
    } finally {
      await store.close();
    }
  });
});
