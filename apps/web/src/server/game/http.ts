// Server-only: request plumbing for the game routes (T5): rate limits, body cap, the anonymous id
// and typed `{ ok: false, error: { code: GameErrorCode } }` replies.
import { AnonIdSchema } from '@lifeguessr/types';
import type { GameErrorCode } from '@/lib/api/gameSchemas';
import { json } from '@/server/ai/http';
import { createRateLimiter, type RateLimitRule } from '../rateLimit';

const perMinute = (limit: number): RateLimitRule => ({ limit, windowMs: 60_000 });

/**
 * A full day is 5 guesses and at most 25 clues, so these per-minute ceilings are far above real
 * play; per IP they are looser for people behind one NAT, but still stop one client from cycling
 * anonymous ids to write rows without end. Share images cost a render each, so they are capped
 * per IP; the reads (daily set, leaderboard) only per IP.
 */
export const GAME_RATE_LIMITS = {
  clue: { perAnonId: perMinute(40), perIp: perMinute(240) },
  guess: { perAnonId: perMinute(20), perIp: perMinute(120) },
  /** A duel day has 5 hints (one per round), at most: the same budget as a clue. */
  hint: { perAnonId: perMinute(40), perIp: perMinute(240) },
  share: { perIp: perMinute(30) },
  read: { perIp: perMinute(120) },
} as const;

/** Its own budget: playing must not eat into the session, LLM or Pro limits, or the reverse. */
export const gameRateLimiter = createRateLimiter();

/** GET /api/leaderboard: rows in `entries` by default, and at most. */
export const LEADERBOARD_DEFAULT_LIMIT = 50;
export const LEADERBOARD_MAX_LIMIT = 100;

/** A clue or guess body is about 150 bytes. */
export const MAX_GAME_BODY_BYTES = 2 * 1024;

export function gameError(
  status: number,
  code: GameErrorCode,
  extra: Record<string, unknown> = {},
  headers: Record<string, string> = {},
): Response {
  return json({ ok: false, error: { code, ...extra } }, status, headers);
}

// Same rules as server/ai/http.ts and server/session/http.ts.
export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || req.headers.get('x-real-ip')?.trim() || 'unknown';
}

/** Counts one request against every key (all or none); a 429 reply when over a limit, else null. */
export function chargeGame(keys: { key: string; rule: RateLimitRule }[]): Response | null {
  const result = gameRateLimiter.check(keys);
  if (result.ok) return null;
  const { retryAfterSeconds } = result;
  return gameError(429, 'rate_limited', { retryAfterSeconds }, { 'Retry-After': String(retryAfterSeconds) });
}

/** Per-IP limit of one route family, checked before the body is read. */
export const checkGameIpLimit = (req: Request, rule: RateLimitRule, route: string): Response | null =>
  chargeGame([{ key: `${route}:ip:${clientIp(req)}`, rule }]);

/** Per-anonId limit of one route family, once the id is known and valid. */
export const checkGameAnonLimit = (anonId: string, rule: RateLimitRule, route: string): Response | null =>
  chargeGame([{ key: `${route}:anon:${anonId}`, rule }]);

/**
 * The x-anon-id header, lower-cased: `{ anonId: null }` when absent, a 400 when present but not a
 * UUID. The browser sends it with every request (lib/api/http.ts).
 */
export function readAnonIdHeader(req: Request): { anonId: string | null } | { response: Response } {
  const raw = req.headers.get('x-anon-id')?.trim();
  if (!raw) return { anonId: null };
  const parsed = AnonIdSchema.safeParse(raw);
  if (!parsed.success) return { response: gameError(400, 'bad_request', { issues: ['x-anon-id must be a UUID'] }) };
  return { anonId: parsed.data };
}
