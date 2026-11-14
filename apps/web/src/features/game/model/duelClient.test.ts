// The duel's data sources: which one a build plays (NEXT_PUBLIC_DUEL_SOURCE, separate from
// NEXT_PUBLIC_GAME_SOURCE), the HTTP client on a mocked fetch, and the HTTP client against the real
// duel routes in-process (memory store).
import { DUEL_ROUNDS, type PickResult, type PublicDuel } from '@lifeguessr/types';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { DuelDailyResponse } from '@/lib/api/gameSchemas';
import { ApiError } from '@/lib/api/http';
import { toVMError } from '@/lib/model/errors';
import { duelScorer, duelSet, publicDuels } from '@/server/game/duel';
import { ANON, OTHER_ANON, setupGameTestEnv, TODAY } from '@/server/game/testUtils';
import { createRouteFetch } from '@/test/gameRoutes';
import { createDuelClient, createHttpDuelClient, duelProgressFromWire, lazyDuelClient } from './duelClient';
import { createFixtureDuelClient } from './duelFixtureClient';

const DATE = '2026-11-14';
const ID = '11111111-2222-4333-8444-555555555555';
const RESULT_ID = '0123456789abcdef0123456789abcdef';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

/** duelClient as a build with these NEXT_PUBLIC_* values would have it (Next inlines them). */
async function build(env: Record<string, string>) {
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  vi.resetModules();
  return import('./duelClient');
}

describe('createDuelClient source selection', () => {
  it('plays the duel in the browser by default', async () => {
    const { createDuelClient } = await build({});
    const client = createDuelClient();
    expect(client.source).toBe('fixtures');
    expect((await client.daily(DATE)).duels).toHaveLength(5);
  });

  it('still plays the duel in the browser in an API game build (NEXT_PUBLIC_GAME_SOURCE=api, production until #120)', async () => {
    const { createDuelClient } = await build({ NEXT_PUBLIC_GAME_SOURCE: 'api' });
    const client = createDuelClient();
    expect(client.source).toBe('fixtures');
    expect((await client.daily(DATE)).duels).toHaveLength(5);
  });

  it('plays against the server with NEXT_PUBLIC_DUEL_SOURCE=api, and has no fixture duel', async () => {
    const { createDuelClient } = await build({ NEXT_PUBLIC_DUEL_SOURCE: 'api' });
    const fetchMock = vi.fn(async () => json(await dailyBody()));
    vi.stubGlobal('fetch', fetchMock);
    const client = createDuelClient();
    expect(client.source).toBe('api');
    expect((await client.daily(DATE)).duels).toHaveLength(5);
    expect(callsOf(fetchMock)[0]![0]).toBe('/api/daily?game=duel');
    expect(() => createDuelClient('fixtures')).toThrow(/NEXT_PUBLIC_DUEL_SOURCE=api/);
  });

  it('createDuelClient("api") is the HTTP client in any build', () => {
    expect(createDuelClient('api').source).toBe('api');
  });
});

// ----- the HTTP client on a mocked fetch ----------------------------------------------------------

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

/** A day as the fixture duel plays it: five public duels and two scored rounds (2 with a hint). */
let fixtureDay: { duels: PublicDuel[]; r1: PickResult; r2: PickResult; hint2: { A: string; B: string } };
beforeAll(async () => {
  const fixture = createFixtureDuelClient({ persist: false });
  const { duels } = await fixture.daily(DATE);
  const r1 = await fixture.pick(1, 'A', DATE);
  const hint2 = await fixture.hint(2, DATE);
  const r2 = await fixture.pick(2, 'B', DATE);
  fixtureDay = { duels, r1, r2, hint2 };
});

async function dailyBody(withProgress = false): Promise<DuelDailyResponse> {
  const { duels, r1, r2, hint2 } = fixtureDay;
  return {
    ok: true,
    date: DATE,
    duels,
    ...(withProgress
      ? {
          progress: {
            resultId: RESULT_ID,
            picks: { '1': { choice: 'A', result: r1 }, '2': { choice: 'B', result: r2 } },
            hints: { '2': hint2 },
          },
        }
      : {}),
  };
}

