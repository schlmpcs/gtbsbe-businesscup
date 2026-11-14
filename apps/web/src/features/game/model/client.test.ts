import { costOfLife, scoreGuess } from '@lifeguessr/engine';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getArea } from '@lifeguessr/data/areas';
import { dailyCards } from '@lifeguessr/data/cards';
import { cardById, cardsSample } from '@/fixtures/cards';
import { dayNumber } from '@/lib/dates';
import { ANON, setupGameTestEnv, TODAY } from '@/server/game/testUtils';
import { createRouteFetch } from '@/test/gameRoutes';
import { createGameClient, createHttpGameClient, lazyGameClient } from './client';
import { createFixtureGameClient, fixtureDailyCards } from './fixtureClient';

const DATE = '2026-11-14';
const ID = '11111111-2222-4333-8444-555555555555';

describe('fixture game client', () => {
  it('serves 5 public cards per day, deterministic by date, without answers', async () => {
    const client = createFixtureGameClient({ persist: false });
    const a = await client.daily(DATE);
    const b = await createFixtureGameClient({ persist: false }).daily(DATE);
    expect(a.date).toBe(DATE);
    expect(a.cards).toHaveLength(5);
    expect(a.cards.map((c) => c.id)).toEqual(b.cards.map((c) => c.id));
    expect(new Set(a.cards.map((c) => c.id)).size).toBe(5);
    // PublicCard only: no cost facts reach the browser before the guess.
    expect(Object.keys(a.cards[0]!).sort()).toEqual(['caption', 'decor', 'id', 'layout', 'metro']);
    expect(a.progress).toEqual({ clues: {}, guesses: {} });
    const next = fixtureDailyCards('2026-11-15');
    expect(next.map((c) => c.id)).not.toEqual(a.cards.map((c) => c.id));
  });

  it('scores with the engine, counting the clues it recorded', async () => {
    const client = createFixtureGameClient({ persist: false });
    const { cards } = await client.daily(DATE);
    const id = cards[0]!.id;
    const garage = await client.clue(id, 'garage');
    expect(garage).toMatchObject({ cardId: id, clue: 'garage' });
    await client.clue(id, 'kitchen');
    await client.clue(id, 'kitchen'); // the same clue twice counts once

    const played = await client.guess(id, 3000);
    const card = cardById(id);
    const cost = costOfLife(card, getArea(card.zip));
    expect(played.guess).toBe(3000);
    expect(played.reveal.cost).toEqual(cost);
    expect(played.reveal.result).toEqual(scoreGuess(3000, cost, 2));
    expect(played.reveal.cluesOpened).toEqual(['garage', 'kitchen']);
    expect(played.reveal.card.id).toBe(id);

    // One guess per card: a second guess returns the first result and the amount it scored.
    expect(await client.guess(id, 9000)).toEqual(played);

    // The day's progress comes back with the next daily() (a reload).
    const { progress } = await client.daily(DATE);
    expect(progress!.clues[id]).toEqual([garage, await client.clue(id, 'kitchen')]);
    expect(progress!.guesses[id]).toEqual(played);
  });

  it('rejects cards outside today’s set', async () => {
    const client = createFixtureGameClient({ persist: false });
    const { cards } = await client.daily(DATE);
    const outside = cardsSample.find((c) => !cards.some((x) => x.id === c.id))!;
    await expect(client.guess(outside.id, 3000)).rejects.toMatchObject({ status: 404 });
  });
});

describe('http game client', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('calls the T5 routes with the anon id in a header, never the URL, and validates responses', async () => {
    const fixture = createFixtureGameClient({ persist: false });
    const { cards } = await fixture.daily(DATE);
    const { reveal } = await fixture.guess(cards[0]!.id, 3000);
    const fetchMock = vi.fn(async (url: string) => {
      const body = url.endsWith('/api/daily') ? { date: DATE, cards } : { ...reveal, guess: 3000, replayed: false };
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = createHttpGameClient({ anonId: () => ID });
    const set = await client.daily('2026-11-13');
    expect(set).toEqual({ date: DATE, cards, progress: null }); // the server's date wins
    expect(await client.guess(cards[0]!.id, 3000)).toEqual({ guess: 3000, reveal });

    for (const [url, init] of fetchMock.mock.calls as unknown as [string, RequestInit][]) {
      expect(url).not.toContain('11111111');
      expect(new Headers(init.headers).get('x-anon-id')).toBe(ID);
    }
    const guessInit = (fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1];
    // The set's date from daily() goes with the guess; no clue count, no score.
    expect(JSON.parse(guessInit.body as string)).toEqual({ anonId: ID, cardId: cards[0]!.id, guess: 3000, date: DATE });
  });

  it('sends the date it is given over the one from daily()', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ cardId: 'lc-001', clue: 'garage', props: [], facts: {} }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await createHttpGameClient({ anonId: () => ID }).clue('lc-001', 'garage', '2026-11-13');
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(JSON.parse(init.body as string)).toEqual({ anonId: ID, cardId: 'lc-001', clue: 'garage', date: '2026-11-13' });
  });

  it('maps a missing route to an ApiError with its status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not found', { status: 404 })));
    await expect(createHttpGameClient({ anonId: () => 'x' }).daily(DATE)).rejects.toMatchObject({ status: 404 });
  });

  it('is what createGameClient builds for NEXT_PUBLIC_GAME_SOURCE=api', () => {
    expect(createGameClient('api').source).toBe('api');
    expect(createGameClient('fixtures').source).toBe('fixtures');
  });
});

