import { costOfLife, scoreGuess } from '@lifeguessr/engine';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { areaByZip, cardById, cardsSample } from '@/fixtures';
import { createFixtureGameClient, createHttpGameClient, fixtureDailyCards } from './client';

const DATE = '2026-11-14';

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

    const reveal = await client.guess(id, 3000);
    const card = cardById(id);
    const cost = costOfLife(card, areaByZip(card.zip));
    expect(reveal.cost).toEqual(cost);
    expect(reveal.result).toEqual(scoreGuess(3000, cost, 2));
    expect(reveal.cluesOpened).toEqual(['garage', 'kitchen']);
    expect(reveal.card.id).toBe(id);

    // One guess per card: a second guess returns the first result.
    expect(await client.guess(id, 9000)).toEqual(reveal);
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
    const reveal = await fixture.guess(cards[0]!.id, 3000);
    const fetchMock = vi.fn(async (url: string) => {
      const body = url.endsWith('/api/daily') ? { date: DATE, cards } : reveal;
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = createHttpGameClient({ anonId: () => '11111111-2222-4333-8444-555555555555' });
    expect((await client.daily(DATE)).cards).toEqual(cards);
    expect((await client.guess(cards[0]!.id, 3000)).resultId).toBe(reveal.resultId);

    for (const [url, init] of fetchMock.mock.calls as unknown as [string, RequestInit][]) {
      expect(url).not.toContain('11111111');
      expect(new Headers(init.headers).get('x-anon-id')).toBe('11111111-2222-4333-8444-555555555555');
    }
    const guessInit = (fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1];
    expect(JSON.parse(guessInit.body as string)).toEqual({
      anonId: '11111111-2222-4333-8444-555555555555', cardId: cards[0]!.id, guess: 3000,
    });
  });

  it('maps a missing route to an ApiError with its status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not found', { status: 404 })));
    await expect(createHttpGameClient({ anonId: () => 'x' }).daily(DATE)).rejects.toMatchObject({ status: 404 });
  });
});