/** The [url, init] of each fetch call. */
const callsOf = (mock: ReturnType<typeof vi.fn>) => mock.mock.calls as unknown as [string, RequestInit][];

describe('http duel client', () => {
  it('daily: GET /api/daily?game=duel with the anon id in a header; the server’s date wins; no progress = a fresh day', async () => {
    const fetchMock = vi.fn(async () => json({ ...(await dailyBody()), date: '2026-11-15' }));
    vi.stubGlobal('fetch', fetchMock);
    const day = await createHttpDuelClient({ anonId: () => ID }).daily('2026-11-14');
    expect(day).toEqual({ date: '2026-11-15', duels: fixtureDay.duels, progress: { picks: {}, hints: {} } });
    const [url, init] = callsOf(fetchMock)[0]!;
    expect(url).toBe('/api/daily?game=duel');
    expect(url).not.toContain(ID.slice(0, 8));
    expect(init.method).toBe('GET');
    expect(new Headers(init.headers).get('x-anon-id')).toBe(ID);
  });

  it('daily with progress: string round keys become numbers, picks and hints exactly as the fixture client returns them', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(await dailyBody(true))));
    const { progress } = await createHttpDuelClient({ anonId: () => ID, base: 'https://x.test' }).daily(DATE);
    expect(progress).toEqual({
      picks: { 1: { choice: 'A', result: fixtureDay.r1 }, 2: { choice: 'B', result: fixtureDay.r2 } },
      hints: { 2: fixtureDay.hint2 },
    });
    expect(Object.keys(progress.picks)).toEqual(['1', '2']);
    expect(progress.picks[1]!.choice).toBe('A');
    expect(progress.hints[1]).toBeUndefined();

    // The same shape the fixture client resumes from its log.
    const fixture = createFixtureDuelClient({ persist: false });
    await fixture.daily(DATE);
    await fixture.pick(1, 'A', DATE);
    await fixture.hint(2, DATE);
    await fixture.pick(2, 'B', DATE);
    const resumed = (await fixture.daily(DATE)).progress;
    expect(Object.keys(resumed.picks)).toEqual(Object.keys(progress.picks));
    expect(Object.keys(resumed.hints)).toEqual(Object.keys(progress.hints));
    expect(resumed.hints[2]).toEqual(progress.hints[2]);
  });

  it('duelProgressFromWire ignores nothing it should keep and invents nothing', () => {
    expect(duelProgressFromWire(undefined)).toEqual({ picks: {}, hints: {} });
    expect(duelProgressFromWire({ resultId: null, picks: {}, hints: {} })).toEqual({ picks: {}, hints: {} });
    const p = duelProgressFromWire({ resultId: RESULT_ID, picks: { '5': { choice: 'B', result: fixtureDay.r1 } }, hints: { '3': { A: 'a', B: 'b' } } });
    expect(p).toEqual({ picks: { 5: { choice: 'B', result: fixtureDay.r1 } }, hints: { 3: { A: 'a', B: 'b' } } });
  });

  it('pick: POST /api/daily/pick with { anonId, date, round, choice } only, and returns the PickResult without `replayed`', async () => {
    const fetchMock = vi.fn(async () => json({ ...fixtureDay.r1, replayed: false }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await createHttpDuelClient({ anonId: () => ID }).pick(1, 'A', DATE);
    expect(result).toEqual(fixtureDay.r1);
    expect(result).not.toHaveProperty('replayed');
    const [url, init] = callsOf(fetchMock)[0]!;
    expect(url).toBe('/api/daily/pick');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('x-anon-id')).toBe(ID);
    // No score, no hint count, no total: the server scores with what it recorded.
    expect(JSON.parse(init.body as string)).toEqual({ anonId: ID, date: DATE, round: 1, choice: 'A' });
  });

  it('a replayed pick answers the stored result like a fresh one', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ ...fixtureDay.r1, replayed: true })));
    expect(await createHttpDuelClient({ anonId: () => ID }).pick(1, 'B', DATE)).toEqual(fixtureDay.r1);
  });

  it('hint: POST /api/daily/hint with { anonId, date, round }, returns the DuelHint without `recorded`', async () => {
    const fetchMock = vi.fn(async () => json({ ...fixtureDay.hint2, recorded: true }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await createHttpDuelClient({ anonId: () => ID }).hint(2, DATE)).toEqual(fixtureDay.hint2);
    const [url, init] = callsOf(fetchMock)[0]!;
    expect(url).toBe('/api/daily/hint');
    expect(JSON.parse(init.body as string)).toEqual({ anonId: ID, date: DATE, round: 2 });
  });

  it('409 day_over keeps its code (useDuel loads the new day)', async () => {
    const body = { ok: false, error: { code: 'day_over', today: '2026-11-15', issues: ['the set of 2026-11-14 has ended'] } };
    vi.stubGlobal('fetch', vi.fn(async () => json(body, 409)));
    const client = createHttpDuelClient({ anonId: () => ID });
    for (const call of [() => client.pick(3, 'A', DATE), () => client.hint(3, DATE)]) {
      const err = await call().catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ApiError);
      expect(err).toMatchObject({ status: 409, code: 'day_over', invalid: false });
    }
  });

  it('429 and 503 become ApiErrors the screen shows as "rate limited" and "unavailable"', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ ok: false, error: { code: 'rate_limited' } }, 429, { 'retry-after': '30' })));
    const limited = await createHttpDuelClient({ anonId: () => ID }).pick(1, 'A', DATE).catch((e: unknown) => e);
    expect(limited).toMatchObject({ status: 429, code: 'rate_limited' });
    expect(toVMError(limited)).toEqual({ kind: 'rateLimited' });

    vi.stubGlobal('fetch', vi.fn(async () => json({ ok: false, error: { code: 'unavailable' } }, 503)));
    const down = await createHttpDuelClient({ anonId: () => ID }).daily(DATE).catch((e: unknown) => e);
    expect(down).toMatchObject({ status: 503, code: 'unavailable' });
    expect(toVMError(down)).toEqual({ kind: 'unavailable' });

    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    expect(toVMError(await createHttpDuelClient({ anonId: () => ID }).hint(1, DATE).catch((e: unknown) => e))).toEqual({ kind: 'network', status: undefined });
  });

  it('rejects a reply that breaks the contract instead of trusting it', async () => {
    const client = createHttpDuelClient({ anonId: () => ID });
    const cases: [() => Promise<unknown>, unknown][] = [
      [() => client.daily(DATE), { ...(await dailyBody()), duels: fixtureDay.duels.slice(0, 4) }], // not five duels
      [() => client.daily(DATE), { ...(await dailyBody(true)), progress: { resultId: 'not-hex', picks: {}, hints: {} } }],
      [() => client.daily(DATE), { duels: fixtureDay.duels, date: DATE }], // no ok: true
      [() => client.pick(1, 'A', DATE), { ...fixtureDay.r1 }], // no `replayed`
      [() => client.pick(1, 'A', DATE), { ...fixtureDay.r1, points: -1000, replayed: false }],
      [() => client.hint(1, DATE), { A: 'Pricey area', recorded: true }], // no B
    ];
    for (const [call, body] of cases) {
      vi.stubGlobal('fetch', vi.fn(async () => json(body)));
      const err = await call().catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ApiError);
      expect(err).toMatchObject({ invalid: true });
      expect(toVMError(err)).toEqual({ kind: 'invalidResponse' });
    }
  });

  it('drops anything the contract does not name (no answer rides along on a public card)', async () => {
    const leaky = await dailyBody();
    const duels = leaky.duels.map((d) => ({ ...d, total: 9999, cards: d.cards.map((c) => ({ ...c, zip: '10001' })) }));
    vi.stubGlobal('fetch', vi.fn(async () => json({ ...leaky, duels })));
    const day = await createHttpDuelClient({ anonId: () => ID }).daily(DATE);
    expect(JSON.stringify(day)).not.toContain('10001');
    expect(JSON.stringify(day)).not.toContain('9999');
  });
});

