import { findArea } from '@lifeguessr/data/areas';
import { dailyCards } from '@lifeguessr/data/cards';
import { DUEL_ROUNDS } from '@lifeguessr/types';
import type { DuelLetter, DuelRound } from '@lifeguessr/types';
import { describe, expect, it, vi } from 'vitest';
import { duel as t } from '@/copy/duel';
import { createFixtureDuelClient } from '@/features/game/model/duelFixtureClient';
import { HintReplySchema } from '@/lib/api/gameSchemas';
import { dayNumber } from '@/lib/dates';
import { duelHint, duelPool, duelScorer, findDuelPair, publicDuels } from '@/server/game/duel';
import { GAME_RATE_LIMITS, MAX_GAME_BODY_BYTES } from '@/server/game/http';
import { ANON, errorOf, OTHER_ANON, postReq, setupGameTestEnv, TODAY } from '@/server/game/testUtils';
import { StoreUnavailableError, type Store } from '@/server/store';
import { POST } from './route';

const getStore = setupGameTestEnv();
const hint = (body: Record<string, unknown>, opts?: Parameters<typeof postReq>[2]) =>
  POST(postReq('/api/daily/hint', { anonId: ANON, date: TODAY, round: 1, ...body }, opts));

/** The costlier life of a round's pair: the right pick. */
function costlierOf(date: string, round: DuelRound): DuelLetter {
  const pair = findDuelPair(date, round)!;
  return duelScorer(pair, 'A')(0).correct ? 'A' : 'B';
}

