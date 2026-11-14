import { getArea } from '@lifeguessr/data/areas';
import { dailyCards, lifeCards } from '@lifeguessr/data/cards';
import { costOfLife } from '@lifeguessr/engine';
import type { DuelLetter, DuelRound } from '@lifeguessr/types';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { duel as t } from '@/copy/duel';
import { DailyResponseSchema, DuelDailyResponseSchema, PickReplySchema } from '@/lib/api/gameSchemas';
import { dayNumber } from '@/lib/dates';
import { clueReveal } from '@/server/game/daily';
import { duelHint, duelScorer, findDuelPair, publicDuels } from '@/server/game/duel';
import { GAME_RATE_LIMITS } from '@/server/game/http';
import { ANON, errorOf, getReq, OTHER_ANON, postReq, setupGameTestEnv, TODAY } from '@/server/game/testUtils';
import { setStoreForTests, StoreUnavailableError, type Store } from '@/server/store';
import { describePostgres, testPostgresStore } from '@/server/store/testUtils';
import { POST as postClue } from './clue/route';
import { POST as postGuess } from './guess/route';
import { POST as postPick } from './pick/route';
import { GET } from './route';

const getStore = setupGameTestEnv();

const daily = async (anonId: string | null = null) => {
  const res = await GET(getReq('/api/daily', { anonId }));
  expect(res.status).toBe(200);
  expect(res.headers.get('cache-control')).toBe('no-store');
  const raw = (await res.json()) as Record<string, unknown>;
  return { raw, parsed: DailyResponseSchema.parse(raw) };
};