// ----- the HTTP client against the real routes (in-process, memory store) -------------------------

describe('http duel client against the real duel routes (API mode end to end)', () => {
  setupGameTestEnv();

  it('plays a day: hint, picks scored once, and a reload gets the same progress back', async () => {
    const routes = createRouteFetch();
    vi.stubGlobal('fetch', routes.fetch);
    const client = createHttpDuelClient({ anonId: () => ANON });

    const day = await client.daily('2026-11-13'); // a stale client clock: the server's date wins
    expect(day.date).toBe(TODAY);
    expect(day.duels).toEqual(publicDuels(TODAY));
    expect(day.progress).toEqual({ picks: {}, hints: {} });

    const hint = await client.hint(1, day.date);
    expect(hint.A).toBeTruthy();
    expect(hint.B).toBeTruthy();
    const pair = duelSet(TODAY)[0]!;
    const costlier = duelScorer(pair, 'A')(0).correct ? 'A' : 'B';
    const first = await client.pick(1, costlier, day.date);
    expect(first).toMatchObject({ correct: true, points: 900 }); // −10% for the hint
    // A repeat with the other letter answers the stored result (no second score).
    expect(await client.pick(1, costlier === 'A' ? 'B' : 'A', day.date)).toEqual(first);
    const second = await client.pick(2, 'A', day.date);

    // A browser that lost its state reloads and gets what the server will count.
    const reload = await createHttpDuelClient({ anonId: () => ANON }).daily(TODAY);
    expect(reload.progress).toEqual({
      picks: { 1: { choice: costlier, result: first }, 2: { choice: 'A', result: second } },
      hints: { 1: hint },
    });

    // Only the documented fields went over the wire, with the anon header on every call.
    for (const call of routes.calls) expect(call.anonId).toBe(ANON);
    expect(routes.calls.filter((c) => c.path === '/api/daily/pick').map((c) => c.body)).toEqual([
      { anonId: ANON, date: TODAY, round: 1, choice: costlier },
      { anonId: ANON, date: TODAY, round: 1, choice: costlier === 'A' ? 'B' : 'A' },
      { anonId: ANON, date: TODAY, round: 2, choice: 'A' },
    ]);
    expect(DUEL_ROUNDS).toHaveLength(day.duels.length);
  });

  it('a pick for a day that has ended answers 409 day_over', async () => {
    vi.stubGlobal('fetch', createRouteFetch().fetch);
    const err = await createHttpDuelClient({ anonId: () => ANON }).pick(1, 'A', '2026-11-10').catch((e: unknown) => e);
    expect(err).toMatchObject({ status: 409, code: 'day_over' });
  });
});

