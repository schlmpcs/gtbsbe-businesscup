// Server-only: sessions in Postgres (table `sessions`, migration 001).
import { anonKey } from './anonKey';
import type { Db } from './postgres';
import {
  applySessionUpdate, decodeStored, emptySession, type SaveResult, type SessionState, type SessionStore,
} from './sessions';

type Row = { goal: unknown; profile: unknown; wishlist: unknown; revision: number; updated_at: Date | null };

const COLUMNS = 'profile, wishlist, goal, revision, updated_at';

function fromRow(row: Row | undefined): SessionState {
  if (!row || row.revision === 0) return emptySession();
  return { ...decodeStored(row.profile, row.wishlist, row.goal), revision: row.revision, updatedAt: row.updated_at?.toISOString() ?? null };
}

/** Thrown inside the transaction to roll it back (and drop the row it may have created). */
class Rejected extends Error {
  constructor(readonly result: SaveResult) {
    super('session save rejected');
  }
}

export function createPostgresSessionStore(db: Db): SessionStore {
  async function load(anonId: string): Promise<SessionState> {
    const { rows } = await db.query<Row>(`SELECT ${COLUMNS} FROM sessions WHERE anon_key = $1`, [anonKey(anonId)]);
    return fromRow(rows[0]);
  }

  return {
    load,

    async save(anonId, update, opts) {
      if (update.profile === undefined && update.wishlist === undefined && update.goal === undefined) return { ok: true, session: await load(anonId) };
      const key = anonKey(anonId);
      try {
        return await db.transaction(async (tx) => {
          // Make sure the row exists, then lock it: a concurrent save for the same id waits here
          // until this one commits, and then reads what this one wrote.
          await tx.query('INSERT INTO sessions (anon_key) VALUES ($1) ON CONFLICT (anon_key) DO NOTHING', [key]);
          const { rows } = await tx.query<Row>(`SELECT ${COLUMNS} FROM sessions WHERE anon_key = $1 FOR UPDATE`, [key]);
          const result = applySessionUpdate(fromRow(rows[0]), update, opts, new Date().toISOString());
          if (!result.ok) throw new Rejected(result);
          const { profile, wishlist, goal, revision, updatedAt } = result.session;
          await tx.query(
            `UPDATE sessions
                SET profile = $2::jsonb, wishlist = $3::jsonb, revision = $4, updated_at = $5::timestamptz, goal = $6::jsonb
              WHERE anon_key = $1`,
            // jsonb parameters are passed as JSON text: node-postgres would turn a JS array into a
            // Postgres array literal, not JSON.
            [key, profile === undefined ? null : JSON.stringify(profile), JSON.stringify(wishlist), revision, updatedAt, goal == null ? null : JSON.stringify(goal)],
          );
          return result;
        });
      } catch (err) {
        if (err instanceof Rejected) return err.result;
        throw err;
      }
    },
  };
}
