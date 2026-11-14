// POST /api/daily/clue  { anonId, cardId, clue, date? }   (header x-anon-id, if sent, must match)
//   200 ClueReveal (the room's props and the facts behind them)
//   400 bad_request · 404 not_in_set · 409 day_over · 413 too_large · 429 rate_limited
//   503 unavailable (the store is not configured or down)
//
// The server records the opened clue first, then answers it: the clue lowers the score
// multiplier of this player's guess on this card, counted by /api/daily/guess from this record.
// Opening a clue twice counts once; a clue opened after the guess is shown but not recorded.
// Spec: docs/ARCHITECTURE.md → Server routes; contract: ClueRequestSchema, ClueRevealSchema.
import { ClueRequestSchema } from '@/lib/api/gameSchemas';
import { json } from '@/server/ai/http';
import { clueReveal } from '@/server/game/daily';
import { GAME_RATE_LIMITS } from '@/server/game/http';
import { readPlayRequest } from '@/server/game/request';
import { getStore } from '@/server/store';
import { storeErrorResponse } from '@/server/store/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  const play = await readPlayRequest(req, ClueRequestSchema, GAME_RATE_LIMITS.clue, 'clue');
  if ('response' in play) return play.response;
  const { body, date, card } = play;

  try {
    await getStore().game.openClue({ date, anonId: body.anonId, cardId: card.id }, body.clue);
  } catch (err) {
    return storeErrorResponse(err, 'daily/clue');
  }
  return json(clueReveal(card, body.clue));
}