// ----- challenge: the score behind a challenge link --------------------------------------------------

/** A finished day as GET /api/daily/challenge answers it. */
const challengeBody = (over: Record<string, unknown> = {}) => ({
  ok: true, date: DATE, rounds: 5, played: 5, right: 4, points: 3_900,
  tiles: ['yellow', 'green', 'green', 'green', 'ink'], today: true, ...over,
});

describe('http duel client: challenge', () => {
  it('GET /api/daily/challenge?c=<id>, with no anonymous id, answers the score without `ok`', async () => {
    const fetchMock = vi.fn(async () => json(challengeBody()));
    vi.stubGlobal('fetch', fetchMock);
    const challenge = await createHttpDuelClient({ anonId: () => ID }).challenge(RESULT_ID, DATE);
    expect(challenge).toEqual({
      date: DATE, rounds: 5, played: 5, right: 4, points: 3_900, tiles: ['yellow', 'green', 'green', 'green', 'ink'], today: true,
    });
    expect(challenge).not.toHaveProperty('ok');
    const [url, init] = callsOf(fetchMock)[0]!;
    expect(url).toBe(`/api/daily/challenge?c=${RESULT_ID}`);
    expect(init.method).toBe('GET');
    // Whoever asks, the route needs no id: the player's key never goes with a challenge read.
    expect(new Headers(init.headers).get('x-anon-id')).toBeNull();
  });

  it('is null for a 404 (an id nobody holds), and asks nothing for an id that cannot be a stored result', async () => {
    const fetchMock = vi.fn(async () => json({ ok: false, error: { code: 'not_found' } }, 404));
    vi.stubGlobal('fetch', fetchMock);
    const client = createHttpDuelClient({ anonId: () => ID });
    expect(await client.challenge(RESULT_ID, DATE)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    for (const id of ['fixture-duel-2026-11-14-0a1b2c3d', 'abc', RESULT_ID.toUpperCase(), `${RESULT_ID}0`, '']) {
      expect(await client.challenge(id, DATE)).toBeNull();
    }
    expect(fetchMock).toHaveBeenCalledTimes(1); // none of those went to the server
  });

  it('rejects when the server cannot answer, so the screen can tell "unknown" from "failed"', async () => {
    const client = createHttpDuelClient({ anonId: () => ID });
    vi.stubGlobal('fetch', vi.fn(async () => json({ ok: false, error: { code: 'unavailable' } }, 503)));
    const down = await client.challenge(RESULT_ID, DATE).catch((e: unknown) => e);
    expect(down).toMatchObject({ status: 503, code: 'unavailable' });
    expect(toVMError(down)).toEqual({ kind: 'unavailable' });

    vi.stubGlobal('fetch', vi.fn(async () => json({ ok: false, error: { code: 'rate_limited' } }, 429)));
    expect(toVMError(await client.challenge(RESULT_ID, DATE).catch((e: unknown) => e))).toEqual({ kind: 'rateLimited' });

    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    expect(toVMError(await client.challenge(RESULT_ID, DATE).catch((e: unknown) => e))).toEqual({ kind: 'network', status: undefined });
  });

  it('rejects a reply that breaks the contract instead of trusting it', async () => {
    const client = createHttpDuelClient({ anonId: () => ID });
    const bad = [
      { ...challengeBody(), ok: undefined },
      challengeBody({ rounds: 4 }),
      challengeBody({ right: 6 }),
      challengeBody({ points: -1 }),
      challengeBody({ played: 3 }), // five tiles for three rounds
      challengeBody({ tiles: ['green', 'green', 'green', 'green', 'red'] }),
      challengeBody({ right: 5, played: 4, tiles: ['green', 'green', 'green', 'green'] }),
      challengeBody({ today: 'yes' }),
      challengeBody({ date: 'yesterday' }),
    ];
    for (const body of bad) {
      vi.stubGlobal('fetch', vi.fn(async () => json(body)));
      const err = await client.challenge(RESULT_ID, DATE).catch((e: unknown) => e);
      expect(err, JSON.stringify(body)).toMatchObject({ invalid: true });
    }
  });

  it('drops anything the contract does not name, an anonymous key included', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ ...challengeBody(), anonId: ID, picks: [{ choice: 'A' }], totals: { A: 1, B: 2 } })));
    const challenge = await createHttpDuelClient({ anonId: () => ID }).challenge(RESULT_ID, DATE);
    expect(JSON.stringify(challenge)).not.toMatch(new RegExp(`${ID}|choice|totals|picks`));
  });

  it('the lazy client hands the question to the client it loads', async () => {
    const inner = createFixtureDuelClient({ persist: false });
    await inner.daily(DATE);
    const lazy = lazyDuelClient('fixtures', async () => inner);
    expect(await lazy.challenge('fixture-duel-nobody', DATE)).toBeNull();
  });
});

