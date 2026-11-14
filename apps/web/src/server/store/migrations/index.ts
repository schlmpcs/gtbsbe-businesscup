// The schema of the Postgres store, as an ordered list of migrations (../migrate.ts runs them).
//
// Adding a table (e.g. T5 game guesses, T8 events):
//   1. Create `NNN_<name>.ts` here exporting a Migration with the next free version, and add it
//      to MIGRATIONS below. Taken: 3 = T5 game (#18), 4 = T8 funnel events (#21), 5 = Pro demo
//      checkout source; take 6+.
//   2. Rules, because production keeps every migration it ever ran:
//      - Never edit or renumber a migration once it is on main. The runner compares checksums and
//        refuses to start on an edited one. Fix forward with a new migration.
//      - Additive only (new tables, new nullable or defaulted columns, new indexes). A deploy that
//        fails its health check rolls back to the previous image, which then runs against the
//        newer schema, so the previous build must still work with it.
//      - Everything must run inside a transaction: no CREATE INDEX CONCURRENTLY, no VACUUM.
//      - Key rows by `anon_key` (sha256 of the anonymous id, ../anonKey.ts), never the raw id.
//   3. Add the table to the memory store too, so tests and `pnpm dev` behave the same.
// Versions are applied by set, not by "highest so far", so two PRs merging in either order work:
// a database that ran a higher version first still runs a lower one when it lands, once
// (migrate.test.ts covers it). Keep this list in ascending order. Running them out of order is
// safe because a migration never touches a table that a migration still open in another PR creates.
import { m001Sessions } from './001_sessions';
import { m002ProEntitlements } from './002_pro_entitlements';
import { m003Game } from './003_game';
import { m004FunnelEvents } from './004_funnel_events';
import { m005ProDemoCheckout } from './005_pro_demo_checkout';
import { m006Goals } from './006_goals';
import { m007Duel } from './007_duel';
import { m008Avatars } from './008_avatars';
import { m009TogetherPlans } from './009_together_plans';
import type { Migration } from './types';

export type { Migration } from './types';

export const MIGRATIONS: readonly Migration[] = [m001Sessions, m002ProEntitlements, m003Game, m004FunnelEvents, m005ProDemoCheckout, m006Goals, m007Duel, m008Avatars, m009TogetherPlans];