describe('createGameClient source selection', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('loads the fixture game on first use and plays the same set', async () => {
    const lazy = createGameClient('fixtures');
    const set = await lazy.daily(DATE);
    expect(set.cards.map((c) => c.id)).toEqual(fixtureDailyCards(DATE).map((c) => c.id));
    const { reveal } = await lazy.guess(set.cards[0]!.id, 3000);
    expect(reveal.card.id).toBe(set.cards[0]!.id);
  });

  it('has no fixture game in an API build (NEXT_PUBLIC_GAME_SOURCE=api at build time)', async () => {
    vi.stubEnv('NEXT_PUBLIC_GAME_SOURCE', 'api');
    vi.resetModules();
    const fresh = await import('./client');
    expect(fresh.createGameClient().source).toBe('api');
    expect(() => fresh.createGameClient('fixtures')).toThrow(/NEXT_PUBLIC_GAME_SOURCE=api/);
  });

  it('retries a failed load (a chunk error) on the next call', async () => {
    const real = createFixtureGameClient({ persist: false });
    const load = vi.fn<() => Promise<typeof real>>()
      .mockRejectedValueOnce(new Error('ChunkLoadError'))
      .mockResolvedValue(real);
    const lazy = lazyGameClient('fixtures', load);
    await expect(lazy.daily(DATE)).rejects.toThrow('ChunkLoadError');
    expect((await lazy.daily(DATE)).cards).toHaveLength(5);
    await lazy.clue((await lazy.daily(DATE)).cards[0]!.id, 'garage');
    expect(load).toHaveBeenCalledTimes(2); // loaded once after the failure, then reused
  });
});

describe('http game client against the real routes (API mode end to end)', () => {
  setupGameTestEnv();
  afterEach(() => vi.unstubAllGlobals());

  it('plays a home: the server records the clues and scores the guess; a reload gets the progress back', async () => {
    const routes = createRouteFetch();
    vi.stubGlobal('fetch', routes.fetch);
    const client = createHttpGameClient({ anonId: () => ANON });

    const set = await client.daily(TODAY);
    expect(set.date).toBe(TODAY);
    expect(set.cards.map((c) => c.id)).toEqual(dailyCards(dayNumber(TODAY)).map((c) => c.id));
    expect(set.progress).toEqual({ clues: {}, guesses: {} });

    const card = dailyCards(dayNumber(TODAY))[1]!;
    const kitchen = await client.clue(card.id, 'kitchen');
    expect(kitchen).toMatchObject({ cardId: card.id, clue: 'kitchen' });
    await client.clue(card.id, 'entry');

    const played = await client.guess(card.id, 4_100);
    const cost = costOfLife(card, getArea(card.zip));
    expect(played.guess).toBe(4_100);
    expect(played.reveal.result).toEqual(scoreGuess(4_100, cost, 2));
    expect(played.reveal.cluesOpened).toEqual(['kitchen', 'entry']);
    expect(played.reveal.card).toEqual(card); // the answer arrives only with the reveal

    // A repeat (another tab, a lost response) answers the stored result, not a new score.
    expect(await client.guess(card.id, 12_000)).toEqual(played);

    // A browser that lost its state reloads and gets what the server will count.
    const reload = await createHttpGameClient({ anonId: () => ANON }).daily(TODAY);
    expect(reload.progress!.clues[card.id]!.map((c) => c.clue)).toEqual(['kitchen', 'entry']);
    expect(reload.progress!.guesses[card.id]).toEqual(played);

    // Nothing but the anon header and the documented fields went over the wire.
    for (const call of routes.calls) expect(call.anonId).toBe(ANON);
    const guessBodies = routes.calls.filter((c) => c.path === '/api/daily/guess').map((c) => c.body);
    expect(guessBodies).toEqual([
      { anonId: ANON, cardId: card.id, guess: 4_100, date: TODAY },
      { anonId: ANON, cardId: card.id, guess: 12_000, date: TODAY },
    ]);
  });
});