describe('fixture duel client: challenge', () => {
  /** Plays `picks` (letters by round) on a client, a hint first on `hinted` rounds. */
  async function playOn(client: ReturnType<typeof createFixtureDuelClient>, letters: ('A' | 'B')[], hinted: number[] = []) {
    const { progress } = await client.daily(DATE);
    expect(progress.picks).toEqual({});
    const results: PickResult[] = [];
    for (const [i, letter] of letters.entries()) {
      const round = (i + 1) as 1 | 2 | 3 | 4 | 5;
      if (hinted.includes(round)) await client.hint(round, DATE);
      results.push(await client.pick(round, letter, DATE));
    }
    return results;
  }

  it('answers its own stored day with the score the day result shows, and today only for that day', async () => {
    const client = createFixtureDuelClient({ persist: false });
    const results = await playOn(client, ['A', 'A', 'A', 'A', 'A'], [1]);
    const resultId = results[0]!.resultId;
    expect(new Set(results.map((r) => r.resultId)).size).toBe(1);

    const challenge = (await client.challenge(resultId, DATE))!;
    expect(challenge).toMatchObject({
      date: DATE,
      rounds: 5,
      played: 5,
      right: results.filter((r) => r.correct).length,
      points: results.reduce((sum, r) => sum + r.points, 0),
      today: true,
    });
    expect(challenge.tiles).toEqual(results.map((r) => (!r.correct ? 'ink' : r.points < 1000 ? 'yellow' : 'green')));
    // The client's New York date moved on: same day, but not today any more.
    expect(await client.challenge(resultId, '2026-11-15')).toMatchObject({ date: DATE, today: false, right: challenge.right });
  });

  it('knows no other day: an id it did not issue is not found', async () => {
    const client = createFixtureDuelClient({ persist: false });
    const [first] = await playOn(client, ['A', 'B']);
    expect(await client.challenge('fixture-duel-2026-11-14-ffffffff', DATE)).toBeNull();
    expect(await client.challenge('0123456789abcdef0123456789abcdef', DATE)).toBeNull();
    expect(await client.challenge('', DATE)).toBeNull();
    // A day still being played answers what is played so far.
    expect(await client.challenge(first!.resultId, DATE)).toMatchObject({ played: 2, tiles: expect.any(Array) });
  });
});

