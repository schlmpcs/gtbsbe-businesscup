import { findArea } from '@lifeguessr/data/areas';
import { DUEL_ROUNDS } from '@lifeguessr/types';
import type { DuelLetter, DuelRound } from '@lifeguessr/types';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFixtureDuelClient } from '@/features/game/model/duelFixtureClient';
import { PickReplySchema, type PickReply } from '@/lib/api/gameSchemas';
import type * as DuelModule from '@/server/game/duel';
import { duelPool, duelScorer, findDuelPair, publicDuels } from '@/server/game/duel';
import { GAME_RATE_LIMITS, MAX_GAME_BODY_BYTES } from '@/server/game/http';
import { ANON, errorOf, OTHER_ANON, postReq, setupGameTestEnv, TODAY } from '@/server/game/testUtils';
import { setStoreForTests, StoreUnavailableError, type Store } from '@/server/store';
import { describePostgres, testPostgresStore } from '@/server/store/testUtils';
import { POST as postHint } from '../hint/route';
import { POST } from './route';

// findDuelPair goes through a spy that calls the real function, so one test can hand the route a
// pair of two lives that cost the same (which the real pairing never makes) and check that the
// route refuses to score it.
vi.mock('@/server/game/duel', async (importOriginal) => {
  const actual = await importOriginal<typeof DuelModule>();
  return { ...actual, findDuelPair: vi.fn(actual.findDuelPair) };
});

const getStore = setupGameTestEnv();
const pick = (body: Record<string, unknown>, opts?: Parameters<typeof postReq>[2]) =>
  POST(postReq('/api/daily/pick', { anonId: ANON, date: TODAY, round: 1, choice: 'A', ...body }, opts));
const hint = (body: Record<string, unknown>, opts?: Parameters<typeof postReq>[2]) =>
  postHint(postReq('/api/daily/hint', { anonId: ANON, date: TODAY, round: 1, ...body }, opts));

async function replyOf(res: Response): Promise<PickReply> {
  expect(res.status).toBe(200);
  expect(res.headers.get('cache-control')).toBe('no-store');
  return PickReplySchema.parse(await res.json());
}

/** The costlier life of a round's pair: the right pick. */
function costlierOf(date: string, round: DuelRound): DuelLetter {
  const pair = findDuelPair(date, round)!;
  return duelScorer(pair, 'A')(0).correct ? 'A' : 'B';
}
const other = (letter: DuelLetter): DuelLetter => (letter === 'A' ? 'B' : 'A');

/** The i-th made-up player of a crowd (a valid UUID, never ANON or OTHER_ANON). */
const crowdAnon = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;

/** Players crowdAnon(from) … crowdAnon(from + choices.length - 1) pick `round`, one letter each, through the route. */
async function crowdPicks(round: DuelRound, choices: readonly DuelLetter[], from = 0): Promise<PickReply[]> {
  const replies: PickReply[] = [];
  for (const [i, choice] of choices.entries()) {
    const anonId = crowdAnon(from + i);
    replies.push(await replyOf(await pick({ anonId, round, choice }, { anonId })));
  }
  return replies;
}

const storedPicks = async (anonId = ANON, date = TODAY) =>
  (await getStore().duel.playerDuelDay({ date, anonId })).picks;

