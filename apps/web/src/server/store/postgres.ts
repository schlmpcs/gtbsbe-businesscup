// Server-only: the Postgres connection behind the store. One pool per process (./index.ts keeps
// it), migrations before the first query (./migrate.ts), parameterized queries only, and every
// "database is down" error turned into StoreUnavailableError so routes can answer 503.
import pg, { type PoolClient, type QueryResultRow } from 'pg';
import { asStoreError, StoreUnavailableError } from './errors';
import { migrate } from './migrate';
import { MIGRATIONS, type Migration } from './migrations';

/** A connection inside a transaction. Values always go in `values` ($1, $2, …), never into `text`. */
export type Tx = {
  query<R extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<{ rows: R[]; rowCount: number | null }>;
};

export type Db = {
  /** One statement on any pooled connection (autocommit). */
  query: Tx['query'];
  /**
   * Runs `fn` between BEGIN and COMMIT on one connection; any throw rolls back. A deadlock or
   * serialization failure retries `fn` from the start (up to 3 tries), so `fn` must do nothing
   * but queries on `tx` and pure computation.
   */
  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
  /** Connects, migrates if needed and runs `SELECT 1`. Throws StoreUnavailableError. */
  check(): Promise<void>;
  close(): Promise<void>;
};

export type DbOptions = {
  migrations?: readonly Migration[];
  /** Tests only: run everything in this schema (created if missing) instead of `public`. */
  schema?: string;
  /** Pool size (default 10). The app is one container; Postgres allows 100 connections. */
  max?: number;
  /** How long to wait for a connection before giving up (default 5 s). */
  connectTimeoutMs?: number;
};

const RETRYABLE = new Set(['40001', '40P01']); // serialization_failure, deadlock_detected
const MAX_TRIES = 3;

export function createDb(url: string, opts: DbOptions = {}): Db {
  const migrations = opts.migrations ?? MIGRATIONS;
  const schema = opts.schema;
  if (schema !== undefined && !/^[a-z_][a-z0-9_]{0,62}$/.test(schema)) throw new Error(`invalid schema name ${schema}`);

  const pool = new pg.Pool({
    connectionString: url,
    max: opts.max ?? 10,
    connectionTimeoutMillis: opts.connectTimeoutMs ?? 5_000,
    idleTimeoutMillis: 30_000,
    // A stuck query fails instead of holding a connection (and a row lock) forever.
    statement_timeout: 10_000,
    query_timeout: 15_000,
    application_name: 'lifeguessr',
    ...(schema && { options: `-c search_path=${schema}` }),
  });
  // An idle connection that dies (Postgres restarted) emits here; without a listener it would
  // crash the process. The pool drops it and the next query opens a new one.
  pool.on('error', (err) => console.error(`[store] idle connection lost: ${err.message}`));

  let ready: Promise<void> | null = null;

  async function setUp(): Promise<void> {
    const client = await pool.connect();
    try {
      if (schema) {
        // Validated name above. IF NOT EXISTS still races between two connections; the loser's
        // duplicate error is harmless.
        await client.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`).catch((err: { code?: string }) => {
          if (err.code !== '42P06' && err.code !== '23505') throw err;
        });
      }
      const report = await migrate(client, migrations);
      if (report.applied.length > 0) console.info(`[store] applied migrations ${report.applied.join(', ')}`);
      if (report.unknown.length > 0) {
        console.warn(`[store] the database has migrations this build does not know (${report.unknown.join(', ')}); a newer build ran here`);
      }
    } finally {
      client.release();
    }
  }

  /** Migrate once per process. A failure is not cached: the next call tries again. */
  function ensureReady(): Promise<void> {
    ready ??= setUp().catch((err: unknown) => {
      ready = null;
      const wrapped = asStoreError(err);
      if (wrapped instanceof StoreUnavailableError) console.error(`[store] not ready: ${wrapped.message}`);
      throw wrapped;
    });
    return ready;
  }

  async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    await ensureReady();
    let client: PoolClient;
    try {
      client = await pool.connect();
    } catch (err) {
      throw asStoreError(err);
    }
    let broken: Error | undefined;
    try {
      return await fn(client);
    } catch (err) {
      // A connection that failed mid-transaction may be unusable: destroy it rather than reuse.
      if (err instanceof Error && asStoreError(err) !== err) broken = err;
      throw asStoreError(err);
    } finally {
      client.release(broken);
    }
  }

  return {
    async query(text, values) {
      return withClient((client) => client.query(text, values));
    },

    async transaction(fn) {
      return withClient(async (client) => {
        for (let attempt = 1; ; attempt++) {
          await client.query('BEGIN');
          try {
            const result = await fn(client);
            await client.query('COMMIT');
            return result;
          } catch (err) {
            await client.query('ROLLBACK').catch(() => undefined);
            const code = (err as { code?: unknown }).code;
            if (attempt < MAX_TRIES && typeof code === 'string' && RETRYABLE.has(code)) continue;
            throw err;
          }
        }
      });
    },

    async check() {
      await withClient((client) => client.query('SELECT 1'));
    },

    async close() {
      await pool.end();
    },
  };
}
