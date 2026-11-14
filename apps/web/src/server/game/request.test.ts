import { DuelPickRequestSchema } from '@lifeguessr/types';
import { describe, expect, it, vi } from 'vitest';
import type { RateLimitRule } from '../rateLimit';
import { findDuelPair } from './duel';
import { readDuelRequest } from './request';
import { ANON, errorOf, OTHER_ANON, postReq, setupGameTestEnv, TODAY } from './testUtils';

// findDuelPair is real except where a test makes it answer null (a round the set does not have).
vi.mock('./duel', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown> & { findDuelPair: typeof findDuelPair }>();
  return { ...actual, findDuelPair: vi.fn(actual.findDuelPair) };
});

setupGameTestEnv();
const perMinute = (limit: number): RateLimitRule => ({ limit, windowMs: 60_000 });
const LIMITS = { perAnonId: perMinute(2), perIp: perMinute(3) };
const pick = { anonId: ANON, date: TODAY, round: 2, choice: 'B' };
const read = (body: unknown, opts?: Parameters<typeof postReq>[2], limits = LIMITS) =>
  readDuelRequest(postReq('/api/daily/test', body, opts), DuelPickRequestSchema, limits, 'test');

describe('readDuelRequest', () => {
  it('answers the parsed body (typed by the route’s schema), the resolved date and the round’s pair', async () => {
    const result = await read(pick);
    if ('response' in result) throw new Error('expected a request');
    expect(result.body).toEqual(pick);
    expect(result.body.choice).toBe('B');
    expect(result.date).toBe(TODAY);
    expect(result.pair).toBe(findDuelPair(TODAY, 2));
    expect(result.pair.round).toBe(2);
  });

  it('checks the per-IP limit before it reads the body: a flood of junk is refused without parsing', async () => {
    const ip = '10.77.0.1';
    const limits = { perAnonId: perMinute(99), perIp: perMinute(1) };
    expect('response' in (await read(pick, { ip }, limits))).toBe(false);
    const junk = await read('not json', { ip }, limits);
    if (!('response' in junk)) throw new Error('expected a response');
    expect(junk.response.status).toBe(429); // not 400: the body was never read
  });

  it('answers 400 for a header that is not a UUID, and for a header and body that disagree', async () => {
    for (const anonId of ['nope', OTHER_ANON]) {
      const result = await read(pick, { anonId });
      if (!('response' in result)) throw new Error('expected a response');
      expect(result.response.status).toBe(400);
      expect((await errorOf(result.response)).code).toBe('bad_request');
    }
  });

  it('charges the per-anonId limit only after the header and body checks pass', async () => {
    // Two rejected requests (mismatch, bad body) must leave the player's whole budget of 2.
    await read(pick, { anonId: OTHER_ANON });
    await read({ ...pick, round: 9 });
    const ok = [await read(pick), await read(pick)];
    expect(ok.every((r) => !('response' in r))).toBe(true);
    const limited = await read(pick);
    if (!('response' in limited)) throw new Error('expected a response');
    expect(limited.response.status).toBe(429);
    expect(limited.response.headers.get('retry-after')).toMatch(/^\d+$/);
  });

  it('answers 409 day_over with today’s date for a closed set, before it looks for the pair', async () => {
    const lookup = vi.mocked(findDuelPair);
    lookup.mockClear();
    const result = await read({ ...pick, date: '2026-11-10' });
    if (!('response' in result)) throw new Error('expected a response');
    expect(result.response.status).toBe(409);
    expect(await errorOf(result.response)).toMatchObject({ code: 'day_over', today: TODAY });
    expect(lookup).not.toHaveBeenCalled();
  });

  it('answers 404 not_in_set when the day has no such round', async () => {
    vi.mocked(findDuelPair).mockReturnValueOnce(null);
    const result = await read(pick);
    if (!('response' in result)) throw new Error('expected a response');
    expect(result.response.status).toBe(404);
    expect((await errorOf(result.response)).code).toBe('not_in_set');
  });
});
