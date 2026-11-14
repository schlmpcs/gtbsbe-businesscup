// GET /api/leaderboard?date=YYYY-MM-DD&limit=N   (header x-anon-id optional)
//   200 LeaderboardResponse { ok: true, date, players, entries, rank, todayStats }
//   400 bad_request (bad date, a date after today, bad limit, bad x-anon-id) · 429 rate_limited
//   503 unavailable
//
// The day's players ranked by the points of their stored guesses (/api/daily/guess); the client
// never sends a score. Players appear under made-up handles derived from a hash, never an id.
// `date` defaults to today's US Eastern date; `limit` (1–100, default 50) caps `entries`. With
// x-anon-id, `rank` and `todayStats` are the caller's own, even outside the top `limit`.
// Spec: docs/ARCHITECTURE.md → Server routes; contract: LeaderboardResponseSchema.
import { z } from 'zod';
import { PlayDateSchema, type LeaderboardResponse } from '@/lib/api/gameSchemas';
import { json } from '@/server/ai/http';
import { playDate } from '@/server/game/daily';
import {
  checkGameIpLimit, GAME_RATE_LIMITS, gameError, LEADERBOARD_DEFAULT_LIMIT, LEADERBOARD_MAX_LIMIT, readAnonIdHeader,
} from '@/server/game/http';
import { getStore } from '@/server/store';
import { storeErrorResponse } from '@/server/store/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  date: PlayDateSchema.optional(),
  limit: z.coerce.number().int().min(1).max(LEADERBOARD_MAX_LIMIT).default(LEADERBOARD_DEFAULT_LIMIT),
});

export async function GET(req: Request): Promise<Response> {
  const limited = checkGameIpLimit(req, GAME_RATE_LIMITS.read.perIp, 'read');
  if (limited) return limited;
  const header = readAnonIdHeader(req);
  if ('response' in header) return header.response;

  const params = new URL(req.url).searchParams;
  const query = QuerySchema.safeParse({
    date: params.get('date') || undefined,
    limit: params.get('limit') || undefined,
  });
  if (!query.success) {
    return gameError(400, 'bad_request', { issues: query.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) });
  }
  const today = playDate();
  const date = query.data.date ?? today;
  if (date > today) return gameError(400, 'bad_request', { issues: [`date: ${date} has not started yet (today is ${today})`] });

  try {
    const board = await getStore().game.leaderboard(date, { limit: query.data.limit, anonId: header.anonId });
    const you = board.you;
    const reply: LeaderboardResponse = {
      ok: true,
      date,
      players: board.players,
      entries: board.entries,
      rank: you?.rank ?? null,
      todayStats: you ? { handle: you.handle, points: you.points, played: you.played, inRange: you.inRange } : null,
    };
    return json(reply);
  } catch (err) {
    return storeErrorResponse(err, 'leaderboard');
  }
}
