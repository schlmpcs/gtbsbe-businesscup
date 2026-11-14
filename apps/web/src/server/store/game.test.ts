import { getArea } from '@lifeguessr/data/areas';
import { dailyCards } from '@lifeguessr/data/cards';
import { costOfLife, scoreGuess } from '@lifeguessr/engine';
import type { ClueId, LifeCard } from '@lifeguessr/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { dayNumber } from '@/lib/dates';
import { anonKey } from './anonKey';
import {
  compareTotals, decodeReveal, encodeReveal, handleOf, newResultId, rankTotals, RESULT_ID,
  type GameStore, type GuessScorer, type PlayerTotal,
} from './game';
import { createMemoryStore, type Store } from './index';
import { adminQuery, describePostgres, testPostgresStore } from './testUtils';

const DATE = '2026-11-14';
const NEXT_DAY = '2026-11-15';
const [CARD, CARD_2, CARD_3] = dailyCards(dayNumber(DATE)) as [LifeCard, LifeCard, LifeCard];

const anon = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const A = anon(1);
const B = anon(2);

/** The real scoring, as the guess route does it. */
const scorer = (card: LifeCard, guess: number): GuessScorer => (clues) => {
  const cost = costOfLife(card, getArea(card.zip));
  return { cost, result: scoreGuess(guess, cost, clues.length), card };
};
const play = (anonId: string, card: LifeCard = CARD, date = DATE) => ({ date, anonId, cardId: card.id });

describe('game rules (pure)', () => {
  it('result ids are 128 random bits in hex', () => {
    const ids = new Set(Array.from({ length: 50 }, newResultId));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(RESULT_ID);
  });

  it('a stored reveal reads back through the contract, Infinity included', () => {
    const cost = costOfLife(CARD, getArea(CARD.zip));
    const reveal = { resultId: 'r', cost, result: scoreGuess(0, cost, 0), card: CARD, cluesOpened: [] as ClueId[] };
    const stored = encodeReveal(reveal);
    expect((stored.result as { logError: unknown }).logError).toBeNull();
    expect(decodeReveal(stored, 'r')).toEqual(reveal);
    expect(() => decodeReveal({ ...stored, cost: 'no' }, 'r')).toThrow(/does not match/);
  });

  it('handles are stable per player, made up, and never contain the key', () => {
    const key = anonKey(A);
    expect(handleOf(key)).toBe(handleOf(key));
    expect(handleOf(key)).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+ \d{1,2}$/);
    expect(handleOf(key)).not.toContain(key.slice(0, 6));
    const handles = new Set(Array.from({ length: 40 }, (_, i) => handleOf(anonKey(anon(i)))));
    expect(handles.size).toBeGreaterThan(30);
  });

  it('ranks by points, ties share a rank and list whoever finished first, and the caller is found outside the top', () => {
    const t = (n: number, points: number, finishedAt: string): PlayerTotal => ({
      anonKey: anonKey(anon(n)), points, played: 5, inRange: 1, finishedAt,
    });
    const totals = [
      t(1, 3_000, '2026-11-14T15:00:00.000Z'),
      t(2, 4_200, '2026-11-14T16:00:00.000Z'),
      t(3, 3_000, '2026-11-14T14:00:00.000Z'), // ties with 1, finished earlier
      t(4, 900, '2026-11-14T13:00:00.000Z'),
    ];
    const board = rankTotals(DATE, totals, { limit: 3, anonId: anon(4) });
    expect(board.players).toBe(4);
    expect(board.entries.map((e) => [e.rank, e.points])).toEqual([[1, 4_200], [2, 3_000], [2, 3_000]]);
    expect(board.entries[1]!.handle).toBe(handleOf(anonKey(anon(3))));
    expect(board.entries.every((e) => !e.you)).toBe(true);
    expect(board.you).toMatchObject({ rank: 4, points: 900, you: true });
    expect(rankTotals(DATE, totals, { limit: 10 }).you).toBeNull();
    expect([...totals].sort(compareTotals).map((x) => x.points)).toEqual([4_200, 3_000, 3_000, 900]);
  });
});

