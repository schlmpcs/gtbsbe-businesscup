// The schema of the Postgres store, as an ordered list of migrations (../migrate.ts runs them).
//
// Adding a table (e.g. T5 game guesses, T8 events):
//   1. Create `NNN_<name>.ts` here exporting a Migration with the next free version, and add it
//      to MIGRATIONS below. Taken: 3 = T5 game (#18). Reserved: 4 = T8 events (#21); take 5+ otherwise.
//   2. Rules, because production keeps every migration it ever ran:
//      - Never edit or renumber a migration once it is on main. The runner compares checksums and
//        refuses to start on an edited one. Fix forward with a new migration.
//      - Additive only (new tables, new nullable or defaulted columns, new indexes). A deploy that
//        fails its health check rolls back to the previous image, which then runs against the
//        newer schema, so the previous build must still work with it.
//      - Everything must run inside a transaction: no CREATE INDEX CONCURRENTLY, no VACUUM.
//      - Key rows by `anon_key` (sha256 of the anonymous id, ../anonKey.ts), never the raw id.
//   3. Add the table to the memory store too, so tests and `pnpm dev` behave the same.
// Versions are applied by set, not by "highest so far", so two PRs merging in either order work.
import { m001Sessions } from './001_sessions';
import { m002ProEntitlements } from './002_pro_entitlements';
import { m003Game } from './003_game';
import type { Migration } from './types';

export type { Migration } from './types';

export const MIGRATIONS: readonly Migration[] = [m001Sessions, m002ProEntitlements, m003Game];
