// Server-only: the shared front half of the game POST routes: POST /api/daily/clue and /guess (the
// slider, one card of the day) and /hint and /pick (the duel, one round of the day). Rate limits,
// the body, the anonymous id, which day's set is being played and the card or pair in it, in that
// order, so a rejected request costs as little as possible.
//
// The steps up to the day are the same for both games (readGameBody, resolveGameDay); only what
// is looked up in the day's set differs: readPlayRequest finds a card by id, readDuelRequest a
// duel pair by round.
import type { DuelRound, LifeCard } from '@lifeguessr/types';
import type { z } from 'zod';
import { readJsonBody } from '@/server/ai/http';
import type { RateLimitRule } from '../rateLimit';
import { findDailyCard, resolvePlayDate } from './daily';
import { findDuelPair, type DuelPair } from './duel';
import { checkGameAnonLimit, checkGameIpLimit, gameError, MAX_GAME_BODY_BYTES, readAnonIdHeader } from './http';

/** The two limits of one route family (GAME_RATE_LIMITS.clue, .guess, .hint, ...). */
export type GameLimits = { perAnonId: RateLimitRule; perIp: RateLimitRule };

/** What every game body carries; `date` is the set's date from the daily GET (optional for the slider). */
type GameBody = { anonId: string; date?: string };

/**
 * Steps 1–5: per-IP limit → x-anon-id header → body (size, JSON, schema) → header/body id match →
 * per-anonId limit. The anonymous id is charged only once the body is known to be well-formed, so a
 * request that fails earlier costs the player no budget.
 */
async function readGameBody<S extends z.ZodType<GameBody>>(
  req: Request,
  schema: S,
  limits: GameLimits,
  route: string,
): Promise<{ body: z.output<S> } | { response: Response }> {
  const ipLimited = checkGameIpLimit(req, limits.perIp, route);
  if (ipLimited) return { response: ipLimited };

  const header = readAnonIdHeader(req);
  if ('response' in header) return header;
  const parsed = await readJsonBody(req, schema, MAX_GAME_BODY_BYTES);
  if ('response' in parsed) return parsed;
  const body: z.output<S> = parsed.data;
  if (header.anonId !== null && header.anonId !== body.anonId) {
    return { response: gameError(400, 'bad_request', { issues: ['x-anon-id does not match anonId'] }) };
  }

  const anonLimited = checkGameAnonLimit(body.anonId, limits.perAnonId, route);
  if (anonLimited) return { response: anonLimited };
  return { body };
}

/** Step 6: the set the request plays (today's, or yesterday's within the grace period), else 409 `day_over`. */
function resolveGameDay(requested: string | undefined, now: Date): { date: string } | { response: Response } {
  const day = resolvePlayDate(requested, now);
  if (day.ok) return { date: day.date };
  return { response: gameError(409, 'day_over', { today: day.today, issues: [`the set of ${requested} has ended`] }) };
}

// ----- The slider: a card of the day -----------------------------------------------------------

type PlayBody = { anonId: string; cardId: string; date?: string };

export type PlayRequest<T extends PlayBody> = { body: T; date: string; card: LifeCard };

export async function readPlayRequest<S extends z.ZodType<PlayBody>>(
  req: Request,
  schema: S,
  limits: GameLimits,
  route: string,
  now: Date = new Date(),
): Promise<PlayRequest<z.output<S>> | { response: Response }> {
  const read = await readGameBody(req, schema, limits, route);
  if ('response' in read) return read;
  const { body } = read;

  const day = resolveGameDay(body.date, now);
  if ('response' in day) return day;
  const card = findDailyCard(day.date, body.cardId);
  if (!card) return { response: gameError(404, 'not_in_set', { issues: [`${body.cardId} is not in the set of ${day.date}`] }) };
  return { body, date: day.date, card };
}

// ----- The duel: a round of the day ------------------------------------------------------------

/** A duel body names the day (the daily GET's `date`, required) and the round (1–5). */
type DuelBody = { anonId: string; date: string; round: DuelRound };

export type DuelRequest<T extends DuelBody> = { body: T; date: string; pair: DuelPair };

/**
 * The round-based twin of readPlayRequest, for POST /api/daily/hint and /api/daily/pick: the same
 * steps in the same order, ending in the day's pair for `body.round`. Pass the route's strict body
 * schema, its rate limits and its name (the name keys the rate-limit buckets, so each route keeps
 * its own budget):
 *
 *   const duel = await readDuelRequest(req, DuelPickRequestSchema, GAME_RATE_LIMITS.pick, 'pick');
 *   if ('response' in duel) return duel.response;
 *   const { body, date, pair } = duel; // body is typed by the schema, e.g. body.choice
 *
 * A reply `{ response }` is the finished error (400, 409 `day_over`, 413, 429, 404); the route
 * returns it as is. The pair holds the answer: it never goes to the browser.
 */
export async function readDuelRequest<S extends z.ZodType<DuelBody>>(
  req: Request,
  schema: S,
  limits: GameLimits,
  route: string,
  now: Date = new Date(),
): Promise<DuelRequest<z.output<S>> | { response: Response }> {
  const read = await readGameBody(req, schema, limits, route);
  if ('response' in read) return read;
  const { body } = read;

  const day = resolveGameDay(body.date, now);
  if ('response' in day) return day;
  // The schemas allow rounds 1–5 and a day always has five, so this is a guard, not a flow.
  const pair = findDuelPair(day.date, body.round);
  if (!pair) return { response: gameError(404, 'not_in_set', { issues: [`round ${body.round} is not in the set of ${day.date}`] }) };
  return { body, date: day.date, pair };
}
