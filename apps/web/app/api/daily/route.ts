// GET /api/daily   (query game=slider|duel, default slider; header x-anon-id optional)
//   slider (default)
//     200 { ok: true, date, cards: PublicCard[5], progress? }
//   duel (?game=duel, "Which life costs more?")
//     200 { ok: true, date, duels: PublicDuel[5], progress? }
//   400 bad_request (x-anon-id is not a UUID, or game is neither "slider" nor "duel") · 429
//   rate_limited · 503 unavailable (store down; only when progress was asked for)
//
// Today's set: the US Eastern calendar date (DST-aware), so the 5 homes (or 5 duels) are the same
// for everyone and roll over at US midnight. Slider cards are PublicCards only: layout, metro,
// caption and decor, no cost and none of the card fields the clues reveal. Duels are PublicDuels:
// words and art for two lives each, no totals, ZIPs, tiers or card ids before a pick.
// With x-anon-id the reply also carries what the server recorded for this player today, so a
// browser that lost its state shows what the server will count:
// - slider: DailyProgress, the opened clues and scored guesses;
// - duel: DuelProgressWire, the picks as scored (with a live `crowd`, null below
//   DUEL_CROWD_MIN_PICKS picks) and the hint text of each round the server recorded a hint for,
//   never one the player did not ask for.
// Without the header there is no `progress` and the store is not touched.
// The game switch is a query parameter, not a server flag: the browser knows its mode at build time
// and old slider clients keep working while the duel rolls out (#109, #120).
// Spec: docs/ARCHITECTURE.md → Server routes; contracts: DailyResponseSchema and
// DuelDailyResponseSchema (lib/api/gameSchemas).
import { DailyGameSchema, type DailyGame, type DailyProgress, type DuelDailyResponse } from '@/lib/api/gameSchemas';
import { json } from '@/server/ai/http';
import { clueReveal, findDailyCard, playDate, publicCards } from '@/server/game/daily';
import { publicDuels } from '@/server/game/duel';
import { liveCrowds, toDuelProgress } from '@/server/game/duelProgress';
import { checkGameIpLimit, GAME_RATE_LIMITS, readAnonIdHeader, gameError } from '@/server/game/http';
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

/** The `game` query parameter: absent means the slider; anything but "slider" and "duel" is a 400. */
function readGame(req: Request): { game: DailyGame } | { response: Response } {
  const raw = new URL(req.url).searchParams.get('game');
  if (raw === null) return { game: 'slider' };
  const parsed = DailyGameSchema.safeParse(raw);
  if (!parsed.success) return { response: gameError(400, 'bad_request', { issues: ['game must be "slider" or "duel"'] }) };
  return { game: parsed.data };
}

/** ?game=duel: the day's five duels, plus this player's stored picks and hints when `anonId` is known. */
async function duelDaily(date: string, anonId: string | null): Promise<Response> {
  const duels = publicDuels(date);
  if (anonId === null) return json({ ok: true, date, duels } satisfies DuelDailyResponse);
  try {
    const { duel } = getStore();
    const day = await duel.playerDuelDay({ date, anonId });
    const crowds = await liveCrowds(duel, date, day.picks.map((pick) => pick.round));
    return json({ ok: true, date, duels, progress: toDuelProgress(date, day, crowds) } satisfies DuelDailyResponse);
  } catch (err) {
    return storeErrorResponse(err, 'daily');
  }
}

export async function GET(req: Request): Promise<Response> {
  const limited = checkGameIpLimit(req, GAME_RATE_LIMITS.read.perIp, 'read');
  if (limited) return limited;
  const header = readAnonIdHeader(req);
  if ('response' in header) return header.response;
  const mode = readGame(req);
  if ('response' in mode) return mode.response;

  const date = playDate();
  if (mode.game === 'duel') return duelDaily(date, header.anonId);

  const cards = publicCards(date);
  if (header.anonId === null) return json({ ok: true, date, cards });

  try {
    const day = await getStore().game.playerDay(date, header.anonId);
    return json({ ok: true, date, cards, progress: toProgress(date, day) });
  } catch (err) {
    return storeErrorResponse(err, 'daily');
  }
}
