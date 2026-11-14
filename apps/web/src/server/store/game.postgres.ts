// Server-only: the daily game in Postgres (tables game_clues and game_results, migration 003).
//
// Opening a clue and submitting a guess for one (day, player, card) each run in a transaction
// that first takes a transaction-scoped advisory lock on that triple, so they apply one after the
// other: a clue that commits before the guess is counted, one that arrives after is not recorded.
// The UNIQUE constraint game_results_one_guess stays as the backstop for the one-guess rule.
import type { ClueId } from '@lifeguessr/types';
import { anonKey } from './anonKey';
import {
  buildReveal, decodeReveal, encodeReveal, newResultId, toEntry,
  type GameStore, type Leaderboard, type PlayKey, type StoredResult,
} from './game';
import type { Db, Tx } from './postgres';

type ResultRow = {
  result_id: string;
  play_date: string;
  card_id: string;
  guess: number;
  clues_opened: string[];
  cost: unknown;
  result: unknown;
  card: unknown;
  created_at: Date;
};

// play_date as text: node-postgres would turn a `date` into a JS Date at local midnight.
const RESULT_COLUMNS = 'result_id, play_date::text AS play_date, card_id, guess, clues_opened, cost, result, card, created_at';

function fromRow(row: ResultRow): StoredResult {
  return {
    resultId: row.result_id,
    date: row.play_date,
    cardId: row.card_id,
    guess: Number(row.guess),
    reveal: decodeReveal(
      { resultId: row.result_id, cost: row.cost, result: row.result, card: row.card, cluesOpened: row.clues_opened },
      row.result_id,
    ),
    createdAt: row.created_at.toISOString(),
  };
}

/** Serializes clue and guess writes for one (day, player, card) until the transaction ends. */
async function lockPlay(tx: Tx, date: string, key: string, cardId: string): Promise<void> {
  await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`lifeguessr.game:${date}:${key}:${cardId}`]);
}

async function storedResult(tx: Tx, date: string, key: string, cardId: string): Promise<StoredResult | null> {
  const { rows } = await tx.query<ResultRow>(
    `SELECT ${RESULT_COLUMNS} FROM game_results WHERE play_date = $1 AND anon_key = $2 AND card_id = $3`,
    [date, key, cardId],
  );
  return rows[0] ? fromRow(rows[0]) : null;
}

type TotalRow = { anon_key: string; points: number; played: number; in_range: number; rank: number; pos: number; players: number };

