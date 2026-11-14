// GET /api/share?resultId=<32 hex>&format=9x16|1x1
//   200 image/png: 1080×1920 (9x16, the default; also 9:16 or story) or 1080×1080 (1x1; also 1:1
//   or square)
//   400 bad_request (bad format) · 404 not_found (no stored result with that id) · 429 rate_limited
//   503 unavailable
//
// The share card of one stored result. Two games store results under the same random 32-hex id
// format, so the id is looked up in both: first as a duel day (store.duel.findDuelDay, the
// player's picks for one day's five rounds), then as a slider guess (store.game.findResult). Every
// number on the card comes from what the store holds, never from the URL, so a share card cannot
// be faked. The resultId is random, not the player's anonymous id, so a share link reveals nothing
// about who played.
//
// Caching follows from whether the stored result can still change:
// - a slider guess never changes once stored, so its card is cached for a year;
// - a duel day changes with every pick until all five rounds are in, and the URL stays the same
//   the whole day. A partial day answers no-store rather than a short max-age: the moment someone
//   asks for the image is usually right after their last pick (the share sheet fetches it on the
//   day result), and any cache window, however short, could hand them the grid from one pick ago.
//   Partial days are rare and cheap to render, so there is nothing worth caching. Once all five
//   are picked the day is as final as a slider guess and gets the same one-year immutable cache.
// Spec: docs/ARCHITECTURE.md → Server routes.
import { checkGameIpLimit, GAME_RATE_LIMITS, gameError } from '@/server/game/http';
import {
  duelShareCardModel, parseShareFormat, renderShareCard, shareCardModel, type StoredDuelDayResult,
} from '@/server/game/shareCard';
import { getStore } from '@/server/store';
import { RESULT_ID, type StoredResult } from '@/server/store/game';
import { storeErrorResponse } from '@/server/store/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CACHE_FINAL = 'public, max-age=31536000, immutable';
const CACHE_CHANGING = 'no-store';

export async function GET(req: Request): Promise<Response> {
  const limited = checkGameIpLimit(req, GAME_RATE_LIMITS.share.perIp, 'share');
  if (limited) return limited;

  const params = new URL(req.url).searchParams;
  const format = parseShareFormat(params.get('format'));
  if (!format) return gameError(400, 'bad_request', { issues: ['format must be 9x16 or 1x1'] });
  const resultId = params.get('resultId')?.trim().toLowerCase() ?? '';
  // A malformed id cannot match a stored one: answer 404 without a query.
  if (!RESULT_ID.test(resultId)) return gameError(404, 'not_found');

  // Duel first, then slider. A duel id never reaches the second query; a slider id costs one
  // extra indexed lookup that finds nothing.
  let day: StoredDuelDayResult | null;
  let stored: StoredResult | null = null;
  try {
    const store = getStore();
    day = await store.duel.findDuelDay(resultId);
    if (!day) stored = await store.game.findResult(resultId);
  } catch (err) {
    return storeErrorResponse(err, 'share');
  }

  if (day) {
    const model = duelShareCardModel(day, format);
    return renderShareCard(model, {
      'Cache-Control': model.complete ? CACHE_FINAL : CACHE_CHANGING,
      'Content-Disposition': `inline; filename="lifeguessr-duel-${day.date}-${format}.png"`,
    });
  }
  if (!stored) return gameError(404, 'not_found');
  return renderShareCard(shareCardModel(stored, format), {
    'Cache-Control': CACHE_FINAL,
    'Content-Disposition': `inline; filename="lifeguessr-${stored.date}-${format}.png"`,
  });
}
