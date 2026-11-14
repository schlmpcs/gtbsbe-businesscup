// Duel game data source (S2/S3 "Which life costs more?"), behind one interface like the slider
// game's ./client:
// - http (createHttpDuelClient): the server routes GET /api/daily?game=duel, POST /api/daily/pick,
//   POST /api/daily/hint and GET /api/daily/challenge. The server holds the answers, records hints,
//   scores each pick once and keeps the day's progress per anonymous id, so a reload (or another
//   device with the same id) resumes where the player stopped.
// - fixtures (./duelFixtureClient): the contract computed in the browser from the sample cards with
//   the real engine (costOfLife + dailyDuelPairs + scoreDuelPick), so the duel plays without a server.
//   It holds the answers, so this module never imports it statically: see loadFixtureDuelClient.
// The duel has its own flag, NEXT_PUBLIC_DUEL_SOURCE (default fixtures), separate from
// NEXT_PUBLIC_GAME_SOURCE (the slider game, sessions plumbing and the leaderboard follow that one).
// NEXT_PUBLIC_DUEL_SOURCE=api plays against the server; #120 switches production to it.
import {
  DUEL_ROUNDS, type DuelHint, type DuelLetter, type DuelRound, type PickResult, type PublicDuel,
} from '@lifeguessr/types';
import type { DuelTileColor } from '@/copy/duel';
import {
  DuelChallengeResponseSchema, DuelDailyResponseSchema, HintReplySchema, PickReplySchema, ResultIdSchema,
  type DuelProgressWire,
} from '@/lib/api/gameSchemas';
import { ApiError, getJson, postJson } from '@/lib/api/http';
import { duelSource, type GameSource } from '@/lib/config';
import { getAnonId } from '@/state/anonId';

/** What the source already recorded for this player today: picks (with their results) and hints. */
export type DuelProgress = {
  picks: Partial<Record<DuelRound, { choice: DuelLetter; result: PickResult }>>;
  hints: Partial<Record<DuelRound, DuelHint>>;
};

/** A day's five duels and the player's progress on them. */
export type DuelDay = { date: string; duels: PublicDuel[]; progress: DuelProgress };

/**
 * The score a friend shared with their challenge link (/duel?c=…), as GET /api/daily/challenge
 * answers it: right picks out of the rounds played, the points and one colour per played round (in
 * round order), for one day. Nothing else of their day: no picks, totals or answers.
 * `today`: `date` is the day the source serves now; a challenge from an earlier day is no comparison.
 */
export type DuelChallenge = {
  date: string;
  rounds: number;
  played: number;
  right: number;
  points: number;
  tiles: DuelTileColor[];
  today: boolean;
};

export interface DuelClient {
  readonly source: GameSource;
  /** Today's duels. `today` is the client's New York date; the source's date wins. */
  daily(today: string): Promise<DuelDay>;
  /**
   * Pick the costlier life. One pick per round per day: a repeat answers the stored result (the
   * first pick's, even when the repeat named the other letter).
   */
  pick(round: DuelRound, choice: DuelLetter, date: string): Promise<PickResult>;
  /** One more fact on both cards; the source records it (−10% points for the round). */
  hint(round: DuelRound, date: string): Promise<DuelHint>;
  /**
   * The score behind a challenge link, or null when the source holds no such day (an unknown or
   * malformed id; the fixture duel answers only the day it played itself). `today` is the client's
   * New York date, as for `daily`: the server decides for itself, the browser source compares.
   * Other failures (the server down, a reply that breaks the contract) reject.
   */
  challenge(resultId: string, today: string): Promise<DuelChallenge | null>;
}

// ----- http (DU3–DU5 routes) -----------------------------------------------------------------------

/**
 * The server's progress (JSON object keys, so rounds are '1'..'5') as the browser's DuelProgress
 * (numeric rounds). The day's `resultId` is not kept here: every stored PickResult carries it.
 */
export function duelProgressFromWire(wire: DuelProgressWire | undefined): DuelProgress {
  const progress: DuelProgress = { picks: {}, hints: {} };
  if (!wire) return progress;
  for (const round of DUEL_ROUNDS) {
    const key = String(round) as `${DuelRound}`;
    const pick = wire.picks[key];
    if (pick) progress.picks[round] = { choice: pick.choice, result: pick.result };
    const hint = wire.hints[key];
    if (hint) progress.hints[round] = { A: hint.A, B: hint.B };
  }
  return progress;
}

