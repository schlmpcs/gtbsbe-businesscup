// GET /api/daily   (header x-anon-id optional)
//   200 { ok: true, date, cards: PublicCard[5], progress? }
//   400 bad_request (x-anon-id is not a UUID) · 429 rate_limited · 503 unavailable (store down;
//   only when progress was asked for)
//
// Today's set: the US Eastern calendar date (DST-aware), so the 5 homes are the same for everyone
// and roll over at US midnight. Cards are PublicCards only: layout, metro, caption and decor, no
// cost and none of the card fields the clues reveal. With x-anon-id the reply also carries what the
// server recorded for this player today (DailyProgress: opened clues and scored guesses), so a
// browser that lost its state shows what the server will count.
// Spec: docs/ARCHITECTURE.md → Server routes; contract: DailyResponseSchema (lib/api/gameSchemas).
import type { DailyProgress } from '@/lib/api/gameSchemas';
import { json } from '@/server/ai/http';
import { clueReveal, findDailyCard, playDate, publicCards } from '@/server/game/daily';
import { checkGameIpLimit, GAME_RATE_LIMITS, readAnonIdHeader } from '@/server/game/http';
import { getStore, type PlayerDay } from '@/server/store';
import { storeErrorResponse } from '@/server/store/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The player's day as the browser's contract: clue reveals and played guesses per card. */
function toProgress(date: string, day: PlayerDay): DailyProgress {
  const progress: DailyProgress = { clues: {}, guesses: {} };
  for (const [cardId, clues] of Object.entries(day.clues)) {
    const card = findDailyCard(date, cardId);
    if (card) progress.clues[cardId] = clues.map((clue) => clueReveal(card, clue));
  }
  for (const r of day.results) progress.guesses[r.cardId] = { guess: r.guess, reveal: r.reveal };
  return progress;
}

export async function GET(req: Request): Promise<Response> {
  const limited = checkGameIpLimit(req, GAME_RATE_LIMITS.read.perIp, 'read');
  if (limited) return limited;
  const header = readAnonIdHeader(req);
  if ('response' in header) return header.response;

  const date = playDate();
  const cards = publicCards(date);
  if (header.anonId === null) return json({ ok: true, date, cards });

  try {
    const day = await getStore().game.playerDay(date, header.anonId);
    return json({ ok: true, date, cards, progress: toProgress(date, day) });
  } catch (err) {
    return storeErrorResponse(err, 'daily');
  }
}
