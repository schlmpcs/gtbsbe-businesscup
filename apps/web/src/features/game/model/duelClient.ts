// Duel game data source (S2/S3 "Which life costs more?"), behind one interface like the slider
// game's ./client:
// - fixtures (./duelFixtureClient): the contract computed in the browser from the sample cards with
//   the real engine (costOfLife + dailyDuelPairs + scoreDuelPick), so the duel plays without a server.
// - api: the server routes (GET /api/daily duel mode, POST /api/daily/pick, POST /api/daily/hint)
//   are not built yet (#110–#115); until they are, a duel API build answers "unavailable" instead
//   of shipping the fixture answers. The fixture client holds the answers, so this module never
//   imports it statically: see loadFixtureDuelClient.
// The duel has its own flag, NEXT_PUBLIC_DUEL_SOURCE (default fixtures), separate from
// NEXT_PUBLIC_GAME_SOURCE: production builds with GAME_SOURCE=api for the rest of the game and
// session plumbing and still plays the duel in the browser. When #115 lands the HTTP client
// replaces unavailableDuelClient and #120 sets NEXT_PUBLIC_DUEL_SOURCE=api.
import type { DuelHint, DuelLetter, DuelRound, PickResult, PublicDuel } from '@lifeguessr/types';
import { ApiError } from '@/lib/api/http';
import { duelSource, type GameSource } from '@/lib/config';

/** What the source already recorded for this player today: picks (with their results) and hints. */
export type DuelProgress = {
  picks: Partial<Record<DuelRound, { choice: DuelLetter; result: PickResult }>>;
  hints: Partial<Record<DuelRound, DuelHint>>;
};

/** A day's five duels and the player's progress on them. */
export type DuelDay = { date: string; duels: PublicDuel[]; progress: DuelProgress };

export interface DuelClient {
  readonly source: GameSource;
  /** Today's duels. `today` is the client's New York date; the source's date wins. */
  daily(today: string): Promise<DuelDay>;
  /** Pick the costlier life. One pick per round per day: a repeat answers the stored result. */
  pick(round: DuelRound, choice: DuelLetter, date: string): Promise<PickResult>;
  /** One more fact on both cards; the source records it (−10% points for the round). */
  hint(round: DuelRound, date: string): Promise<DuelHint>;
}

/**
 * Loads the fixture duel client, or null in a duel API build. Next inlines NEXT_PUBLIC_DUEL_SOURCE
 * at build time, so with NEXT_PUBLIC_DUEL_SOURCE=api the bundler drops the import() branch and the
 * fixture duel client gets no browser chunk. Keep the env read inline (see ./client).
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
  };
}

/** The API duel until its routes land (#115): every call answers 501, which the screen shows as "unavailable". */
function unavailableDuelClient(): DuelClient {
  const fail = () => Promise.reject(new ApiError('The duel routes are not built yet', 501));
  return { source: 'api', daily: fail, pick: fail, hint: fail };
}

export function createDuelClient(source: GameSource = duelSource()): DuelClient {
  if (source === 'api') return unavailableDuelClient();
  const load = loadFixtureDuelClient;
  if (!load) throw new Error('This build plays the server duel (NEXT_PUBLIC_DUEL_SOURCE=api); it has no fixture duel.');
  return lazyDuelClient('fixtures', async () => (await load()).createFixtureDuelClient());
}