/**
 * The duel against the server. The anonymous id goes in the `x-anon-id` header (and in the POST
 * bodies the routes require), never in a URL; every reply is checked against its zod schema, so a
 * reply that breaks the contract is an ApiError (`invalid`), not data. Errors keep their status
 * and `code`: 409 `day_over` means the day on screen has ended (useDuel loads the new one).
 */
export function createHttpDuelClient(opts: { anonId?: () => string; base?: string } = {}): DuelClient {
  const anonId = opts.anonId ?? getAnonId;
  const base = opts.base ?? '';
  return {
    source: 'api',
    async daily() {
      // The server's date wins: it names the set it served, and pick/hint must name that set.
      const res = await getJson(`${base}/api/daily?game=duel`, DuelDailyResponseSchema, { anonId: anonId() });
      return { date: res.date, duels: res.duels, progress: duelProgressFromWire(res.progress) };
    },
    async pick(round, choice, date) {
      const id = anonId();
      // `replayed` only says whether this request scored; the result is the same either way.
      const { replayed: _replayed, ...result } = await postJson(
        `${base}/api/daily/pick`, { anonId: id, date, round, choice }, PickReplySchema, { anonId: id },
      );
      return result;
    },
    async hint(round, date) {
      const id = anonId();
      // `recorded: false` (a repeat, or an ask after the pick) has the same text and no effect on the score.
      const { A, B } = await postJson(`${base}/api/daily/hint`, { anonId: id, date, round }, HintReplySchema, { anonId: id });
      return { A, B };
    },
    async challenge(resultId) {
      // A stored result's id is 32 hex characters: anything else (a fixture duel's link) is a
      // certain 404, so don't ask. No anonymous id goes along: the route does not need to know who asks.
      if (!ResultIdSchema.safeParse(resultId).success) return null;
      try {
        const { ok: _ok, ...challenge } = await getJson(
          `${base}/api/daily/challenge?c=${encodeURIComponent(resultId)}`, DuelChallengeResponseSchema,
        );
        return challenge;
      } catch (err) {
        if (err instanceof ApiError && err.status === 404 && !err.invalid) return null;
        throw err;
      }
    },
  };
}

// ----- source selection ----------------------------------------------------------------------------

/**
 * Loads the fixture duel client, or null in a duel API build. Next inlines NEXT_PUBLIC_DUEL_SOURCE
 * at build time, so with NEXT_PUBLIC_DUEL_SOURCE=api the bundler drops the import() branch and the
 * fixture duel client (and the sample duel cards it plays) gets no browser chunk. Keep the env read
 * inline (see ./client). CI builds a duel API app and checks its chunks (scripts/check-client-bundle.mjs).
 */
const loadFixtureDuelClient: (() => Promise<{ createFixtureDuelClient: () => DuelClient }>) | null =
  process.env.NEXT_PUBLIC_DUEL_SOURCE === 'api' ? null : () => import('./duelFixtureClient');

/** A client whose implementation loads on first use; a failed load is retried on the next call. */
export function lazyDuelClient(source: GameSource, load: () => Promise<DuelClient>): DuelClient {
  let pending: Promise<DuelClient> | null = null;
  const get = () =>
    (pending ??= load().catch((err: unknown) => {
      pending = null;
      throw err;
    }));
  return {
    source,
    daily: async (today) => (await get()).daily(today),
    pick: async (round, choice, date) => (await get()).pick(round, choice, date),
    hint: async (round, date) => (await get()).hint(round, date),
    challenge: async (resultId, today) => (await get()).challenge(resultId, today),
  };
}

export function createDuelClient(source: GameSource = duelSource()): DuelClient {
  if (source === 'api') return createHttpDuelClient();
  const load = loadFixtureDuelClient;
  if (!load) throw new Error('This build plays the server duel (NEXT_PUBLIC_DUEL_SOURCE=api); it has no fixture duel.');
  return lazyDuelClient('fixtures', async () => (await load()).createFixtureDuelClient());
}
