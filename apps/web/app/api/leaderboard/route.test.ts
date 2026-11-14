import { dailyCards } from '@lifeguessr/data/cards';
import { describe, expect, it, vi } from 'vitest';
import { GuessReplySchema, LeaderboardResponseSchema } from '@/lib/api/gameSchemas';
import { dayNumber } from '@/lib/dates';
import { ANON, errorOf, getReq, OTHER_ANON, postReq, setupGameTestEnv, TODAY } from '@/server/game/testUtils';
import { anonKey } from '@/server/store';
import { handleOf } from '@/server/store/game';
import { POST as postGuess } from '../daily/guess/route';
import { GET } from './route';

setupGameTestEnv();
const CARDS = dailyCards(dayNumber(TODAY));
const THIRD = '3c3c3c3c-3c3c-4c3c-8c3c-3c3c3c3c3c3c';

async function play(anonId: string, guesses: number[]): Promise<number> {
  let points = 0;
  for (const [i, guess] of guesses.entries()) {
    const res = await postGuess(postReq('/api/daily/guess', { anonId, cardId: CARDS[i]!.id, guess }, { anonId }));
    points += GuessReplySchema.parse(await res.json()).result.points;
  }
  return points;
}

const board = async (query = '', anonId: string | null = null) => {
  const res = await GET(getReq(`/api/leaderboard${query}`, { anonId }));
  expect(res.status).toBe(200);
  return LeaderboardResponseSchema.parse(await res.json());
};

describe('GET /api/leaderboard', () => {
  it('ranks today’s players by the points of their stored guesses, under made-up handles', async () => {
    const a = await play(ANON, [3_000, 3_000, 3_000]);
    const b = await play(OTHER_ANON, [1_000, 14_000]);
    const c = await play(THIRD, [5_000]);

    const res = await board('', OTHER_ANON);
    expect(res.date).toBe(TODAY);
    expect(res.players).toBe(3);
    const expected = [
      { key: ANON, points: a, played: 3 },
      { key: OTHER_ANON, points: b, played: 2 },
      { key: THIRD, points: c, played: 1 },
    ].sort((x, y) => y.points - x.points);
    expect(res.entries.map((e) => e.points)).toEqual(expected.map((e) => e.points));
    expect(res.entries.map((e) => e.handle)).toEqual(expected.map((e) => handleOf(anonKey(e.key))));
    expect(res.entries.map((e) => e.played)).toEqual(expected.map((e) => e.played));
    // Ranks follow the points (ties share one).
    for (const [i, e] of res.entries.entries()) {
      expect(e.rank).toBe(1 + res.entries.filter((x) => x.points > e.points).length);
      expect(e.you).toBe(expected[i]!.key === OTHER_ANON);
    }
    const own = res.entries.find((e) => e.you)!;
    expect(res.rank).toBe(own.rank);
    expect(res.todayStats).toEqual({ handle: own.handle, points: b, played: 2, inRange: own.inRange });

    // No ids, no keys.
    const text = JSON.stringify(res);
    for (const id of [ANON, OTHER_ANON, THIRD]) {
      expect(text).not.toContain(id);
      expect(text).not.toContain(anonKey(id).slice(0, 16));
    }
  });

  it('answers rank and todayStats as null without an id or before a first guess', async () => {
    await play(ANON, [3_000]);
    expect(await board()).toMatchObject({ players: 1, rank: null, todayStats: null });
    expect(await board('', OTHER_ANON)).toMatchObject({ players: 1, rank: null, todayStats: null });
  });

  it('caps entries with limit but still answers the caller’s own rank', async () => {
    await play(ANON, [3_000, 3_000]);
    await play(OTHER_ANON, [100]); // 0 points: last
    const res = await board('?limit=1', OTHER_ANON);
    expect(res.entries).toHaveLength(1);
    expect(res.entries[0]!.you).toBe(false);
    expect(res.rank).toBe(2);
  });

  it('reads another day’s board, and nothing before anyone played', async () => {
    await play(ANON, [3_000]);
    vi.setSystemTime(new Date('2026-11-15T17:00:00Z'));
    expect(await board()).toMatchObject({ date: '2026-11-15', players: 0, entries: [] });
    expect(await board(`?date=${TODAY}`)).toMatchObject({ date: TODAY, players: 1 });
  });

  it.each([
    ['a malformed date', '?date=2026-13-01'],
    ['a future date', '?date=2026-11-15'],
    ['limit 0', '?limit=0'],
    ['limit over the cap', '?limit=101'],
    ['a non-numeric limit', '?limit=ten'],
  ])('answers 400 for %s', async (_, query) => {
    const res = await GET(getReq(`/api/leaderboard${query}`));
    expect(res.status).toBe(400);
    expect((await errorOf(res)).code).toBe('bad_request');
  });
});
