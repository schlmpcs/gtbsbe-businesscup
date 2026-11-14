// POST /api/daily/hint  { anonId, date, round }   (header x-anon-id, if sent, must match)
//   200 { A, B, recorded }: one more fact per life (the neighborhood tier), both lives of the round
//   400 bad_request · 409 day_over (carries `today`) · 413 too_large · 429 rate_limited (Retry-After)
//   503 unavailable (the store is not configured or down)
//
// The server records the hint first, then answers it: the hint lowers the points of this player's
// pick on this round (a correct pick scores 900, not 1,000), counted by /api/daily/pick from this
// record. One hint per round: asking twice answers the same text with `recorded: false` and counts
// once. A hint asked after the pick is shown but not recorded (`recorded: false`): the reveal
// already showed both lives, and a score never changes after the pick. The client sends no hint
// count and no score; the strict schema rejects them.
// Spec: docs/ARCHITECTURE.md → Server routes; contract: DuelHintRequestSchema, HintReplySchema.
import { DuelHintRequestSchema } from '@lifeguessr/types';
import { json } from '@/server/ai/http';
import { duelHint } from '@/server/game/duel';
import { GAME_RATE_LIMITS } from '@/server/game/http';
import { readDuelRequest } from '@/server/game/request';
import { getStore } from '@/server/store';
import { storeErrorResponse } from '@/server/store/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  const duel = await readDuelRequest(req, DuelHintRequestSchema, GAME_RATE_LIMITS.hint, 'hint');
  if ('response' in duel) return duel.response;
  const { body, date, pair } = duel;

  let recorded: boolean;
  try {
    ({ recorded } = await getStore().duel.openHint({ date, anonId: body.anonId }, body.round));
  } catch (err) {
    return storeErrorResponse(err, 'daily/hint');
  }
  return json({ ...duelHint(pair), recorded });
}
