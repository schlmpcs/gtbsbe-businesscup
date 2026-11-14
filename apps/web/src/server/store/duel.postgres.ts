import type { DuelLetter, DuelRound } from '@lifeguessr/types';
import { anonKey } from './anonKey';
import { newResultId, RESULT_ID } from './game';
import type { DuelCounts, DuelScored, DuelStore, StoredPick } from './duel';
import type { Db, Tx } from './postgres';

type Row = { round: DuelRound; choice: DuelLetter; hints: number; scored: DuelScored; result_id: string };
const pick = (r: Row): StoredPick => ({ round: r.round, choice: r.choice, hints: r.hints, scored: r.scored });
const lock = (tx: Tx, date: string, key: string) => tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`lifeguessr.duel:${date}:${key}`]);
export function createPostgresDuelStore(db: Db): DuelStore {
  return {
    async openHint({ date, anonId }, round) {
      const key = anonKey(anonId);
      return db.transaction(async tx => {
        await lock(tx, date, key);
        const { rowCount } = await tx.query(`INSERT INTO duel_hints (play_date, anon_key, round) SELECT $1, $2, $3 WHERE NOT EXISTS (SELECT 1 FROM duel_picks WHERE play_date=$1 AND anon_key=$2 AND round=$3) ON CONFLICT DO NOTHING`, [date, key, round]);
        return { recorded: !!rowCount };
      });
    },
    async submitPick({ date, anonId }, round, choice, score) {
      const key = anonKey(anonId);
      return db.transaction(async tx => {
        await lock(tx, date, key);
        const prior = await tx.query<Row>('SELECT round, choice, hints, scored, result_id FROM duel_picks WHERE play_date=$1 AND anon_key=$2 AND round=$3', [date, key, round]);
        if (prior.rows[0]) { const row = prior.rows[0]; return { resultId: row.result_id, scored: row.scored, choice: row.choice, replayed: true }; }
        const hint = await tx.query('SELECT 1 FROM duel_hints WHERE play_date=$1 AND anon_key=$2 AND round=$3', [date, key, round]);
        const hints = hint.rows.length;
        const scored = score(hints);
        const day = await tx.query<{ result_id: string }>('INSERT INTO duel_days (result_id, play_date, anon_key) VALUES ($1,$2,$3) ON CONFLICT ON CONSTRAINT duel_days_one_per_day DO UPDATE SET anon_key=EXCLUDED.anon_key RETURNING result_id', [newResultId(), date, key]);
        const resultId = day.rows[0]!.result_id;
        const inserted = await tx.query<Row>('INSERT INTO duel_picks (play_date, anon_key, round, result_id, choice, correct, points, hints, scored) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) RETURNING round, choice, hints, scored, result_id', [date, key, round, resultId, choice, scored.correct, scored.points, hints, JSON.stringify(scored)]);
        return { resultId, scored: inserted.rows[0]!.scored, choice, replayed: false };
      });
    },
    async playerDuelDay({ date, anonId }) {
      const key = anonKey(anonId);
      return db.transaction(async tx => {
        await lock(tx, date, key);
        const days = await tx.query<{ result_id: string }>('SELECT result_id FROM duel_days WHERE play_date=$1 AND anon_key=$2', [date, key]);
        const picks = await tx.query<Row>('SELECT round, choice, hints, scored, result_id FROM duel_picks WHERE play_date=$1 AND anon_key=$2 ORDER BY round', [date, key]);
        const hints = await tx.query<{ round: DuelRound }>('SELECT round FROM duel_hints WHERE play_date=$1 AND anon_key=$2 ORDER BY round', [date, key]);
        return { resultId: days.rows[0]?.result_id ?? null, picks: picks.rows.map(pick), hintedRounds: hints.rows.map(r => r.round) };
      });
    },
    async findDuelDay(resultId) {
      if (!RESULT_ID.test(resultId)) return null;
      const days = await db.query<{ date: string }>('SELECT play_date::text AS date FROM duel_days WHERE result_id=$1', [resultId]);
      if (!days.rows[0]) return null;
      const picks = await db.query<Row>('SELECT round, choice, hints, scored, result_id FROM duel_picks WHERE result_id=$1 ORDER BY round', [resultId]);
      return { date: days.rows[0].date, picks: picks.rows.map(pick) };
    },
    async crowds(date, rounds) {
      const result = new Map<DuelRound, DuelCounts>(rounds.map(round => [round, { A: 0, B: 0 }]));
      if (rounds.length === 0) return result;
      // duel_picks_crowd (play_date, round, choice) answers this from the index alone. Not inside
      // a transaction or the player's advisory lock: it is a read of everyone's committed picks, and
      // a pick landing a moment later simply shows up in the next reply.
      const { rows } = await db.query<{ round: DuelRound; choice: DuelLetter; n: number }>(
        'SELECT round, choice, COUNT(*)::int AS n FROM duel_picks WHERE play_date=$1 AND round = ANY($2::smallint[]) GROUP BY round, choice',
        [date, [...rounds]],
      );
      for (const row of rows) result.get(row.round)![row.choice] = row.n;
      return result;
    },
  };
}
