// Server-only: brings the Postgres schema up to date. Runs once per process, before the first
// query (./postgres.ts), and is safe to run from several processes at once:
//
//   BEGIN
//   pg_advisory_xact_lock(MIGRATION_LOCK_KEY)  -- one migrator at a time; the others wait, then see it done
//   CREATE TABLE IF NOT EXISTS schema_migrations
//   for each migration not yet recorded, ascending: run its SQL, record version + checksum
//   COMMIT                                      -- all pending migrations, or none
//
// An applied migration whose SQL changed since (checksum mismatch) stops the store instead of
// running on a schema that differs from the code. Versions recorded in the database that this
// build does not know come from a newer build (e.g. after a rollback); they are logged and
// tolerated, because migrations are additive (./migrations/index.ts).
import { createHash } from 'node:crypto';
import { StoreUnavailableError } from './errors';
import type { Migration } from './migrations';

/** Arbitrary constant: the advisory lock id that serializes migrators (fits a Postgres bigint). */
export const MIGRATION_LOCK_KEY = 7_406_211_532;

/** What migrate() needs from a connection (a pg PoolClient fits; so does a fake in tests). */
export type Queryable = {
  query<R = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: R[] }>;
};

export type MigrationReport = { applied: number[]; unknown: number[] };

export const checksumOf = (sql: string): string => createHash('sha256').update(sql).digest('hex');

/** Throws when the list is not unique, positive, ascending versions with snake_case names. */
export function checkMigrationList(migrations: readonly Migration[]): void {
  let previous = 0;
  for (const m of migrations) {
    if (!Number.isInteger(m.version) || m.version <= previous) {
      throw new Error(`migrations must have unique, ascending, positive integer versions (at ${m.version} ${m.name})`);
    }
    if (!/^[a-z][a-z0-9_]*$/.test(m.name)) throw new Error(`migration ${m.version}: name must be snake_case`);
    if (!m.sql.trim()) throw new Error(`migration ${m.version}: empty SQL`);
    previous = m.version;
  }
}

type AppliedRow = { version: number; name: string; checksum: string };

export async function migrate(client: Queryable, migrations: readonly Migration[]): Promise<MigrationReport> {
  checkMigrationList(migrations);
  await client.query('BEGIN');
  try {
    await client.query('SELECT pg_advisory_xact_lock($1)', [MIGRATION_LOCK_KEY]);
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version    integer PRIMARY KEY,
      name       text NOT NULL,
      checksum   text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const { rows } = await client.query<AppliedRow>('SELECT version, name, checksum FROM schema_migrations');
    const done = new Map(rows.map((r) => [Number(r.version), r]));

    const applied: number[] = [];
    for (const m of migrations) {
      const checksum = checksumOf(m.sql);
      const before = done.get(m.version);
      if (before) {
        if (before.checksum !== checksum) {
          throw new StoreUnavailableError(
            'migration_failed',
            `migration ${m.version} (${m.name}) was changed after it was applied; add a new migration instead`,
          );
        }
        continue;
      }
      try {
        await client.query(m.sql);
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        throw new StoreUnavailableError('migration_failed', `migration ${m.version} (${m.name}) failed: ${detail}`, { cause: err });
      }
      await client.query('INSERT INTO schema_migrations (version, name, checksum) VALUES ($1, $2, $3)', [
        m.version,
        m.name,
        checksum,
      ]);
      applied.push(m.version);
    }
    await client.query('COMMIT');

    const known = new Set(migrations.map((m) => m.version));
    const unknown = [...done.keys()].filter((v) => !known.has(v)).sort((a, b) => a - b);
    return { applied, unknown };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  }
}