/** The GameStore contract, run against the memory store and (with TEST_STORE_URL) Postgres. */
function contract(name: string, open: () => { store: Store; cleanup: () => Promise<void> }) {
  describe(`GameStore contract (${name})`, () => {
    let store: Store;
    let cleanup: () => Promise<void>;
    let game: GameStore;
    beforeAll(() => {
      ({ store, cleanup } = open());
      game = store.game;
    });
    afterAll(async () => cleanup());

    it('records each clue once, in opening order, per player, card and day', async () => {
      expect(await game.openClue(play(A), 'kitchen')).toEqual({ recorded: true });
      expect(await game.openClue(play(A), 'garage')).toEqual({ recorded: true });
      expect(await game.openClue(play(A), 'kitchen')).toEqual({ recorded: false });
      await game.openClue(play(B), 'mailbox');
      await game.openClue(play(A, CARD_2), 'entry');
      await game.openClue(play(A, CARD, NEXT_DAY), 'entry');

      const day = await game.playerDay(DATE, A);
      expect(day.clues).toEqual({ [CARD.id]: ['kitchen', 'garage'], [CARD_2.id]: ['entry'] });
      expect(day.results).toEqual([]);
      expect((await game.playerDay(DATE, B)).clues).toEqual({ [CARD.id]: ['mailbox'] });
    });

    it('scores a guess from the clues it recorded and stores it under a random resultId', async () => {
      const { result, replayed } = await game.submitGuess(play(A), 3_000, scorer(CARD, 3_000));
      expect(replayed).toBe(false);
      expect(result.resultId).toMatch(RESULT_ID);
      expect(result.resultId).not.toContain(anonKey(A).slice(0, 8));
      expect(result).toMatchObject({ date: DATE, cardId: CARD.id, guess: 3_000 });
      const cost = costOfLife(CARD, getArea(CARD.zip));
      expect(result.reveal).toEqual({
        resultId: result.resultId, cost, result: scoreGuess(3_000, cost, 2), card: CARD, cluesOpened: ['kitchen', 'garage'],
      });
      expect(await game.findResult(result.resultId)).toEqual(result);
      expect(await game.findResult(newResultId())).toBeNull();
    });

    it('allows one guess per card per player per day: a repeat answers the stored result', async () => {
      const first = (await game.playerDay(DATE, A)).results[0]!;
      const again = await game.submitGuess(play(A), 9_999, scorer(CARD, 9_999));
      expect(again).toEqual({ result: first, replayed: true });
      // Another player, card or day is its own guess.
      expect((await game.submitGuess(play(B), 9_999, scorer(CARD, 9_999))).replayed).toBe(false);
      expect((await game.submitGuess(play(A, CARD_2), 2_000, scorer(CARD_2, 2_000))).replayed).toBe(false);
      expect((await game.submitGuess(play(A, CARD, NEXT_DAY), 2_000, scorer(CARD, 2_000))).replayed).toBe(false);
      expect((await game.playerDay(DATE, A)).results.map((r) => r.cardId)).toEqual([CARD.id, CARD_2.id]);
    });

    it('does not record a clue opened after the guess, so the stored score cannot change', async () => {
      expect(await game.openClue(play(A), 'mailbox')).toEqual({ recorded: false });
      expect((await game.playerDay(DATE, A)).clues[CARD.id]).toEqual(['kitchen', 'garage']);
      const replay = await game.submitGuess(play(A), 3_000, scorer(CARD, 3_000));
      expect(replay.result.reveal.cluesOpened).toEqual(['kitchen', 'garage']);
    });

    it('scores concurrent guesses for one card exactly once', async () => {
      const C = anon(30);
      await game.openClue(play(C, CARD_3), 'garage');
      const outcomes = await Promise.all(
        Array.from({ length: 12 }, (_, i) => game.submitGuess(play(C, CARD_3), 1_000 + i * 500, scorer(CARD_3, 1_000 + i * 500))),
      );
      expect(new Set(outcomes.map((o) => o.result.resultId)).size).toBe(1);
      expect(outcomes.filter((o) => !o.replayed)).toHaveLength(1);
      expect(outcomes.every((o) => o.result.reveal.cluesOpened.length === 1)).toBe(true);
      expect((await game.playerDay(DATE, C)).results).toHaveLength(1);
    });

    it('counts a clue and a guess sent together consistently (the clue is counted or not recorded)', async () => {
      const D = anon(40);
      const [clue, guess] = await Promise.all([
        game.openClue(play(D, CARD_3), 'kitchen'),
        game.submitGuess(play(D, CARD_3), 3_000, scorer(CARD_3, 3_000)),
      ]);
      expect(guess.result.reveal.cluesOpened).toEqual(clue.recorded ? ['kitchen'] : []);
      expect((await game.playerDay(DATE, D)).clues[CARD_3.id] ?? []).toEqual(guess.result.reveal.cluesOpened);
    });

    it('builds the day’s leaderboard from stored results only', async () => {
      const board = await game.leaderboard(DATE, { limit: 50, anonId: A });
      // Players of DATE: A (2 cards), B, C, D.
      expect(board.players).toBe(4);
      const points = board.entries.map((e) => e.points);
      expect(points).toEqual([...points].sort((x, y) => y - x));
      const own = (await game.playerDay(DATE, A)).results;
      expect(board.you).toMatchObject({
        handle: handleOf(anonKey(A)),
        points: own.reduce((s, r) => s + r.reveal.result.points, 0),
        played: 2,
        inRange: own.filter((r) => r.reveal.result.inRange).length,
        you: true,
      });
      expect(board.entries.filter((e) => e.you)).toHaveLength(1);
      expect(JSON.stringify(board)).not.toContain(anonKey(A));
      expect(JSON.stringify(board)).not.toContain(A);

      const top1 = await game.leaderboard(DATE, { limit: 1, anonId: anon(99) });
      expect(top1.entries).toHaveLength(1);
      expect(top1.you).toBeNull();
      expect((await game.leaderboard('2026-11-01', { limit: 50 })).players).toBe(0);
    });

    it('ranks ties together and lists whoever finished first first', async () => {
      const day = '2026-12-01';
      const card = dailyCards(dayNumber(day))[0]!;
      // Three players, the same guess and no clues: equal points, finished in this order.
      for (const n of [52, 50, 51]) await game.submitGuess(play(anon(n), card, day), 2_500, scorer(card, 2_500));
      const board = await game.leaderboard(day, { limit: 10, anonId: anon(51) });
      expect(board.entries.map((e) => e.rank)).toEqual([1, 1, 1]);
      expect(board.entries.map((e) => e.handle)).toEqual([52, 50, 51].map((n) => handleOf(anonKey(anon(n)))));
      expect(board.you).toMatchObject({ rank: 1, you: true });
    });
  });
}

contract('memory', () => ({ store: createMemoryStore(), cleanup: async () => {} }));

describePostgres('GameStore on Postgres', () => {
  contract('postgres', () => testPostgresStore());

  it('enforces one guess per card per player per day in the schema itself (migration 3)', async () => {
    const { store, schema, cleanup } = testPostgresStore();
    try {
      await store.check();
      const row = (resultId: string) => adminQuery(
        `INSERT INTO ${schema}.game_results
           (result_id, play_date, anon_key, card_id, guess, clues_opened, points, in_range, cost, result, card)
         VALUES ($1, '2026-11-14', $2, 'lc-001', 3000, '{}', 500, false, '{}', '{}', '{}')`,
        [resultId, anonKey(A)],
      );
      await row(newResultId());
      await expect(row(newResultId())).rejects.toMatchObject({ code: '23505', constraint: 'game_results_one_guess' });
      await expect(adminQuery(
        `INSERT INTO ${schema}.game_clues (play_date, anon_key, card_id, clue) VALUES ('2026-11-14', $1, 'lc-001', 'attic')`,
        [anonKey(A)],
      )).rejects.toMatchObject({ code: '23514' });
    } finally {
      await cleanup();
    }
  });
});
