// Test helpers for the store. Postgres tests run only when TEST_STORE_URL points at a database
// they may write to (CI sets it; see .github/workflows/ci.yml), and skip otherwise. Each store
// gets its own schema, dropped afterwards, so test files can run in parallel on one database.
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { describe } from 'vitest';
import { createPostgresStore, type Store } from './index';
import type { DbOptions } from './postgres';

export const TEST_STORE_URL = process.env.TEST_STORE_URL?.trim() || null;

/** `describe` when TEST_STORE_URL is set, `describe.skip` otherwise. */
export const describePostgres = TEST_STORE_URL ? describe : describe.skip;

export const newSchemaName = (): string => `test_${randomUUID().replaceAll('-', '')}`;

/** Runs `sql` on the test database outside any store (schema setup and teardown). */
export async function adminQuery(sql: string, values: unknown[] = []): Promise<pg.QueryResult> {
  if (!TEST_STORE_URL) throw new Error('TEST_STORE_URL is not set');
  const client = new pg.Client({ connectionString: TEST_STORE_URL });
  await client.connect();
  try {
    return await client.query(sql, values);
  } finally {
    await client.end();
  }
}

export async function dropSchema(schema: string): Promise<void> {
  if (!/^test_[0-9a-f]{32}$/.test(schema)) throw new Error(`refusing to drop ${schema}`);
  await adminQuery(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
}

/** A Postgres store in a fresh schema; `cleanup` closes it and drops the schema. */
export function testPostgresStore(opts: DbOptions = {}): { store: Store; schema: string; cleanup: () => Promise<void> } {
  if (!TEST_STORE_URL) throw new Error('TEST_STORE_URL is not set');
  const schema = opts.schema ?? newSchemaName();
  const store = createPostgresStore(TEST_STORE_URL, { ...opts, schema });
  return {
    store,
    schema,
    cleanup: async () => {
      await store.close();
      await dropSchema(schema);
    },
  };
}