describe('http duel client against the real challenge route', () => {
  setupGameTestEnv();

  it('a friend’s day, read by a stranger with their own id: the same score and tiles, and the stranger’s day is untouched', async () => {
    const routes = createRouteFetch();
    vi.stubGlobal('fetch', routes.fetch);
    const friend = createHttpDuelClient({ anonId: () => ANON });
    const stranger = createHttpDuelClient({ anonId: () => OTHER_ANON });
    await friend.daily(DATE);
    const costlier = duelSet(TODAY).map((pair) => (duelScorer(pair, 'A')(0).correct ? 'A' : 'B') as 'A' | 'B');
    const results: PickResult[] = [];
    for (const [i, round] of DUEL_ROUNDS.entries()) {
      if (i === 0) await friend.hint(round, TODAY);
      results.push(await friend.pick(round, i < 4 ? costlier[i]! : costlier[i] === 'A' ? 'B' : 'A', TODAY));
    }

    const challenge = await stranger.challenge(results[0]!.resultId, TODAY);
    expect(challenge).toEqual({
      date: TODAY, rounds: 5, played: 5, right: 4, points: 900 + 3_000, tiles: ['yellow', 'green', 'green', 'green', 'ink'], today: true,
    });
    expect(await stranger.challenge('0'.repeat(32), TODAY)).toBeNull();
    expect((await stranger.daily(TODAY)).progress).toEqual({ picks: {}, hints: {} });
    // Neither challenge read carried an anonymous id.
    expect(routes.calls.filter((c) => c.path === '/api/daily/challenge').map((c) => c.anonId)).toEqual([null, null]);
  });
});
