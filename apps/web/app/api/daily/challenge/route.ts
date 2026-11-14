// GET /api/daily/challenge?c=<resultId, 32 hex>
//   200 { ok: true, date, rounds: 5, played, right, points, tiles, today }
//   404 not_found (no stored duel day with that id; a malformed or missing id answers 404 without a
//   store query, as /api/share does) · 429 rate_limited · 503 unavailable (store down)
//
// The score behind a duel challenge link (/duel?c={resultId}, built by the day result): what the
// friend chose to share and nothing more. That is the same thing their share card shows: right
// picks out of the rounds played, the points, one tile colour per round and the day. The reply
// carries no anonymous key (the store never hands it back), no choices, no totals and no card ids,
// so a link tells a stranger nothing about the player or about the five duels. The resultId is
// random, not the anonymous id.
//
// Every number comes from the stored picks, never from the URL, so a challenge cannot be faked. A
// day still being played answers what is stored so far (`played` < 5), and the browser only
// compares against a finished day. `today` is whether the day is the one GET /api/daily?game=duel
// serves now: the browser shows "This challenge was for {date}" and no comparison for an earlier day.
// Replies are `no-store`: `today` turns false at New York midnight, and a day grows with every pick.
// Spec: docs/ARCHITECTURE.md → Server routes; contract: DuelChallengeResponseSchema (lib/api/gameSchemas).
import { DUEL_ROUND_COUNT } from '@lifeguessr/engine';
import type { DuelChallengeResponse } from '@/lib/api/gameSchemas';
import { scoreDuelDay } from '@/lib/duel/duelDay';
import { json } from '@/server/ai/http';
import { playDate } from '@/server/game/daily';
import { checkGameIpLimit, GAME_RATE_LIMITS, gameError } from '@/server/game/http';
import { getStore } from '@/server/store';
import { RESULT_ID } from '@/server/store/game';
import { storeErrorResponse } from '@/server/store/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  // A read like /api/daily and /api/leaderboard: the same per-IP budget.
  const limited = checkGameIpLimit(req, GAME_RATE_LIMITS.read.perIp, 'read');
  if (limited) return limited;

  const resultId = new URL(req.url).searchParams.get('c')?.trim().toLowerCase() ?? '';
  // A malformed id cannot match a stored one: answer 404 without a query.
  if (!RESULT_ID.test(resultId)) return gameError(404, 'not_found');

  let day;
  try {
    day = await getStore().duel.findDuelDay(resultId);
  } catch (err) {
    return storeErrorResponse(err, 'challenge');
  }
  if (!day) return gameError(404, 'not_found');

  const { played, right, points, tiles } = scoreDuelDay(day.picks);
  return json({
    ok: true,
    date: day.date,
    rounds: DUEL_ROUND_COUNT,
    played,
    right,
    points,
    tiles,
    today: day.date === playDate(),
  } satisfies DuelChallengeResponse);
}
