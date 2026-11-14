import { getArea } from '@lifeguessr/data/areas';
import { dailyCards } from '@lifeguessr/data/cards';
import { costOfLife, scoreGuess } from '@lifeguessr/engine';
import { describe, expect, it, vi } from 'vitest';
import { GuessReplySchema, MAX_GUESS } from '@/lib/api/gameSchemas';
import { dayNumber } from '@/lib/dates';
import { GAME_RATE_LIMITS } from '@/server/game/http';
import { ANON, errorOf, OTHER_ANON, postReq, setupGameTestEnv, TODAY } from '@/server/game/testUtils';
import { StoreUnavailableError, type Store } from '@/server/store';
import { RESULT_ID } from '@/server/store/game';
import { POST as postClue } from '../clue/route';
import { POST } from './route';

const getStore = setupGameTestEnv();
const [CARD, CARD_2] = dailyCards(dayNumber(TODAY));
const COST = costOfLife(CARD!, getArea(CARD!.zip));

const guess = (body: Record<string, unknown>, opts?: Parameters<typeof postReq>[2]) =>
  POST(postReq('/api/daily/guess', { anonId: ANON, cardId: CARD!.id, ...body }, opts));
const openClue = (clue: string, anonId = ANON, cardId = CARD!.id) =>
  postClue(postReq('/api/daily/clue', { anonId, cardId, clue }, { anonId }));
const reply = async (res: Response) => {
  expect(res.status).toBe(200);
  return GuessReplySchema.parse(await res.json());
};

describe('POST /api/daily/guess', () => {
  it('scores on the server with costOfLife + scoreGuess and the clues it recorded', async () => {
    await openClue('garage');
    await openClue('kidsRoom');
    await openClue('garage');
    const r = await reply(await guess({ guess: 3_400 }));
    expect(r.resultId).toMatch(RESULT_ID);
    expect(r.cost).toEqual(COST);
    expect(r.result).toEqual(scoreGuess(3_400, COST, 2));
    expect(r.cluesOpened).toEqual(['garage', 'kidsRoom']);
    expect(r.card).toEqual(CARD);
    expect(r).toMatchObject({ guess: 3_400, replayed: false });
    expect((await getStore().game.findResult(r.resultId))?.reveal.result).toEqual(r.result);
  });

  it('never takes a clue count or a score from the client', async () => {
    await openClue('garage');
    // Extra fields are refused outright, so nothing the client claims can reach the scorer.
    for (const extra of [{ cluesOpened: 0 }, { cluesOpened: [] }, { points: 1000 }, { result: { points: 1000 } }]) {
      const res = await guess({ guess: 3_400, ...extra });
      expect(res.status).toBe(400);
    }
    const r = await reply(await guess({ guess: 3_400 }));
    expect(r.result.multiplier).toBeCloseTo(0.9); // the recorded clue counts
    expect(r.cluesOpened).toEqual(['garage']);
  });

  it('counts only this player’s clues, for this card', async () => {
    await openClue('garage', OTHER_ANON);
    await openClue('kitchen', ANON, CARD_2!.id);
    const r = await reply(await guess({ guess: 3_400 }));
    expect(r.cluesOpened).toEqual([]);
    expect(r.result).toEqual(scoreGuess(3_400, COST, 0));
  });

  it('allows one guess per card per player per day: a repeat answers the stored result, never a second score', async () => {
    const first = await reply(await guess({ guess: 2_000 }));
    await openClue('mailbox'); // after the guess: not recorded
    const again = await reply(await guess({ guess: 9_000 }));
    expect(again).toEqual({ ...first, replayed: true });
    expect(again.guess).toBe(2_000);
    expect((await getStore().game.playerDay(TODAY, ANON)).results).toHaveLength(1);

    // Concurrent duplicates: one score.
    const many = await Promise.all(Array.from({ length: 8 }, (_, i) => guess({ cardId: CARD_2!.id, guess: 1_500 + i * 1_000 })));
    const parsed = await Promise.all(many.map(reply));
    expect(new Set(parsed.map((p) => p.resultId)).size).toBe(1);
    expect(parsed.filter((p) => !p.replayed)).toHaveLength(1);

    // Another player guesses the same card on their own.
    const other = await reply(await guess({ anonId: OTHER_ANON, guess: 9_000 }, { anonId: OTHER_ANON }));
    expect(other).toMatchObject({ guess: 9_000, replayed: false });
    expect(other.resultId).not.toBe(first.resultId);
  });

  it('refuses guesses that are not a positive amount up to the cap', async () => {
    for (const value of [0, -100, MAX_GUESS + 1, '3000', null]) {
      const res = await guess({ guess: value });
      expect(res.status).toBe(400);
      expect((await errorOf(res)).code).toBe('bad_request');
    }
    expect((await getStore().game.playerDay(TODAY, ANON)).results).toEqual([]);
  });

  it('answers 404 not_in_set for a card outside today’s set, 409 day_over for a closed set', async () => {
    const tomorrow = dailyCards(dayNumber(TODAY) + 1)[0]!;
    const res = await guess({ cardId: tomorrow.id, guess: 3_000 });
    expect(res.status).toBe(404);
    expect((await errorOf(res)).code).toBe('not_in_set');

    vi.setSystemTime(new Date('2026-11-16T12:00:00Z'));
    const late = await guess({ guess: 3_000, date: TODAY });
    expect(late.status).toBe(409);
    expect(await errorOf(late)).toMatchObject({ code: 'day_over', today: '2026-11-16' });
  });

  it('scores a guess sent just after midnight against the set it was made on', async () => {
    await openClue('garage');
    vi.setSystemTime(new Date('2026-11-15T05:05:00Z')); // 12:05 AM Eastern on the 15th
    const r = await reply(await guess({ guess: 3_000, date: TODAY }));
    expect(r.cluesOpened).toEqual(['garage']);
    expect((await getStore().game.playerDay(TODAY, ANON)).results.map((x) => x.resultId)).toEqual([r.resultId]);
  });

  it('is rate-limited per anonymous id', async () => {
    const { perAnonId } = GAME_RATE_LIMITS.guess;
    for (let i = 0; i < perAnonId.limit; i++) expect((await guess({ guess: 3_000 })).status).toBe(200);
    const res = await guess({ guess: 3_000 });
    expect(res.status).toBe(429);
    expect((await errorOf(res)).code).toBe('rate_limited');
  });

  it('answers 503 unavailable when the store is down', async () => {
    vi.spyOn(getStore().game as Store['game'], 'submitGuess').mockRejectedValue(new StoreUnavailableError('not_configured', 'no STORE_URL'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await guess({ guess: 3_000 });
    expect(res.status).toBe(503);
    expect(res.headers.get('retry-after')).toBe('5');
    expect(await errorOf(res)).toEqual({ code: 'unavailable', reason: 'not_configured' });
  });
});
