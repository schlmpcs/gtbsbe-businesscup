import { dailyCards } from '@lifeguessr/data/cards';
import { describe, expect, it, vi } from 'vitest';
import { DailyResponseSchema } from '@/lib/api/gameSchemas';
import { dayNumber } from '@/lib/dates';
import { clueReveal } from '@/server/game/daily';
import { GAME_RATE_LIMITS } from '@/server/game/http';
import { ANON, errorOf, getReq, OTHER_ANON, postReq, setupGameTestEnv, TODAY } from '@/server/game/testUtils';
import { StoreUnavailableError, type Store } from '@/server/store';
import { POST as postClue } from './clue/route';
import { POST as postGuess } from './guess/route';
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
