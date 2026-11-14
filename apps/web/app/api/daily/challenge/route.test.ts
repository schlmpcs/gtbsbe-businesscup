import { duelRoundPoints } from '@lifeguessr/engine';
import { DUEL_ROUNDS, type DuelLetter, type DuelRound } from '@lifeguessr/types';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DuelChallengeResponseSchema } from '@/lib/api/gameSchemas';
import { duelScorer, findDuelPair } from '@/server/game/duel';
import { GAME_RATE_LIMITS } from '@/server/game/http';
import { ANON, errorOf, getReq, NOW, OTHER_ANON, postReq, setupGameTestEnv, TODAY } from '@/server/game/testUtils';
import { setStoreForTests, StoreUnavailableError, type Store } from '@/server/store';
import { newResultId } from '@/server/store/game';
import { describePostgres, testPostgresStore } from '@/server/store/testUtils';
import { POST as postHint } from '../hint/route';
import { POST as postPick } from '../pick/route';
import { GET } from './route';

const getStore = setupGameTestEnv();

const FULL = duelRoundPoints(0);
const HINTED = duelRoundPoints(1);

/** The costlier life of a round's pair: the right pick. */
const costlierOf = (date: string, round: DuelRound): DuelLetter => (duelScorer(findDuelPair(date, round)!, 'A')(0).correct ? 'A' : 'B');
const other = (letter: DuelLetter): DuelLetter => (letter === 'A' ? 'B' : 'A');

type Play = { round: DuelRound; right: boolean; hint?: boolean };

/**
 * `anonId` plays `plays` on `date` through the real routes (a hint first when asked, then the pick)
 * and answers the day's resultId: the id a challenge link carries.
 */
async function play(plays: readonly Play[], anonId = ANON, date = TODAY): Promise<string> {
  let resultId = '';
  for (const { round, right, hint } of plays) {
    if (hint) expect((await postHint(postReq('/api/daily/hint', { anonId, date, round }, { anonId }))).status).toBe(200);
    const choice = right ? costlierOf(date, round) : other(costlierOf(date, round));
    const res = await postPick(postReq('/api/daily/pick', { anonId, date, round, choice }, { anonId }));
    expect(res.status).toBe(200);
    resultId = ((await res.json()) as { resultId: string }).resultId;
  }
  return resultId;
}

/** Round 1 right with a hint (yellow), 2 and 3 right (green), 4 and 5 missed (ink). */
const FINISHED: Play[] = [
  { round: 1, right: true, hint: true }, { round: 2, right: true }, { round: 3, right: true },
  { round: 4, right: false }, { round: 5, right: false },
];

const challenge = (id: string, opts?: Parameters<typeof getReq>[1]) => GET(getReq(`/api/daily/challenge?c=${id}`, opts));

