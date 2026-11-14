// Server-only: the daily game in process memory (tests, and `pnpm dev` without STORE_URL). Same
// rules as Postgres (./game.ts). Each operation runs without an await between its read and its
// write, so operations for one player and card cannot interleave; values are stored as JSON and
// read back through the contract, like the database.
import type { ClueId } from '@lifeguessr/types';
import { anonKey } from './anonKey';
import {
  buildReveal, decodeReveal, encodeReveal, newResultId, rankTotals,
  type GameStore, type PlayerTotal, type PlayKey, type StoredResult,
} from './game';

type ResultRow = {
  resultId: string;
  date: string;
  anonKey: string;
  cardId: string;
  guess: number;
  reveal: Record<string, unknown>;
  createdAt: string;
};

const playId = (date: string, key: string, cardId: string) => `${date}|${key}|${cardId}`;

/** Strictly increasing ISO timestamps, so two results made in one millisecond still order. */
function clock(): () => string {
  let last = 0;
  return () => {
    last = Math.max(Date.now(), last + 1);
    return new Date(last).toISOString();
  };
}

export function createMemoryGameStore(): GameStore {
  const clues = new Map<string, ClueId[]>(); // playId → clues in opening order
  const results = new Map<string, ResultRow>(); // playId → result (the one-guess rule)
  const byResultId = new Map<string, ResultRow>();
  const now = clock();

  const fromRow = (row: ResultRow): StoredResult => ({
    resultId: row.resultId,
    date: row.date,
    cardId: row.cardId,
    guess: row.guess,
    reveal: decodeReveal(structuredClone(row.reveal), row.resultId),
    createdAt: row.createdAt,
  });

  return {
    async openClue({ date, anonId, cardId }, clue) {
      const id = playId(date, anonKey(anonId), cardId);
      const opened = clues.get(id) ?? [];
      if (results.has(id) || opened.includes(clue)) return { recorded: false };
      clues.set(id, [...opened, clue]);
      return { recorded: true };
    },

    async submitGuess({ date, anonId, cardId }: PlayKey, guess, score) {
      const key = anonKey(anonId);
      const id = playId(date, key, cardId);
      const existing = results.get(id);
      if (existing) return { result: fromRow(existing), replayed: true };

      const counted = [...(clues.get(id) ?? [])];
      const resultId = newResultId();
      const reveal = buildReveal(resultId, counted, score(counted));
      const row: ResultRow = { resultId, date, anonKey: key, cardId, guess, reveal: encodeReveal(reveal), createdAt: now() };
      results.set(id, row);
      byResultId.set(resultId, row);
      return { result: fromRow(row), replayed: false };
    },

    async playerDay(date, anonId) {
      const prefix = `${date}|${anonKey(anonId)}|`;
      const day: Record<string, ClueId[]> = {};
      for (const [id, opened] of clues) if (id.startsWith(prefix)) day[id.slice(prefix.length)] = [...opened];
      const own = [...results.entries()].filter(([id]) => id.startsWith(prefix)).map(([, row]) => fromRow(row));
      own.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
      return { clues: day, results: own };
    },

    async findResult(resultId) {
      const row = byResultId.get(resultId);
      return row ? fromRow(row) : null;
    },

    async leaderboard(date, opts) {
      const totals = new Map<string, PlayerTotal>();
      for (const row of results.values()) {
        if (row.date !== date) continue;
        const reveal = decodeReveal(row.reveal, row.resultId);
        const t = totals.get(row.anonKey) ?? { anonKey: row.anonKey, points: 0, played: 0, inRange: 0, finishedAt: row.createdAt };
        t.points += reveal.result.points;
        t.played += 1;
        if (reveal.result.inRange) t.inRange += 1;
        if (row.createdAt > t.finishedAt) t.finishedAt = row.createdAt;
        totals.set(row.anonKey, t);
      }
      return rankTotals(date, [...totals.values()], opts);
    },
  };
}
