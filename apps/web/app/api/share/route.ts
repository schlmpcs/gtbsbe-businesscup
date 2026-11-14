// GET /api/share?resultId=<32 hex>&format=9x16|1x1
//   200 image/png: 1080×1920 (9x16, the default; also 9:16 or story) or 1080×1080 (1x1; also 1:1
//   or square)
//   400 bad_request (bad format) · 404 not_found (no stored result with that id) · 429 rate_limited
//   503 unavailable
//
// The share card of one stored guess (/api/daily/guess). Every number on it (the guess, the range,
// the points, the clues opened) comes from the stored result, never from the URL, so a share card
// cannot be faked. The resultId is random, not the player's anonymous id, so a share link reveals
// nothing about who played. A stored result never changes, so the image is cached for a year.
// Spec: docs/ARCHITECTURE.md → Server routes.
import { checkGameIpLimit, GAME_RATE_LIMITS, gameError } from '@/server/game/http';
import { parseShareFormat, renderShareCard, shareCardModel } from '@/server/game/shareCard';
import { getStore } from '@/server/store';
import { RESULT_ID } from '@/server/store/game';
import { storeErrorResponse } from '@/server/store/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  const limited = checkGameIpLimit(req, GAME_RATE_LIMITS.share.perIp, 'share');
  if (limited) return limited;

  const params = new URL(req.url).searchParams;
  const format = parseShareFormat(params.get('format'));
  if (!format) return gameError(400, 'bad_request', { issues: ['format must be 9x16 or 1x1'] });
  const resultId = params.get('resultId')?.trim().toLowerCase() ?? '';
  // A malformed id cannot match a stored one: answer 404 without a query.
  if (!RESULT_ID.test(resultId)) return gameError(404, 'not_found');

  let stored;
  try {
    stored = await getStore().game.findResult(resultId);
  } catch (err) {
    return storeErrorResponse(err, 'share');
  }
  if (!stored) return gameError(404, 'not_found');

  return renderShareCard(shareCardModel(stored, format), {
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Content-Disposition': `inline; filename="lifeguessr-${stored.date}-${format}.png"`,
  });
}
