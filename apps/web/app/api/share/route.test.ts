import { dailyCards } from '@lifeguessr/data/cards';
import { describe, expect, it, vi } from 'vitest';
import { GuessReplySchema } from '@/lib/api/gameSchemas';
import { dayNumber } from '@/lib/dates';
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

  it('answers 404 for an unknown or malformed resultId, 400 for an unknown format', async () => {
    for (const id of [newResultId(), 'abc', '', '../etc/passwd']) {
      const res = await GET(getReq(`/api/share?resultId=${encodeURIComponent(id)}`));
      expect(res.status).toBe(404);
      expect((await errorOf(res)).code).toBe('not_found');
      expect(res.headers.get('cache-control')).toBe('no-store');
    }
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

  it('answers 503 unavailable when the store is down', async () => {
    vi.spyOn(getStore().game as Store['game'], 'findResult').mockRejectedValue(new StoreUnavailableError('unreachable', 'down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await GET(getReq(`/api/share?resultId=${newResultId()}`));
    expect(res.status).toBe(503);
  });
});
