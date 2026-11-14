import { dailyCards, lifeCards } from '@lifeguessr/data/cards';
import { describe, expect, it, vi } from 'vitest';
import { ClueRevealSchema } from '@/lib/api/gameSchemas';
import { dayNumber } from '@/lib/dates';
import { clueReveal } from '@/server/game/daily';
import { GAME_RATE_LIMITS, MAX_GAME_BODY_BYTES } from '@/server/game/http';
import { ANON, errorOf, OTHER_ANON, postReq, setupGameTestEnv, TODAY } from '@/server/game/testUtils';
import { StoreUnavailableError, type Store } from '@/server/store';
import { POST } from './route';

const getStore = setupGameTestEnv();
const [CARD] = dailyCards(dayNumber(TODAY));
const clue = (body: Record<string, unknown>, opts?: Parameters<typeof postReq>[2]) =>
  POST(postReq('/api/daily/clue', { anonId: ANON, cardId: CARD!.id, ...body }, opts));

describe('POST /api/daily/clue', () => {
  it('records the clue for this player and card, then answers its ClueReveal', async () => {
    const res = await clue({ clue: 'garage' });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const reveal = ClueRevealSchema.parse(await res.json());
    expect(reveal).toEqual(clueReveal(CARD!, 'garage'));
    expect(reveal).toMatchObject({ cardId: CARD!.id, clue: 'garage' });

    await clue({ clue: 'kitchen' });
    await clue({ clue: 'garage' }); // again: counted once
    expect((await getStore().game.playerDay(TODAY, ANON)).clues).toEqual({ [CARD!.id]: ['garage', 'kitchen'] });
    expect((await getStore().game.playerDay(TODAY, OTHER_ANON)).clues).toEqual({});
  });

  it('accepts the set’s date, including yesterday’s just after midnight, and refuses a closed set (409 day_over)', async () => {
    expect((await clue({ clue: 'entry', date: TODAY })).status).toBe(200);

    vi.setSystemTime(new Date('2026-11-15T05:10:00Z')); // 12:10 AM Eastern on the 15th
    expect((await clue({ clue: 'mailbox', date: TODAY })).status).toBe(200);
    expect((await getStore().game.playerDay(TODAY, ANON)).clues[CARD!.id]).toEqual(['entry', 'mailbox']);

    vi.setSystemTime(new Date('2026-11-15T06:00:00Z')); // 1 AM: the grace period is over
    const res = await clue({ clue: 'kitchen', date: TODAY });
    expect(res.status).toBe(409);
    expect(await errorOf(res)).toMatchObject({ code: 'day_over', today: '2026-11-15' });
  });

  it('answers 404 not_in_set for a card outside the day’s set (another day’s, a pack’s, an unknown id)', async () => {
    const otherDay = dailyCards(dayNumber(TODAY) + 1)[0]!;
    const pack = lifeCards.find((c) => c.pack !== undefined)!;
    for (const cardId of [otherDay.id, pack.id, 'lc-999']) {
      const res = await clue({ cardId, clue: 'garage' });
      expect(res.status).toBe(404);
      expect((await errorOf(res)).code).toBe('not_in_set');
    }
    expect((await getStore().game.playerDay(TODAY, ANON)).clues).toEqual({});
  });

  it.each([
    ['an unknown clue', { clue: 'attic' }],
    ['a missing anonId', { anonId: undefined, clue: 'garage' }],
    ['an anonId that is not a UUID', { anonId: 'player-1', clue: 'garage' }],
    ['a bad date', { clue: 'garage', date: '11/14/2026' }],
    ['an unknown field', { clue: 'garage', cluesOpened: 0 }],
  ])('answers 400 for %s', async (_, body) => {
    const res = await POST(postReq('/api/daily/clue', { anonId: ANON, cardId: CARD!.id, ...body }, { anonId: null }));
    expect(res.status).toBe(400);
    expect((await errorOf(res)).code).toBe('bad_request');
  });

  it('answers 400 when x-anon-id and the body disagree, 413 for an oversized body', async () => {
    const mismatch = await clue({ clue: 'garage' }, { anonId: OTHER_ANON });
    expect(mismatch.status).toBe(400);
    const big = await POST(postReq('/api/daily/clue', `{"pad":"${'x'.repeat(MAX_GAME_BODY_BYTES)}"}`));
    expect(big.status).toBe(413);
    expect((await errorOf(big)).code).toBe('too_large');
  });

  it('is rate-limited per anonymous id and per IP', async () => {
    const { perAnonId, perIp } = GAME_RATE_LIMITS.clue;
    for (let i = 0; i < perAnonId.limit; i++) expect((await clue({ clue: 'garage' })).status).toBe(200);
    const limited = await clue({ clue: 'garage' });
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toMatch(/^\d+$/);
    expect(await errorOf(limited)).toMatchObject({ code: 'rate_limited', retryAfterSeconds: expect.any(Number) });

    const ip = '10.201.0.1';
    const ids = Array.from({ length: perIp.limit + 1 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
    const statuses = [];
    for (const anonId of ids) {
      statuses.push((await POST(postReq('/api/daily/clue', { anonId, cardId: CARD!.id, clue: 'garage' }, { anonId, ip }))).status);
    }
    expect(statuses.slice(0, -1).every((s) => s === 200)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
  });

  it('answers 503 unavailable when the store is down, and reveals nothing unrecorded', async () => {
    vi.spyOn(getStore().game as Store['game'], 'openClue').mockRejectedValue(new StoreUnavailableError('unreachable', 'down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await clue({ clue: 'garage' });
    expect(res.status).toBe(503);
    expect(await errorOf(res)).toEqual({ code: 'unavailable', reason: 'unreachable' });
  });
});
