import { dailyCards } from '@lifeguessr/data/cards';
import { DUEL_ROUNDS, type DuelLetter, type DuelRound } from '@lifeguessr/types';
import { describe, expect, it, vi } from 'vitest';
import { GuessReplySchema } from '@/lib/api/gameSchemas';
import { dayNumber } from '@/lib/dates';
import { duelScorer, findDuelPair } from '@/server/game/duel';
import { GAME_RATE_LIMITS } from '@/server/game/http';
import { ANON, errorOf, getReq, postReq, setupGameTestEnv, TODAY } from '@/server/game/testUtils';
import { StoreUnavailableError, type Store } from '@/server/store';
import { newResultId } from '@/server/store/game';
import { POST as postGuess } from '../daily/guess/route';
import { GET } from './route';

const getStore = setupGameTestEnv();
const [CARD] = dailyCards(dayNumber(TODAY));

async function storedResultId(): Promise<string> {
  const res = await postGuess(postReq('/api/daily/guess', { anonId: ANON, cardId: CARD!.id, guess: 3_000 }));
  return GuessReplySchema.parse(await res.json()).resultId;
}

/**
 * Plays `rounds` of today's duel for ANON straight through the store (the pick route is its own
 * issue), right on even rounds and wrong on odd ones, and answers the day's resultId.
 */
async function storedDuelDay(rounds: readonly DuelRound[]): Promise<string> {
  let resultId = '';
  for (const round of rounds) {
    const pair = findDuelPair(TODAY, round)!;
    const costlier: DuelLetter = duelScorer(pair, 'A')(0).correct ? 'A' : 'B';
    const choice: DuelLetter = round % 2 === 0 ? costlier : costlier === 'A' ? 'B' : 'A';
    ({ resultId } = await getStore().duel.submitPick({ date: TODAY, anonId: ANON }, round, choice, duelScorer(pair, choice)));
  }
  return resultId;
}

/** Width and height from a PNG's IHDR chunk. */
function pngSize(bytes: Uint8Array): { width: number; height: number } {
  expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

describe('GET /api/share', () => {
  it.each([
    ['9x16', { width: 1080, height: 1920 }],
    ['1x1', { width: 1080, height: 1080 }],
    ['9:16', { width: 1080, height: 1920 }],
    ['square', { width: 1080, height: 1080 }],
    [null, { width: 1080, height: 1920 }],
  ])('renders a stored result as a PNG (format %s)', async (format, size) => {
    const resultId = await storedResultId();
    const query = format === null ? `resultId=${resultId}` : `resultId=${resultId}&format=${encodeURIComponent(format)}`;
    const res = await GET(getReq(`/api/share?${query}`));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(pngSize(bytes)).toEqual(size);
    expect(bytes.byteLength).toBeGreaterThan(10_000); // a real card, not an empty frame
  });

  it('looks a slider id up as a duel day first, then renders the slider card from the stored guess', async () => {
    const resultId = await storedResultId();
    const findDuelDay = vi.spyOn(getStore().duel, 'findDuelDay');
    const findResult = vi.spyOn(getStore().game, 'findResult');
    const res = await GET(getReq(`/api/share?resultId=${resultId}`));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toBe(`inline; filename="lifeguessr-${TODAY}-9x16.png"`);
    expect(findDuelDay).toHaveBeenCalledWith(resultId);
    expect(findResult).toHaveBeenCalledWith(resultId);
    expect(findDuelDay.mock.invocationCallOrder[0]).toBeLessThan(findResult.mock.invocationCallOrder[0]!);
  });

  it.each([
    ['9x16', { width: 1080, height: 1920 }],
    ['1x1', { width: 1080, height: 1080 }],
  ] as const)('renders a finished duel day as a PNG cached for a year (format %s)', async (format, size) => {
    const resultId = await storedDuelDay(DUEL_ROUNDS);
    const findResult = vi.spyOn(getStore().game, 'findResult');
    const res = await GET(getReq(`/api/share?resultId=${resultId}&format=${format}`));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(res.headers.get('content-disposition')).toBe(`inline; filename="lifeguessr-duel-${TODAY}-${format}.png"`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(pngSize(bytes)).toEqual(size);
    expect(bytes.byteLength).toBeGreaterThan(10_000);
    expect(findResult).not.toHaveBeenCalled(); // a duel id never reaches the slider lookup
  });

  it('does not cache a duel day that is still being played, and caches it once the fifth pick is in', async () => {
    const resultId = await storedDuelDay([1, 2, 3]);
    const partial = await GET(getReq(`/api/share?resultId=${resultId}`));
    expect(partial.status).toBe(200);
    expect(partial.headers.get('content-type')).toBe('image/png');
    expect(partial.headers.get('cache-control')).toBe('no-store');
    const partialBytes = new Uint8Array(await partial.arrayBuffer());

    expect(await storedDuelDay([4, 5])).toBe(resultId); // same day, same id
    const finished = await GET(getReq(`/api/share?resultId=${resultId}`));
    expect(finished.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    // Same URL, different picture: exactly why the partial one must not be cached.
    expect(Buffer.from(new Uint8Array(await finished.arrayBuffer())).equals(Buffer.from(partialBytes))).toBe(false);
  });

  it('answers 404 for an unknown or malformed resultId (a malformed one without a query), 400 for an unknown format', async () => {
    const findDuelDay = vi.spyOn(getStore().duel, 'findDuelDay');
    const findResult = vi.spyOn(getStore().game, 'findResult');
    for (const id of ['abc', '', '../etc/passwd', 'g'.repeat(32)]) {
      const res = await GET(getReq(`/api/share?resultId=${encodeURIComponent(id)}`));
      expect(res.status).toBe(404);
      expect((await errorOf(res)).code).toBe('not_found');
      expect(res.headers.get('cache-control')).toBe('no-store');
    }
    expect(findDuelDay).not.toHaveBeenCalled();
    expect(findResult).not.toHaveBeenCalled();

    const unknown = newResultId();
    const res404 = await GET(getReq(`/api/share?resultId=${unknown}`));
    expect(res404.status).toBe(404);
    expect((await errorOf(res404)).code).toBe('not_found');
    expect(res404.headers.get('cache-control')).toBe('no-store');
    expect(findDuelDay).toHaveBeenCalledWith(unknown);
    expect(findResult).toHaveBeenCalledWith(unknown);

    const res = await GET(getReq(`/api/share?resultId=${await storedResultId()}&format=4x3`));
    expect(res.status).toBe(400);
  });

  it('is rate-limited per IP', async () => {
    const ip = '10.202.0.1';
    const missing = `/api/share?resultId=${newResultId()}`;
    for (let i = 0; i < GAME_RATE_LIMITS.share.perIp.limit; i++) expect((await GET(getReq(missing, { ip }))).status).toBe(404);
    const res = await GET(getReq(missing, { ip }));
    expect(res.status).toBe(429);
    expect((await errorOf(res)).code).toBe('rate_limited');
  });

  it('answers 503 unavailable when the store is down, at either lookup', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const duelDown = vi.spyOn(getStore().duel as Store['duel'], 'findDuelDay').mockRejectedValue(new StoreUnavailableError('unreachable', 'down'));
    expect((await GET(getReq(`/api/share?resultId=${newResultId()}`))).status).toBe(503);
    duelDown.mockRestore();
    vi.spyOn(getStore().game as Store['game'], 'findResult').mockRejectedValue(new StoreUnavailableError('unreachable', 'down'));
    expect((await GET(getReq(`/api/share?resultId=${newResultId()}`))).status).toBe(503);
  });
});