describe('POST /api/daily/pick', () => {
  it('scores the costlier pick 1,000 points, stores it under the day’s resultId and answers the full result', async () => {
    const round: DuelRound = 1;
    const choice = costlierOf(TODAY, round);
    const reply = await replyOf(await pick({ round, choice }));

    const { resultId, crowd: _crowd, replayed: _replayed, ...scored } = reply;
    expect(scored).toEqual(duelScorer(findDuelPair(TODAY, round)!, choice)(0));
    expect(reply).toMatchObject({ correct: true, points: 1000, replayed: false, crowd: null });
    expect(reply.totals[choice]).toBeGreaterThan(reply.totals[other(choice)]);
    expect(reply.breakdown.A.length).toBeGreaterThan(0);
    expect(reply.lesson.length).toBeGreaterThan(0);

    const day = await getStore().duel.playerDuelDay({ date: TODAY, anonId: ANON });
    expect(day.resultId).toBe(resultId);
    expect(day.picks).toEqual([{ round, choice, hints: 0, scored }]);
    expect(await storedPicks(OTHER_ANON)).toEqual([]);
  });

  it('scores 900 for a right pick after a recorded hint, and 0 for the wrong one', async () => {
    const choice = costlierOf(TODAY, 2);
    expect((await (await hint({ round: 2 })).json()).recorded).toBe(true);
    expect(await replyOf(await pick({ round: 2, choice }))).toMatchObject({ correct: true, points: 900 });

    const wrong = await replyOf(await pick({ round: 3, choice: other(costlierOf(TODAY, 3)) }));
    expect(wrong).toMatchObject({ correct: false, points: 0, replayed: false });

    // A wrong pick after a hint is still 0, and every round of the day shares one resultId.
    await hint({ round: 4 });
    const wrongHinted = await replyOf(await pick({ round: 4, choice: other(costlierOf(TODAY, 4)) }));
    expect(wrongHinted).toMatchObject({ correct: false, points: 0 });
    expect(new Set([wrong.resultId, wrongHinted.resultId]).size).toBe(1);
  });

  it('a hint asked by another player, or on another round, does not lower this pick', async () => {
    expect((await hint({ anonId: OTHER_ANON, round: 1 }, { anonId: OTHER_ANON })).status).toBe(200);
    await hint({ round: 2 });
    const reply = await replyOf(await pick({ round: 1, choice: costlierOf(TODAY, 1) }));
    expect(reply.points).toBe(1000);
  });

  it('answers the first result with replayed: true on a repeat, even with the other letter, and never scores twice', async () => {
    const round: DuelRound = 2;
    const first = await replyOf(await pick({ round, choice: 'A' }));
    expect(first.replayed).toBe(false);

    // A hint after the pick is not recorded, so it cannot change the replayed points either.
    await hint({ round });
    for (const choice of ['B', 'A'] as const) {
      const again = await replyOf(await pick({ round, choice }));
      expect(again).toEqual({ ...first, replayed: true });
    }
    expect(await storedPicks()).toEqual([{ round, choice: 'A', hints: 0, scored: expect.anything() }]);

    // Two picks of one round at the same moment, one per letter: one is scored, the other replays it.
    const both = await Promise.all([pick({ round: 3, choice: 'A' }), pick({ round: 3, choice: 'B' })]);
    const [a, b] = await Promise.all(both.map(replyOf));
    expect([a!.replayed, b!.replayed].sort()).toEqual([false, true]);
    const { replayed: _a, ...restA } = a!;
    const { replayed: _b, ...restB } = b!;
    expect(restA).toEqual(restB);
    expect((await storedPicks()).filter((p) => p.round === 3)).toHaveLength(1);
  });

  it('answers the crowd from 20 stored picks of the round, the player’s own included; null before', async () => {
    // ANON picks first: one pick is no crowd.
    const own = await replyOf(await pick({ round: 1, choice: 'A' }));
    expect(own.crowd).toBeNull();

    // 18 more players (11 A, 7 B): the 19th pick still answers null.
    const choices: DuelLetter[] = [...Array<DuelLetter>(11).fill('A'), ...Array<DuelLetter>(7).fill('B')];
    const nineteen = await crowdPicks(1, choices);
    expect(nineteen.every((r) => r.crowd === null && !r.replayed)).toBe(true);

    // The 20th player's reply counts everyone, their own pick and ANON's included.
    const [twentieth] = await crowdPicks(1, ['B'], 18);
    expect(twentieth!.crowd).toEqual({ pickedA: 12, total: 20 });

    // Another round of the same day is counted on its own.
    expect((await replyOf(await pick({ round: 2, choice: 'A' }))).crowd).toBeNull();
  });

  it('a replayed pick carries the crowd of now, not the one it was first answered with, and adds no pick', async () => {
    await crowdPicks(1, Array<DuelLetter>(19).fill('B'));
    const first = await replyOf(await pick({ round: 1, choice: 'A' }));
    expect(first.crowd).toEqual({ pickedA: 1, total: 20 });

    await crowdPicks(1, ['A', 'A'], 19);
    for (const choice of ['A', 'B'] as const) {
      const replay = await replyOf(await pick({ round: 1, choice }));
      expect(replay).toEqual({ ...first, replayed: true, crowd: { pickedA: 3, total: 22 } });
    }
    // The replays above were answered from the stored row: still 22 picks, not 24.
    expect((await getStore().duel.crowds(TODAY, [1])).get(1)).toEqual({ A: 3, B: 19 });
  });

  it('takes the rounds in any order', async () => {
    const order: DuelRound[] = [4, 1, 5, 3, 2];
    const replies = [];
    for (const round of order) replies.push(await replyOf(await pick({ round, choice: costlierOf(TODAY, round) })));
    expect(replies.every((r) => r.correct && r.points === 1000 && !r.replayed)).toBe(true);
    expect(new Set(replies.map((r) => r.resultId)).size).toBe(1);
    expect((await storedPicks()).map((p) => p.round)).toEqual([1, 2, 3, 4, 5]);
  });

  it('scores the same result as the fixture client for the same pair, choice and hints, on several days', async () => {
    for (const date of ['2026-11-14', '2026-11-20', '2027-03-08']) {
      vi.setSystemTime(new Date(`${date}T17:00:00.000Z`));
      const fixture = createFixtureDuelClient({ cards: duelPool, persist: false, areaFor: (zip) => findArea(zip) });
      const { duels } = await fixture.daily(date);
      expect(duels).toEqual(publicDuels(date)); // the same five pairs on both sides
      const anonId = `00000000-0000-4000-8000-${date.replaceAll('-', '').padStart(12, '0')}`;
      for (const round of DUEL_ROUNDS) {
        // Every mix: right and wrong picks, with and without a hint, both letters.
        const choice: DuelLetter = round % 2 === 0 ? 'A' : 'B';
        if (round === 2 || round === 3) {
          await fixture.hint(round, date);
          expect((await postHint(postReq('/api/daily/hint', { anonId, date, round }, { anonId }))).status).toBe(200);
        }
        const { resultId, replayed, ...server } = await replyOf(await POST(postReq('/api/daily/pick', { anonId, date, round, choice }, { anonId })));
        const { resultId: _fixtureId, ...local } = await fixture.pick(round, choice, date);
        expect(replayed).toBe(false);
        expect(resultId).toMatch(/^[0-9a-f]{32}$/);
        expect(server).toEqual(local);
      }
    }
  });

  it('accepts yesterday’s set just after midnight and scores it on that set; a closed set is 409 day_over with today', async () => {
    vi.setSystemTime(new Date('2026-11-15T05:10:00Z')); // 12:10 AM Eastern on the 15th
    const choice = costlierOf(TODAY, 1);
    const grace = await replyOf(await pick({ date: TODAY, choice }));
    expect(grace).toMatchObject({ correct: true, points: 1000 });
    const { resultId: _r, crowd: _c, replayed: _p, ...scored } = grace;
    expect(scored).toEqual(duelScorer(findDuelPair(TODAY, 1)!, choice)(0)); // yesterday's pair
    expect(await storedPicks(ANON, TODAY)).toHaveLength(1);
    expect(await storedPicks(ANON, '2026-11-15')).toEqual([]);

    vi.setSystemTime(new Date('2026-11-15T06:00:00Z')); // 1 AM: the grace period is over
    const over = await pick({ date: TODAY, round: 2 });
    expect(over.status).toBe(409);
    expect(await errorOf(over)).toMatchObject({ code: 'day_over', today: '2026-11-15' });
    expect(await storedPicks(ANON, TODAY)).toHaveLength(1);

    const future = await pick({ date: '2026-11-16' });
    expect(future.status).toBe(409);
    expect(await errorOf(future)).toMatchObject({ code: 'day_over', today: '2026-11-15' });
  });

  it.each([
    ['round 6', { round: 6 }],
    ['round 0', { round: 0 }],
    ['a round sent as a string', { round: '1' }],
    ['choice C', { choice: 'C' }],
    ['a lower-case choice', { choice: 'a' }],
    ['a missing choice', { choice: undefined }],
    ['a missing date', { date: undefined }],
    ['a malformed date', { date: '11/14/2026' }],
    ['an impossible date', { date: '2026-13-01' }],
    ['a missing anonId', { anonId: undefined }],
    ['an anonId that is not a UUID', { anonId: 'player-1' }],
    ['a client-sent score', { points: 1000 }],
    ['a client-sent hint count', { hints: 0 }],
    ['client-sent totals', { totals: { A: 1, B: 2 } }],
    ['a client-sent correct flag', { correct: true }],
  ])('answers 400 for %s, and stores nothing', async (_, body) => {
    const res = await POST(postReq('/api/daily/pick', { anonId: ANON, date: TODAY, round: 1, choice: 'A', ...body }, { anonId: null }));
    expect(res.status).toBe(400);
    expect((await errorOf(res)).code).toBe('bad_request');
    expect(await storedPicks()).toEqual([]);
  });

  it('answers 400 for a body that is not JSON, an array, or null', async () => {
    for (const body of ['{"anonId":', '[]', 'null']) {
      const res = await POST(postReq('/api/daily/pick', body));
      expect(res.status).toBe(400);
    }
  });

  it('answers 400 when x-anon-id and the body disagree or the header is not a UUID, 413 for an oversized body', async () => {
    const mismatch = await pick({}, { anonId: OTHER_ANON });
    expect(mismatch.status).toBe(400);
    expect(await errorOf(mismatch)).toMatchObject({ code: 'bad_request' });
    expect((await pick({}, { anonId: 'nope' })).status).toBe(400);
    expect(await storedPicks()).toEqual([]);
    expect(await storedPicks(OTHER_ANON)).toEqual([]);

    const big = await POST(postReq('/api/daily/pick', `{"pad":"${'x'.repeat(MAX_GAME_BODY_BYTES)}"}`));
    expect(big.status).toBe(413);
    expect((await errorOf(big)).code).toBe('too_large');
  });

  it('is rate-limited per anonymous id and per IP, with Retry-After', async () => {
    const { perAnonId, perIp } = GAME_RATE_LIMITS.pick;
    expect(perAnonId.limit).toBe(20);
    expect(perIp.limit).toBe(120);
    for (let i = 0; i < perAnonId.limit; i++) expect((await pick({})).status).toBe(200);
    const limited = await pick({});
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toMatch(/^\d+$/);
    expect(await errorOf(limited)).toMatchObject({ code: 'rate_limited', retryAfterSeconds: expect.any(Number) });

    const ip = '10.202.0.1';
    const ids = Array.from({ length: perIp.limit + 1 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
    const statuses = [];
    for (const anonId of ids) {
      statuses.push((await POST(postReq('/api/daily/pick', { anonId, date: TODAY, round: 1, choice: 'B' }, { anonId, ip }))).status);
    }
    expect(statuses.slice(0, -1).every((s) => s === 200)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
  });

  it('does not share its budget with the hint route', async () => {
    for (let i = 0; i < GAME_RATE_LIMITS.pick.perAnonId.limit; i++) await pick({});
    expect((await pick({})).status).toBe(429);
    expect((await hint({ round: 2 })).status).toBe(200);
  });

  it('answers 503 unavailable when the store is down', async () => {
    vi.spyOn(getStore().duel as Store['duel'], 'submitPick').mockRejectedValue(new StoreUnavailableError('unreachable', 'down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await pick({});
    expect(res.status).toBe(503);
    expect(res.headers.get('retry-after')).toBe('5');
    expect(await errorOf(res)).toEqual({ code: 'unavailable', reason: 'unreachable' });
  });

  it('lets an unexpected store error surface as a 500, never a silent reply', async () => {
    vi.spyOn(getStore().duel as Store['duel'], 'submitPick').mockRejectedValue(new TypeError('bug'));
    await expect(pick({})).rejects.toThrow('bug');
  });

  it('throws (a 500 and a log line) for a pair whose lives cost the same, and stores nothing', async () => {
    const real = findDuelPair(TODAY, 2)!;
    vi.mocked(findDuelPair).mockImplementationOnce(() => ({ ...real, B: real.A }));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(pick({ round: 2, choice: 'A' })).rejects.toThrow(/cost the same/);
    expect(log).toHaveBeenCalledWith(expect.stringContaining(`[daily/pick] ${TODAY} round 2`), expect.any(Error));
    expect(await storedPicks()).toEqual([]);
  });
});

// The same path on Postgres, where the store scores inside a transaction with the hints it has on
// disk and a repeat is caught by the UNIQUE row, not by a lookup in memory.
describePostgres('POST /api/daily/pick on Postgres', () => {
  let store: Store;
  let cleanup: () => Promise<void>;
  beforeAll(() => {
    ({ store, cleanup } = testPostgresStore());
  });
  afterAll(async () => cleanup());
  beforeEach(() => setStoreForTests(store));

  it('scores with the stored hint, replays the first result for the other letter, and keeps one row under a race', async () => {
    const anonId = '5b4a3c2d-1e0f-4a9b-8c7d-6e5f4a3b2c1d';
    const choice = costlierOf(TODAY, 1);
    expect((await hint({ anonId, round: 1 }, { anonId })).status).toBe(200);
    const first = await replyOf(await pick({ anonId, round: 1, choice }, { anonId }));
    expect(first).toMatchObject({ correct: true, points: 900, replayed: false });
    expect(await replyOf(await pick({ anonId, round: 1, choice: other(choice) }, { anonId }))).toEqual({ ...first, replayed: true });

    const both = await Promise.all([pick({ anonId, round: 5, choice: 'A' }, { anonId }), pick({ anonId, round: 5, choice: 'B' }, { anonId })]);
    const replies = await Promise.all(both.map(replyOf));
    expect(replies.map((r) => r.replayed).sort()).toEqual([false, true]);
    expect(replies[0]!.points).toBe(replies[1]!.points);
    expect(replies.every((r) => r.resultId === first.resultId)).toBe(true);
    const day = await store.duel.playerDuelDay({ date: TODAY, anonId });
    expect(day.picks.map((p) => p.round)).toEqual([1, 5]);
  });

  it('answers the crowd from the stored rows from 20 picks on, and a replay carries the current count', async () => {
    // Round 3 only: the test above picked rounds 1 and 5 of this day on the same schema.
    const replies = await crowdPicks(3, [...Array<DuelLetter>(13).fill('A'), ...Array<DuelLetter>(6).fill('B')], 100);
    expect(replies.at(-1)!.crowd).toBeNull(); // 19 picks
    const anonId = crowdAnon(200);
    const twentieth = await replyOf(await pick({ anonId, round: 3, choice: 'B' }, { anonId }));
    expect(twentieth.crowd).toEqual({ pickedA: 13, total: 20 });

    await crowdPicks(3, ['A'], 300);
    const replay = await replyOf(await pick({ anonId, round: 3, choice: 'A' }, { anonId }));
    expect(replay).toEqual({ ...twentieth, replayed: true, crowd: { pickedA: 14, total: 21 } });
    expect((await store.duel.crowds(TODAY, [3])).get(3)).toEqual({ A: 14, B: 7 });
  });
});
