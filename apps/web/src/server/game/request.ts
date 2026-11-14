// Server-only: the shared front half of POST /api/daily/clue and /api/daily/guess. Rate limits,
// the body, the anonymous id, which day's set is being played and the card in it, in that order,
// so a rejected request costs as little as possible.
import type { LifeCard } from '@lifeguessr/types';
import type { z } from 'zod';
import { readJsonBody } from '@/server/ai/http';
import type { RateLimitRule } from '../rateLimit';
import { findDailyCard, resolvePlayDate } from './daily';
import { checkGameAnonLimit, checkGameIpLimit, gameError, MAX_GAME_BODY_BYTES, readAnonIdHeader } from './http';

type PlayBody = { anonId: string; cardId: string; date?: string };

export type PlayRequest<T extends PlayBody> = { body: T; date: string; card: LifeCard };

export async function readPlayRequest<S extends z.ZodType<PlayBody>>(
  req: Request,
  schema: S,
  limits: { perAnonId: RateLimitRule; perIp: RateLimitRule },
  route: string,
  now: Date = new Date(),
): Promise<PlayRequest<z.output<S>> | { response: Response }> {
  const ipLimited = checkGameIpLimit(req, limits.perIp, route);
  if (ipLimited) return { response: ipLimited };

  const header = readAnonIdHeader(req);
  if ('response' in header) return header;
  const parsed = await readJsonBody(req, schema, MAX_GAME_BODY_BYTES);
  if ('response' in parsed) return parsed;
  const body = parsed.data;
  if (header.anonId !== null && header.anonId !== body.anonId) {
    return { response: gameError(400, 'bad_request', { issues: ['x-anon-id does not match anonId'] }) };
  }

  const anonLimited = checkGameAnonLimit(body.anonId, limits.perAnonId, route);
  if (anonLimited) return { response: anonLimited };

  const day = resolvePlayDate(body.date, now);
  if (!day.ok) {
    return { response: gameError(409, 'day_over', { today: day.today, issues: [`the set of ${body.date} has ended`] }) };
  }
  const card = findDailyCard(day.date, body.cardId);
  if (!card) return { response: gameError(404, 'not_in_set', { issues: [`${body.cardId} is not in the set of ${day.date}`] }) };
  return { body, date: day.date, card };
}