export function createPostgresGameStore(db: Db): GameStore {
  return {
    async openClue({ date, anonId, cardId }: PlayKey, clue: ClueId) {
      const key = anonKey(anonId);
      return db.transaction(async (tx) => {
        await lockPlay(tx, date, key, cardId);
        const { rowCount } = await tx.query(
          `INSERT INTO game_clues (play_date, anon_key, card_id, clue)
           SELECT $1, $2, $3, $4
            WHERE NOT EXISTS (SELECT 1 FROM game_results WHERE play_date = $1 AND anon_key = $2 AND card_id = $3)
           ON CONFLICT DO NOTHING`,
          [date, key, cardId, clue],
        );
        return { recorded: (rowCount ?? 0) > 0 };
      });
    },

    async submitGuess({ date, anonId, cardId }, guess, score) {
      const key = anonKey(anonId);
      return db.transaction(async (tx) => {
        await lockPlay(tx, date, key, cardId);
        const existing = await storedResult(tx, date, key, cardId);
        if (existing) return { result: existing, replayed: true };

        const { rows: clueRows } = await tx.query<{ clue: ClueId }>(
          `SELECT clue FROM game_clues WHERE play_date = $1 AND anon_key = $2 AND card_id = $3 ORDER BY opened_at, clue`,
          [date, key, cardId],
        );
        const counted = clueRows.map((r) => r.clue);
        const resultId = newResultId();
        const reveal = encodeReveal(buildReveal(resultId, counted, score(counted)));
        const result = reveal.result as { points: number; inRange: boolean };
        const { rows } = await tx.query<ResultRow>(
          `INSERT INTO game_results
             (result_id, play_date, anon_key, card_id, guess, clues_opened, points, in_range, cost, result, card)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb)
           ON CONFLICT ON CONSTRAINT game_results_one_guess DO NOTHING
           RETURNING ${RESULT_COLUMNS}`,
          // jsonb goes in as JSON text (node-postgres would make a JS array a Postgres array).
          [resultId, date, key, cardId, guess, counted, result.points, result.inRange,
            JSON.stringify(reveal.cost), JSON.stringify(reveal.result), JSON.stringify(reveal.card)],
        );
        if (rows[0]) return { result: fromRow(rows[0]), replayed: false };
        // Only reachable if the lock were bypassed: another insert won; answer its result.
        const winner = await storedResult(tx, date, key, cardId);
        if (!winner) throw new Error('game_results: insert conflicted but no stored result was found');
        return { result: winner, replayed: true };
      });
    },

    async playerDay(date, anonId) {
      const key = anonKey(anonId);
      const [clueRows, resultRows] = await Promise.all([
        db.query<{ card_id: string; clue: ClueId }>(
          'SELECT card_id, clue FROM game_clues WHERE play_date = $1 AND anon_key = $2 ORDER BY opened_at, clue',
          [date, key],
        ),
        db.query<ResultRow>(
          `SELECT ${RESULT_COLUMNS} FROM game_results WHERE play_date = $1 AND anon_key = $2 ORDER BY created_at, result_id`,
          [date, key],
        ),
      ]);
      const clues: Record<string, ClueId[]> = {};
      for (const { card_id, clue } of clueRows.rows) (clues[card_id] ??= []).push(clue);
      return { clues, results: resultRows.rows.map(fromRow) };
    },

    async findResult(resultId) {
      const { rows } = await db.query<ResultRow>(`SELECT ${RESULT_COLUMNS} FROM game_results WHERE result_id = $1`, [resultId]);
      return rows[0] ? fromRow(rows[0]) : null;
    },

    async leaderboard(date, { limit, anonId }): Promise<Leaderboard> {
      const own = anonId ? anonKey(anonId) : null;
      // Same order and ranks as rankTotals in ./game.ts: points desc, then the earliest last guess,
      // then the key; RANK() gives tied points the same rank.
      const { rows } = await db.query<TotalRow>(
        `WITH totals AS (
           SELECT anon_key,
                  SUM(points)::int                          AS points,
                  COUNT(*)::int                             AS played,
                  (COUNT(*) FILTER (WHERE in_range))::int   AS in_range,
                  MAX(created_at)                           AS finished_at
             FROM game_results
            WHERE play_date = $1
            GROUP BY anon_key
         ), ranked AS (
           SELECT anon_key, points, played, in_range,
                  (RANK() OVER (ORDER BY points DESC))::int                                AS rank,
                  (ROW_NUMBER() OVER (ORDER BY points DESC, finished_at, anon_key COLLATE "C"))::int AS pos,
                  (COUNT(*) OVER ())::int                                                  AS players
             FROM totals
         )
         SELECT anon_key, points, played, in_range, rank, pos, players
           FROM ranked
          WHERE pos <= $2 OR anon_key = $3
          ORDER BY pos`,
        [date, limit, own],
      );
      const entry = (r: TotalRow) =>
        toEntry({ anonKey: r.anon_key, points: r.points, played: r.played, inRange: r.in_range }, r.rank, r.anon_key === own);
      const ownRow = rows.find((r) => r.anon_key === own);
      return {
        date,
        players: rows[0]?.players ?? 0,
        entries: rows.filter((r) => r.pos <= limit).map(entry),
        you: ownRow ? entry(ownRow) : null,
      };
    },
  };
}
