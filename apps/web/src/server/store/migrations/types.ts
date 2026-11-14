/**
 * One schema change. Applied once, in ascending `version` order, inside the migration
 * transaction (../migrate.ts), and recorded in `schema_migrations` with a checksum of `sql`.
 */
export type Migration = {
  /** Unique positive integer; the file is named `NNN_<name>.ts` after it. */
  version: number;
  /** snake_case, for the log and `schema_migrations.name`. */
  name: string;
  /** Plain SQL; several statements are fine. Must be able to run inside a transaction. */
  sql: string;
};
