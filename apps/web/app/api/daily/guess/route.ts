// POST /api/daily/guess  { anonId, cardId, guess, date? }   (header x-anon-id, if sent, must match)
//   200 GuessReveal + { guess, replayed }
//   400 bad_request · 404 not_in_set · 409 day_over · 413 too_large · 429 rate_limited
//   503 unavailable (the store is not configured or down)
//
// The server scores the guess: costOfLife for the card's range and scoreGuess with the clues IT
// recorded for this player and card (/api/daily/clue), never a count or a score from the client.
// One guess per card per player per day: the result is stored under a random resultId (share
// links use it), and any later guess for that card answers the stored result with
// `replayed: true` and the amount that was scored, never a second score.
// Spec: docs/ARCHITECTURE.md → Server routes; contract: GuessRequestSchema, GuessReplySchema.
import { GuessRequestSchema } from '@/lib/api/gameSchemas';
import { json } from '@/server/ai/http';
import { scorerFor } from '@/server/game/daily';
import { GAME_RATE_LIMITS } from '@/server/game/http';
import { readPlayRequest } from '@/server/game/request';
import { getStore } from '@/server/store';
import { storeErrorResponse } from '@/server/store/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  const play = await readPlayRequest(req, GuessRequestSchema, GAME_RATE_LIMITS.guess, 'guess');
  if ('response' in play) return play.response;
  const { body, date, card } = play;

  try {
    const { result, replayed } = await getStore().game.submitGuess(
      { date, anonId: body.anonId, cardId: card.id },
      body.guess,
      scorerFor(card, body.guess),
    );
    return json({ ...result.reveal, guess: result.guess, replayed });
  } catch (err) {
    return storeErrorResponse(err, 'daily/guess');
  }
}