describe('GET /api/daily', () => {
  it('answers today’s 5 PublicCards for the US Eastern date, the same for everyone', async () => {
    const a = await daily();
    const b = await daily(ANON);
    const c = await daily(OTHER_ANON);
    expect(a.parsed.date).toBe(TODAY);
    expect(a.parsed.cards.map((x) => x.id)).toEqual(dailyCards(dayNumber(TODAY)).map((x) => x.id));
    expect(b.parsed.cards).toEqual(a.parsed.cards);
    expect(c.parsed.cards).toEqual(a.parsed.cards);
    // No answer reaches the browser before the guess: PublicCard fields only.
    for (const card of a.raw.cards as Record<string, unknown>[]) {
      expect(Object.keys(card).sort()).toEqual(['caption', 'decor', 'id', 'layout', 'metro']);
    }
    expect(JSON.stringify(a.raw)).not.toMatch(/"(zip|kids|car|eatingOutPerWeek|adults|total|price|cost)"/);
    expect(a.raw.progress).toBeUndefined(); // no id, no progress
  });

  it('rolls over at US Eastern midnight, not UTC midnight', async () => {
    vi.setSystemTime(new Date('2026-11-15T04:59:59Z')); // 11:59:59 PM Eastern on the 14th
    expect((await daily()).parsed.date).toBe('2026-11-14');
    vi.setSystemTime(new Date('2026-11-15T05:00:00Z'));
    const next = (await daily()).parsed;
    expect(next.date).toBe('2026-11-15');
    expect(next.cards.map((x) => x.id)).toEqual(dailyCards(dayNumber('2026-11-15')).map((x) => x.id));
    vi.setSystemTime(new Date('2026-07-04T03:59:59Z')); // daylight time: midnight is 04:00 UTC
    expect((await daily()).parsed.date).toBe('2026-07-03');
  });

  it('with x-anon-id, answers what the server recorded for this player today', async () => {
    const [first, second] = (await daily()).parsed.cards;
    await postClue(postReq('/api/daily/clue', { anonId: ANON, cardId: first!.id, clue: 'garage' }));
    await postClue(postReq('/api/daily/clue', { anonId: ANON, cardId: first!.id, clue: 'kitchen' }));
    await postClue(postReq('/api/daily/clue', { anonId: ANON, cardId: second!.id, clue: 'entry' }));
    const guessed = await postGuess(postReq('/api/daily/guess', { anonId: ANON, cardId: first!.id, guess: 3_200 }));
    const reveal = (await guessed.json()) as { resultId: string };

    const { progress } = (await daily(ANON)).parsed;
    const card = dailyCards(dayNumber(TODAY))[0]!;
    expect(progress!.clues[first!.id]).toEqual([clueReveal(card, 'garage'), clueReveal(card, 'kitchen')]);
    expect(progress!.clues[second!.id]!.map((c) => c.clue)).toEqual(['entry']);
    expect(Object.keys(progress!.guesses)).toEqual([first!.id]);
    expect(progress!.guesses[first!.id]).toMatchObject({ guess: 3_200, reveal: { resultId: reveal.resultId, cluesOpened: ['garage', 'kitchen'] } });

    expect((await daily(OTHER_ANON)).parsed.progress).toEqual({ clues: {}, guesses: {} });
  });

  it('refuses a malformed x-anon-id', async () => {
    const res = await GET(getReq('/api/daily', { anonId: 'not-a-uuid' }));
    expect(res.status).toBe(400);
    expect((await errorOf(res)).code).toBe('bad_request');
  });

  it('answers 503 when progress is asked for and the store is down, and still serves the set without an id', async () => {
    const down = getStore();
    vi.spyOn(down.game as Store['game'], 'playerDay').mockRejectedValue(new StoreUnavailableError('unreachable', 'down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await GET(getReq('/api/daily', { anonId: ANON }));
    expect(res.status).toBe(503);
    expect(await errorOf(res)).toEqual({ code: 'unavailable', reason: 'unreachable' });
    expect((await daily()).parsed.cards).toHaveLength(5);
  });

  it('is rate-limited per IP', async () => {
    const ip = '10.200.0.1';
    for (let i = 0; i < GAME_RATE_LIMITS.read.perIp.limit; i++) expect((await GET(getReq('/api/daily', { ip }))).status).toBe(200);
    const res = await GET(getReq('/api/daily', { ip }));
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toMatch(/^\d+$/);
    expect((await errorOf(res)).code).toBe('rate_limited');
    expect((await GET(getReq('/api/daily', { ip: '10.200.0.2' }))).status).toBe(200);
  });
});

// ----- ?game=duel (DU3, #112) -------------------------------------------------------------------

const duelDaily = async (anonId: string | null = null, query = '?game=duel') => {
  const res = await GET(getReq(`/api/daily${query}`, { anonId }));
  expect(res.status).toBe(200);
  expect(res.headers.get('cache-control')).toBe('no-store');
  const raw = (await res.json()) as Record<string, unknown>;
  return { raw, parsed: DuelDailyResponseSchema.parse(raw) };
};

/** Plays a round straight into the store, as POST /api/daily/hint and /pick will: hint first, then the pick. */
async function play(store: Store, anonId: string, round: DuelRound, choice: DuelLetter, { hint = false } = {}) {
  const key = { date: TODAY, anonId };
  const pair = findDuelPair(TODAY, round)!;
  if (hint) await store.duel.openHint(key, round);
  return store.duel.submitPick(key, round, choice, duelScorer(pair, choice));
}

/** The answer must not reach the browser before a pick (#110's never-leak check, on the HTTP body). */
function expectNoAnswer(body: string) {
  for (const card of lifeCards) expect(body).not.toMatch(new RegExp(`(?<![\\w-])${card.id}(?![\\w-])`));
  expect(body).not.toMatch(/(?<!\d)\d{5}(?!\d)/); // a ZIP
  for (const tier of ['cheap', 'mid', 'expensive', 'suburb']) expect(body.toLowerCase()).not.toMatch(new RegExp(`\\b${tier}\\b`));
  for (const fact of Object.values(t.hintFacts)) expect(body).not.toContain(fact);
  const numbers = (body.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
  for (const card of lifeCards) {
    const total = costOfLife(card, getArea(card.zip)).total.mid;
    for (const n of [total, Math.round(total), Number(total.toFixed(2))]) expect(numbers).not.toContain(n);
  }
  const keys = new Set<string>();
  JSON.parse(body, (key, value) => (keys.add(key), value));
  for (const key of ['id', 'zip', 'tier', 'total', 'totals', 'amount', 'breakdown', 'cost', 'gap']) expect(keys).not.toContain(key);
}

describe('GET /api/daily?game=duel', () => {
  it('without a header answers today’s five duels and no progress, the same for everyone', async () => {
    const a = await duelDaily();
    expect(a.parsed.ok).toBe(true);
    expect(a.parsed.date).toBe(TODAY);
    expect(a.parsed.duels).toHaveLength(5);
    expect(a.parsed.duels.map((d) => d.round)).toEqual([1, 2, 3, 4, 5]);
    expect(a.parsed.duels).toEqual(publicDuels(TODAY));
    expect(Object.keys(a.raw).sort()).toEqual(['date', 'duels', 'ok']); // no `progress` key, not even null
    expect((await duelDaily(ANON)).parsed.duels).toEqual(a.parsed.duels);
    expect((await duelDaily(OTHER_ANON)).parsed.duels).toEqual(a.parsed.duels);
  });

  it('rolls over at US Eastern midnight, like the slider’s set', async () => {
    vi.setSystemTime(new Date('2026-11-15T04:59:59Z'));
    expect((await duelDaily()).parsed.date).toBe('2026-11-14');
    vi.setSystemTime(new Date('2026-11-15T05:00:00Z'));
    const next = (await duelDaily()).parsed;
    expect(next.date).toBe('2026-11-15');
    expect(next.duels).toEqual(publicDuels('2026-11-15'));
  });

  it('with a header and nothing played yet, answers an empty progress', async () => {
    const { parsed } = await duelDaily(ANON);
    expect(parsed.progress).toEqual({ resultId: null, picks: {}, hints: {} });
  });

  it('after two picks and a hint, answers the stored results and only the hint the server recorded', async () => {
    const store = getStore();
    const first = await play(store, ANON, 1, 'A', { hint: true });
    const second = await play(store, ANON, 2, 'B');
    expect(second.resultId).toBe(first.resultId);

    const { parsed, raw } = await duelDaily(ANON);
    const progress = parsed.progress!;
    expect(progress.resultId).toBe(first.resultId);
    expect(Object.keys(progress.picks)).toEqual(['1', '2']);
    // The result is the one scored at pick time (the hint halves round 1's points), with its resultId.
    const pair1 = findDuelPair(TODAY, 1)!;
    const pair2 = findDuelPair(TODAY, 2)!;
    expect(progress.picks['1']).toEqual({ choice: 'A', result: { ...duelScorer(pair1, 'A')(1), resultId: first.resultId, crowd: null } });
    expect(progress.picks['2']).toEqual({ choice: 'B', result: { ...duelScorer(pair2, 'B')(0), resultId: first.resultId, crowd: null } });
    // Only round 1 had a hint; its text is rebuilt from the day's pair, and round 2 has none.
    expect(progress.hints).toEqual({ '1': duelHint(pair1) });
    expect(Object.keys((raw.progress as { hints: object }).hints)).toEqual(['1']);

    // Another player, and tomorrow, start empty.
    expect((await duelDaily(OTHER_ANON)).parsed.progress).toEqual({ resultId: null, picks: {}, hints: {} });
    vi.setSystemTime(new Date('2026-11-15T17:00:00Z'));
    expect((await duelDaily(ANON)).parsed.progress).toEqual({ resultId: null, picks: {}, hints: {} });
  });

  it('carries each picked round’s live crowd: null below 20 picks, the stored counts from 20 on, the same as a pick reply', async () => {
    const store = getStore();
    const crowdAnon = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
    // Round 1: 19 other players (14 A, 5 B), round 2: 18 others, then ANON picks both.
    for (let i = 0; i < 19; i++) await play(store, crowdAnon(i), 1, i < 14 ? 'A' : 'B');
    for (let i = 0; i < 18; i++) await play(store, crowdAnon(100 + i), 2, 'B');
    await play(store, ANON, 1, 'B');
    await play(store, ANON, 2, 'A');

    const before = (await duelDaily(ANON)).parsed.progress!;
    expect(before.picks['1']!.result.crowd).toEqual({ pickedA: 14, total: 20 });
    expect(before.picks['2']!.result.crowd).toBeNull(); // 19 picks

    // One more pick of round 2 shows up on the next reply: the crowd is counted live, not stored.
    await play(store, crowdAnon(200), 2, 'A');
    const after = (await duelDaily(ANON)).parsed.progress!;
    expect(after.picks['1']!.result.crowd).toEqual({ pickedA: 14, total: 20 });
    expect(after.picks['2']!.result.crowd).toEqual({ pickedA: 2, total: 20 });
    // Everything else in the result is the stored score, unchanged.
    const { crowd: _a, ...scoredBefore } = before.picks['2']!.result;
    const { crowd: _b, ...scoredAfter } = after.picks['2']!.result;
    expect(scoredAfter).toEqual(scoredBefore);

    // A replayed pick answers the same crowd as the progress, at the same moment.
    const replay = await postPick(postReq('/api/daily/pick', { anonId: ANON, date: TODAY, round: 2, choice: 'B' }));
    expect(PickReplySchema.parse(await replay.json())).toMatchObject({ replayed: true, crowd: { pickedA: 2, total: 20 } });

    // A player who picked nothing gets no crowd at all: crowds only ride on stored picks.
    expect((await duelDaily(OTHER_ANON)).parsed.progress!.picks).toEqual({});
  });

  it('answers the hint of a round that was hinted but not picked yet, and no other', async () => {
    await getStore().duel.openHint({ date: TODAY, anonId: ANON }, 3);
    const { parsed } = await duelDaily(ANON);
    expect(parsed.progress).toEqual({ resultId: null, picks: {}, hints: { '3': duelHint(findDuelPair(TODAY, 3)!) } });
  });

  it('never leaks the answer in the HTTP response before a pick', async () => {
    expectNoAnswer(JSON.stringify((await duelDaily()).raw));
    expectNoAnswer(JSON.stringify((await duelDaily(ANON)).raw)); // empty progress
    // After a pick, only that round's progress carries its numbers; the duels list stays answer-free.
    await play(getStore(), ANON, 1, 'A');
    const { raw } = await duelDaily(ANON);
    expectNoAnswer(JSON.stringify(raw.duels));
    expect(JSON.stringify(raw.progress)).toContain('"totals"');
    // A hint only adds that round's tier words: still no ZIP, card id or total for rounds not picked.
    await getStore().duel.openHint({ date: TODAY, anonId: OTHER_ANON }, 4);
    const hinted = (await duelDaily(OTHER_ANON)).raw;
    expectNoAnswer(JSON.stringify(hinted.duels));
    expect(Object.keys((hinted.progress as { picks: object }).picks)).toEqual([]);
  });

  it('?game=slider and no parameter answer today’s slider reply, unchanged', async () => {
    const bare = await daily(ANON);
    const slider = (await GET(getReq('/api/daily?game=slider', { anonId: ANON })));
    expect(slider.status).toBe(200);
    const body = (await slider.json()) as Record<string, unknown>;
    expect(DailyResponseSchema.parse(body)).toEqual(bare.parsed);
    expect(body).toEqual(bare.raw);
    expect(Object.keys(body).sort()).toEqual(['cards', 'date', 'ok', 'progress']);
    expect(body.duels).toBeUndefined();
  });

  it('refuses an unknown game with 400 bad_request, before any store use', async () => {
    const spy = vi.spyOn(getStore().duel, 'playerDuelDay');
    for (const query of ['?game=nope', '?game=', '?game=DUEL', '?game=duel%20', '?game=slider,duel']) {
      const res = await GET(getReq(`/api/daily${query}`, { anonId: ANON }));
      expect(res.status, query).toBe(400);
      expect((await errorOf(res)).code).toBe('bad_request');
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it('refuses a malformed x-anon-id with 400', async () => {
    const res = await GET(getReq('/api/daily?game=duel', { anonId: 'not-a-uuid' }));
    expect(res.status).toBe(400);
    expect((await errorOf(res)).code).toBe('bad_request');
  });

  it('answers 503 when progress is asked for and the store is down, and 200 without a header (no store needed)', async () => {
    const down = getStore();
    const spy = vi.spyOn(down.duel, 'playerDuelDay').mockRejectedValue(new StoreUnavailableError('unreachable', 'down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await GET(getReq('/api/daily?game=duel', { anonId: ANON }));
    expect(res.status).toBe(503);
    expect(res.headers.get('retry-after')).toBe('5');
    expect(await errorOf(res)).toEqual({ code: 'unavailable', reason: 'unreachable' });
    expect(spy).toHaveBeenCalledTimes(1);
    expect((await duelDaily()).parsed.duels).toHaveLength(5);
    expect(spy).toHaveBeenCalledTimes(1); // the headerless reply never touched the store
  });

  it('shares the per-IP read limit with the slider reply', async () => {
    const ip = '10.200.0.9';
    for (let i = 0; i < GAME_RATE_LIMITS.read.perIp.limit; i++) {
      expect((await GET(getReq(i % 2 ? '/api/daily?game=duel' : '/api/daily', { ip }))).status).toBe(200);
    }
    const res = await GET(getReq('/api/daily?game=duel', { ip }));
    expect(res.status).toBe(429);
    expect((await errorOf(res)).code).toBe('rate_limited');
  });
});

// The duel progress on Postgres, where the crowd is a GROUP BY over everyone's stored picks.
describePostgres('GET /api/daily?game=duel on Postgres', () => {
  let store: Store;
  let cleanup: () => Promise<void>;
  beforeAll(() => {
    ({ store, cleanup } = testPostgresStore());
  });
  afterAll(async () => cleanup());
  beforeEach(() => setStoreForTests(store));

  it('carries the live crowd of each picked round from the stored rows', async () => {
    const crowdAnon = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
    for (let i = 0; i < 19; i++) await play(store, crowdAnon(i), 4, i < 9 ? 'A' : 'B');
    await play(store, ANON, 4, 'A');
    await play(store, ANON, 5, 'A');
    const progress = (await duelDaily(ANON)).parsed.progress!;
    expect(progress.picks['4']!.result.crowd).toEqual({ pickedA: 10, total: 20 });
    expect(progress.picks['5']!.result.crowd).toBeNull();
  });
});