describe('POST /api/daily/hint', () => {
  it('records the hint for this player and round, then answers both lives’ neighborhood tier', async () => {
    const res = await hint({});
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const reply = HintReplySchema.parse(await res.json());
    expect(reply).toEqual({ ...duelHint(findDuelPair(TODAY, 1)!), recorded: true });
    expect(Object.values(t.hintFacts)).toContain(reply.A);
    expect(Object.values(t.hintFacts)).toContain(reply.B);

    await hint({ round: 4 });
    expect((await getStore().duel.playerDuelDay({ date: TODAY, anonId: ANON })).hintedRounds).toEqual([1, 4]);
    expect((await getStore().duel.playerDuelDay({ date: TODAY, anonId: OTHER_ANON })).hintedRounds).toEqual([]);
  });

  it('asking twice answers the same text with recorded: false and counts once', async () => {
    const first = await (await hint({})).json();
    const second = await (await hint({})).json();
    expect(first.recorded).toBe(true);
    expect(second).toEqual({ ...first, recorded: false });
    expect((await getStore().duel.playerDuelDay({ date: TODAY, anonId: ANON })).hintedRounds).toEqual([1]);

    // At the same moment: still one recorded.
    const both = await Promise.all([hint({ round: 2 }), hint({ round: 2 })]);
    const recorded = (await Promise.all(both.map((r) => r.json()))).map((b) => b.recorded).sort();
    expect(recorded).toEqual([false, true]);
  });

  it('a hint before the pick makes a correct pick score 900; a hint after it records nothing and changes no score', async () => {
    const { duel } = getStore();
    const round: DuelRound = 3;
    const choice = costlierOf(TODAY, round);
    const pair = findDuelPair(TODAY, round)!;

    // Hint, then pick: 900.
    expect((await (await hint({ round })).json()).recorded).toBe(true);
    const hinted = await duel.submitPick({ date: TODAY, anonId: ANON }, round, choice, duelScorer(pair, choice));
    expect(hinted.scored).toMatchObject({ correct: true, points: 900 });

    // No hint: 1,000 (the baseline for the same round).
    const plain = await duel.submitPick({ date: TODAY, anonId: OTHER_ANON }, round, choice, duelScorer(pair, choice));
    expect(plain.scored).toMatchObject({ correct: true, points: 1000 });

    // Pick, then hint: the text still comes back, recorded: false, and the stored points stay.
    const third = '3f6a2b1c-9d8e-4f7a-8b6c-5d4e3f2a1b0c';
    const picked = await duel.submitPick({ date: TODAY, anonId: third }, 2, costlierOf(TODAY, 2), duelScorer(findDuelPair(TODAY, 2)!, costlierOf(TODAY, 2)));
    expect(picked.scored.points).toBe(1000);
    const late = await hint({ anonId: third, round: 2 }, { anonId: third });
    expect(late.status).toBe(200);
    expect(await late.json()).toEqual({ ...duelHint(findDuelPair(TODAY, 2)!), recorded: false });
    const day = await duel.playerDuelDay({ date: TODAY, anonId: third });
    expect(day.hintedRounds).toEqual([]);
    expect(day.picks).toEqual([{ round: 2, choice: costlierOf(TODAY, 2), hints: 0, scored: picked.scored }]);
  });

  it('serves the same texts as the fixture client for the same pair, on several days', async () => {
    for (const date of ['2026-11-14', '2026-11-20', '2027-03-08']) {
      vi.setSystemTime(new Date(`${date}T17:00:00.000Z`));
      const fixture = createFixtureDuelClient({ cards: duelPool, persist: false, areaFor: (zip) => findArea(zip) });
      const { duels } = await fixture.daily(date);
      expect(duels).toEqual(publicDuels(date)); // the same five pairs
      for (const round of DUEL_ROUNDS) {
        const anonId = `00000000-0000-4000-8000-${`${date.replaceAll('-', '')}${round}`.padStart(12, '0')}`;
        const res = await POST(postReq('/api/daily/hint', { anonId, date, round }, { anonId }));
        expect(res.status).toBe(200);
        const { recorded, ...texts } = HintReplySchema.parse(await res.json());
        expect(recorded).toBe(true);
        expect(texts).toEqual(await fixture.hint(round, date));
      }
    }
  });

  it('accepts the set’s date, including yesterday’s just after midnight, and refuses a closed set (409 day_over)', async () => {
    expect((await hint({ date: TODAY })).status).toBe(200);

    vi.setSystemTime(new Date('2026-11-15T05:10:00Z')); // 12:10 AM Eastern on the 15th
    const grace = await hint({ date: TODAY, round: 2 });
    expect(grace.status).toBe(200);
    expect(await grace.json()).toEqual({ ...duelHint(findDuelPair(TODAY, 2)!), recorded: true }); // yesterday's set
    expect((await getStore().duel.playerDuelDay({ date: TODAY, anonId: ANON })).hintedRounds).toEqual([1, 2]);
    expect((await hint({ date: '2026-11-15', round: 3 })).status).toBe(200); // today's set

    vi.setSystemTime(new Date('2026-11-15T06:00:00Z')); // 1 AM: the grace period is over
    const over = await hint({ date: TODAY, round: 4 });
    expect(over.status).toBe(409);
    expect(await errorOf(over)).toMatchObject({ code: 'day_over', today: '2026-11-15' });
    expect((await getStore().duel.playerDuelDay({ date: TODAY, anonId: ANON })).hintedRounds).toEqual([1, 2]);

    const future = await hint({ date: '2026-11-16' });
    expect(future.status).toBe(409);
  });

  it.each([
    ['round 6', { round: 6 }],
    ['round 0', { round: 0 }],
    ['a round sent as a string', { round: '1' }],
    ['a missing round', { round: undefined }],
    ['a missing date', { date: undefined }],
    ['a malformed date', { date: '11/14/2026' }],
    ['a missing anonId', { anonId: undefined }],
    ['an anonId that is not a UUID', { anonId: 'player-1' }],
    ['a choice (the hint takes none)', { choice: 'A' }],
    ['a client-sent score', { points: 1000 }],
    ['a client-sent hint count', { hints: 0 }],
  ])('answers 400 for %s, and records nothing', async (_, body) => {
    const res = await POST(postReq('/api/daily/hint', { anonId: ANON, date: TODAY, round: 1, ...body }, { anonId: null }));
    expect(res.status).toBe(400);
    expect((await errorOf(res)).code).toBe('bad_request');
    expect((await getStore().duel.playerDuelDay({ date: TODAY, anonId: ANON })).hintedRounds).toEqual([]);
  });

  it('answers 400 for a body that is not JSON, an array, or null', async () => {
    for (const body of ['{"anonId":', '[]', 'null']) {
      const res = await POST(postReq('/api/daily/hint', body));
      expect(res.status).toBe(400);
    }
  });

  it('answers 400 when x-anon-id and the body disagree or the header is not a UUID, 413 for an oversized body', async () => {
    const mismatch = await hint({}, { anonId: OTHER_ANON });
    expect(mismatch.status).toBe(400);
    expect(await errorOf(mismatch)).toMatchObject({ code: 'bad_request' });
    expect((await hint({}, { anonId: 'nope' })).status).toBe(400);
    expect((await getStore().duel.playerDuelDay({ date: TODAY, anonId: ANON })).hintedRounds).toEqual([]);

    const big = await POST(postReq('/api/daily/hint', `{"pad":"${'x'.repeat(MAX_GAME_BODY_BYTES)}"}`));
    expect(big.status).toBe(413);
    expect((await errorOf(big)).code).toBe('too_large');
  });

  it('is rate-limited per anonymous id and per IP, with Retry-After', async () => {
    const { perAnonId, perIp } = GAME_RATE_LIMITS.hint;
    expect(perAnonId.limit).toBe(40);
    expect(perIp.limit).toBe(240);
    for (let i = 0; i < perAnonId.limit; i++) expect((await hint({})).status).toBe(200);
    const limited = await hint({});
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toMatch(/^\d+$/);
    expect(await errorOf(limited)).toMatchObject({ code: 'rate_limited', retryAfterSeconds: expect.any(Number) });

    const ip = '10.201.0.1';
    const ids = Array.from({ length: perIp.limit + 1 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
    const statuses = [];
    for (const anonId of ids) {
      statuses.push((await POST(postReq('/api/daily/hint', { anonId, date: TODAY, round: 1 }, { anonId, ip }))).status);
    }
    expect(statuses.slice(0, -1).every((s) => s === 200)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
  });

  it('does not share its budget with the clue or pick routes', async () => {
    const { perAnonId } = GAME_RATE_LIMITS.hint;
    for (let i = 0; i < perAnonId.limit; i++) await hint({});
    expect((await hint({})).status).toBe(429);
    const { POST: clue } = await import('../clue/route');
    const [card] = dailyCards(dayNumber(TODAY));
    expect((await clue(postReq('/api/daily/clue', { anonId: ANON, cardId: card!.id, clue: 'garage' }))).status).toBe(200);
  });

  it('answers 503 unavailable when the store is down, and reveals nothing unrecorded', async () => {
    vi.spyOn(getStore().duel as Store['duel'], 'openHint').mockRejectedValue(new StoreUnavailableError('unreachable', 'down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await hint({});
    expect(res.status).toBe(503);
    expect(res.headers.get('retry-after')).toBe('5');
    expect(await errorOf(res)).toEqual({ code: 'unavailable', reason: 'unreachable' });
  });

  it('lets an unexpected store error surface as a 500, never a silent reply', async () => {
    vi.spyOn(getStore().duel as Store['duel'], 'openHint').mockRejectedValue(new TypeError('bug'));
    await expect(hint({})).rejects.toThrow('bug');
  });
});
