// POST /api/daily/pick  { anonId, date, round, choice }   (header x-anon-id, if sent, must match)
//   200 PickResult + { replayed }: the round's result, scored by the server
//   400 bad_request · 409 day_over (carries `today`) · 413 too_large · 429 rate_limited (Retry-After)
//   503 unavailable (the store is not configured or down)
//   500 (thrown, and logged) if the round's two lives cost the same: there is no right answer to
//   score, and picking a winner silently would hand out points nobody earned
//
// The only place a duel is scored in an API build. The store runs the scorer inside its own
// transaction with the hints IT recorded for this player and round (/api/daily/hint), so a hint
// asked a moment before the pick counts, and the client never sends a score, a hint count or a
// total: the strict schema rejects them. One pick per round per player per day: the first pick is
// stored with the day's resultId (share and challenge links use it), and any later pick of that
// round, even with the other letter, answers the stored result with `replayed: true`, never a
// second score. Rounds may be picked in any order: the UI goes 1 → 5, but a reload can resume
// anywhere, and each round stands on its own.
//
// `crowd` is live, not stored: it comes from liveCrowds, the same helper GET /api/daily?game=duel
// uses for stored picks, so a pick, its replay and the daily progress always agree. It is counted
// after the pick is stored, so the player's own pick is in it, and a replay carries the count of
// now, not of the first pick. Null while the round has fewer than DUEL_CROWD_MIN_PICKS picks.
// Spec: docs/ARCHITECTURE.md → Server routes; contract: DuelPickRequestSchema, PickReplySchema.
import { DuelPickRequestSchema } from '@lifeguessr/types';
import type { PickReply } from '@/lib/api/gameSchemas';
import { json } from '@/server/ai/http';
import { duelScorer, type DuelScorer } from '@/server/game/duel';
import { liveCrowds } from '@/server/game/duelProgress';
import { GAME_RATE_LIMITS } from '@/server/game/http';
import { readDuelRequest } from '@/server/game/request';
import { getStore } from '@/server/store';
import { storeErrorResponse } from '@/server/store/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  const duel = await readDuelRequest(req, DuelPickRequestSchema, GAME_RATE_LIMITS.pick, 'pick');
  if ('response' in duel) return duel.response;
  const { body, date, pair } = duel;

  // Built before the store is touched, so a pair without a costlier life fails here and stores
  // nothing. dailyDuelPairs keeps a minimum gap between the two totals, so this should never
  // fire; if it does, the pairing has a bug, and a loud 500 with the pair in the log is how
  // someone finds out. It is re-thrown, not turned into a 4xx: the player did nothing wrong.
  let scorer: DuelScorer;
  try {
    scorer = duelScorer(pair, body.choice);
  } catch (err) {
    console.error(`[daily/pick] ${date} round ${body.round}: cannot score the pick`, err);
    throw err;
  }

  try {
    const { duel: store } = getStore();
    const { resultId, scored, replayed } = await store.submitPick(
      { date, anonId: body.anonId },
      body.round,
      body.choice,
      scorer,
    );
    const crowds = await liveCrowds(store, date, [body.round]);
    const reply: PickReply = { ...scored, resultId, crowd: crowds.get(body.round) ?? null, replayed };
    return json(reply);
  } catch (err) {
    return storeErrorResponse(err, 'daily/pick');
  }
}