describe('GET /api/daily/challenge', () => {
  it('answers a finished day’s score and tiles, the contract’s fields and no more', async () => {
    const resultId = await play(FINISHED);
    const res = await challenge(resultId);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const raw = (await res.json()) as Record<string, unknown>;
    expect(raw).toEqual({
      ok: true,
      date: TODAY,
      rounds: 5,
      played: 5,
      right: 3,
      points: HINTED + 2 * FULL,
      tiles: ['yellow', 'green', 'green', 'ink', 'ink'],
      today: true,
    });
    expect(DuelChallengeResponseSchema.parse(raw)).toMatchObject({ right: 3, played: 5 });
  });

  it('carries no anonymous key, no choices, no totals and no card ids', async () => {
    const resultId = await play(FINISHED);
    const body = await (await challenge(resultId)).text();
    expect(body).not.toContain(ANON);
    expect(Object.keys(JSON.parse(body) as object).sort()).toEqual(['date', 'ok', 'played', 'points', 'right', 'rounds', 'tiles', 'today']);
    expect(body).not.toMatch(/choice|total|breakdown|decidedBy|lesson|crowd|cardId|zip|anon|hint/i);
    // What the store holds per pick is richer than the reply: the reply is built from the score only.
    expect(JSON.stringify(await getStore().duel.findDuelDay(resultId))).toMatch(/choice/);
  });

  it('is the same for a stranger: no anonymous id, any IP, and it reads without changing anything', async () => {
    const resultId = await play(FINISHED);
    const a = await (await challenge(resultId, { anonId: null })).json();
    const b = await (await challenge(resultId, { anonId: OTHER_ANON })).json();
    expect(b).toEqual(a);
    expect((await getStore().duel.findDuelDay(resultId))!.picks).toHaveLength(5);
  });

  it('answers what is stored so far for a day still being played', async () => {
    const resultId = await play([{ round: 3, right: true }, { round: 1, right: false }]);
    const reply = DuelChallengeResponseSchema.parse(await (await challenge(resultId)).json());
    expect(reply).toMatchObject({ played: 2, right: 1, points: FULL, tiles: ['ink', 'green'], today: true });
  });

  it('says today: false for a day before the one being served, and still answers its score', async () => {
    const yesterday = '2026-11-13';
    vi.setSystemTime(new Date('2026-11-13T17:00:00Z')); // the routes only score the day being served
    const resultId = await play(FINISHED, ANON, yesterday);
    vi.setSystemTime(new Date(NOW));
    const reply = DuelChallengeResponseSchema.parse(await (await challenge(resultId)).json());
    expect(reply).toMatchObject({ date: yesterday, played: 5, right: 3, today: false });
  });

  it('turns today: false at New York midnight, with no change to the stored day', async () => {
    const resultId = await play(FINISHED);
    expect((await (await challenge(resultId)).json()).today).toBe(true);
    vi.setSystemTime(new Date('2026-11-15T05:00:00Z')); // midnight on the 15th in New York
    expect(await (await challenge(resultId)).json()).toMatchObject({ date: TODAY, today: false, right: 3 });
  });

  it('tells two players’ days apart by their ids', async () => {
    const a = await play(FINISHED);
    const b = await play(DUEL_ROUNDS.map((round): Play => ({ round, right: true })), OTHER_ANON);
    expect(a).not.toBe(b);
    expect(await (await challenge(a)).json()).toMatchObject({ right: 3 });
    expect(await (await challenge(b)).json()).toMatchObject({ right: 5, points: 5 * FULL, tiles: ['green', 'green', 'green', 'green', 'green'] });
  });

  it('accepts the id in capitals or with spaces round it, like /api/share', async () => {
    const resultId = await play(FINISHED);
    expect((await challenge(resultId.toUpperCase())).status).toBe(200);
    expect((await challenge(`%20${resultId}%20`)).status).toBe(200);
  });

  it('answers 404 not_found for an id nobody holds', async () => {
    await play(FINISHED);
    const res = await challenge(newResultId());
    expect(res.status).toBe(404);
    expect(await errorOf(res)).toEqual({ code: 'not_found' });
  });

  it('answers 404 without touching the store for a malformed or missing id', async () => {
    const findDuelDay = vi.spyOn(getStore().duel, 'findDuelDay');
    const malformed = [
      '', 'abc', 'g'.repeat(32), '0'.repeat(31), '0'.repeat(33), `${'0'.repeat(31)}-`, '../../etc/passwd',
      'fixture-duel-2026-11-14-0a1b2c3d', encodeURIComponent("'; DROP TABLE duel_days; --"), '%00',
    ];
    for (const id of malformed) {
      const res = await challenge(id);
      expect(res.status, id).toBe(404);
      expect(await errorOf(res)).toEqual({ code: 'not_found' });
    }
    expect((await GET(getReq('/api/daily/challenge'))).status).toBe(404);
    expect((await GET(getReq('/api/daily/challenge?other=1'))).status).toBe(404);
    expect(findDuelDay).not.toHaveBeenCalled();
  });

  it('looks the id up as a duel day only, never as a slider result', async () => {
    const resultId = await play(FINISHED);
    const findResult = vi.spyOn(getStore().game, 'findResult');
    const findDuelDay = vi.spyOn(getStore().duel, 'findDuelDay');
    await challenge(resultId);
    expect(findDuelDay).toHaveBeenCalledExactlyOnceWith(resultId);
    expect(findResult).not.toHaveBeenCalled();
  });

  it('is rate-limited per IP, with the same budget as the other reads', async () => {
    const ip = '10.203.0.1';
    const missing = newResultId();
    for (let i = 0; i < GAME_RATE_LIMITS.read.perIp.limit; i++) expect((await challenge(missing, { ip })).status).toBe(404);
    const res = await challenge(missing, { ip });
    expect(res.status).toBe(429);
    expect((await errorOf(res)).code).toBe('rate_limited');
    expect(res.headers.get('retry-after')).toMatch(/^\d+$/);
    // A malformed id costs a request too: the limit comes before anything else.
    expect((await challenge('abc', { ip })).status).toBe(429);
  });

  it('answers 503 unavailable when the store is down', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(getStore().duel as Store['duel'], 'findDuelDay').mockRejectedValue(new StoreUnavailableError('unreachable', 'down'));
    const res = await challenge(newResultId());
    expect(res.status).toBe(503);
    expect((await errorOf(res)).code).toBe('unavailable');
  });
});

// The same lookup against the Postgres store, where findDuelDay joins duel_days to duel_picks.
describePostgres('GET /api/daily/challenge on Postgres', () => {
  let store: Store;
  let cleanup: () => Promise<void>;
  beforeAll(() => {
    ({ store, cleanup } = testPostgresStore());
  });
  afterAll(async () => cleanup());
  beforeEach(() => setStoreForTests(store));

  it('answers the stored day’s score, and 404 for an id nobody holds', async () => {
    const resultId = await play(FINISHED);
    expect(await (await challenge(resultId)).json()).toEqual({
      ok: true, date: TODAY, rounds: 5, played: 5, right: 3, points: HINTED + 2 * FULL,
      tiles: ['yellow', 'green', 'green', 'ink', 'ink'], today: true,
    });
    expect((await challenge(newResultId())).status).toBe(404);
  });
});
