// Game data source with two implementations behind one interface:
// - http: the T5 routes (docs/ARCHITECTURE.md → Server routes). The server holds the answers,
//   records opened clues, scores the guess and keeps the one result per card.
// - fixtures (./fixtureClient): the same contract computed in the browser from the fixture cards
//   with the real engine (sceneOf + costOfLife + scoreGuess), so the game plays without a server.
// Pick one with NEXT_PUBLIC_GAME_SOURCE=fixtures|api (default fixtures; see lib/config). The fixture
// client holds the answers, so this module never imports it statically: see loadFixtureClient.
import type { ClueId, ClueReveal, Money, PublicCard } from '@lifeguessr/types';
import {
  ClueRevealSchema, DailyResponseSchema, GuessReplySchema, type DailyProgress, type PlayedGuess,
} from '@/lib/api/gameSchemas';
import { getJson, postJson } from '@/lib/api/http';
import { gameSource, type GameSource } from '@/lib/config';
import { getAnonId } from '@/state/anonId';

export type { DailyProgress, PlayedGuess } from '@/lib/api/gameSchemas';

/**
 * A day's set. `progress` is what the source already recorded for this player that day (clues
 * opened, guesses scored), so the browser can show exactly what will be counted; null when the
 * source sent none.
 */
export type DailySet = { date: string; cards: PublicCard[]; progress: DailyProgress | null };

export interface GameClient {
  readonly source: GameSource;
  /** Today's public cards. `today` is the client's US Eastern date; the server's date wins. */
  daily(today: string): Promise<DailySet>;
  /**
   * Open a clue room; the source records it (it lowers the score multiplier). `date` is the set's
   * date (from daily()), so a request sent just after midnight still plays the set on screen.
   */
  clue(cardId: string, clue: ClueId, date?: string | null): Promise<ClueReveal>;
  /**
   * Score a guess (monthly dollars) and reveal the card. One guess per card per day: a repeat
   * answers the stored result, with the amount that was scored then.
   */
  guess(cardId: string, guess: Money, date?: string | null): Promise<PlayedGuess>;
}

// ----- http (T5) ------------------------------------------------------------------------------

export function createHttpGameClient(opts: { anonId?: () => string; base?: string } = {}): GameClient {
  const anonId = opts.anonId ?? getAnonId;
  const base = opts.base ?? '';
  /** The set's date from the last daily() reply: sent with clues and guesses that name none. */
  let setDate: string | null = null;
  const dated = (date: string | null | undefined) => {
    const d = date ?? setDate;
    return d ? { date: d } : {};
  };
  return {
    source: 'api',
    async daily(today) {
      const res = await getJson(`${base}/api/daily`, DailyResponseSchema, { anonId: anonId() });
      setDate = res.date;
      return { date: res.date ?? today, cards: res.cards, progress: res.progress };
    },
    clue(cardId, clue, date) {
      const id = anonId();
      return postJson(`${base}/api/daily/clue`, { anonId: id, cardId, clue, ...dated(date) }, ClueRevealSchema, { anonId: id });
    },
    async guess(cardId, guess, date) {
      const id = anonId();
      const { guess: scored, replayed: _replayed, ...reveal } = await postJson(
        `${base}/api/daily/guess`, { anonId: id, cardId, guess, ...dated(date) }, GuessReplySchema, { anonId: id },
      );
      return { guess: scored, reveal };
    },
  };
}

// ----- source selection --------------------------------------------------------------------------

/**
 * Loads the fixture game client, or null in an API build. Next inlines NEXT_PUBLIC_GAME_SOURCE at
 * build time, so in a build with NEXT_PUBLIC_GAME_SOURCE=api the test below is the constant
 * `"api" === "api"` and the bundler drops the import() branch: ./fixtureClient and the sample cards
 * it plays (the fixture game's answers) get no browser chunk at all. Keep the env read inline here;
 * behind a function call the bundler could not see the constant. CI builds in API mode and checks
 * the chunks (apps/web/scripts/check-client-bundle.mjs).
 */
const loadFixtureClient: (() => Promise<{ createFixtureGameClient: () => GameClient }>) | null =
  process.env.NEXT_PUBLIC_GAME_SOURCE === 'api' ? null : () => import('./fixtureClient');

/** A client whose implementation loads on first use; a failed load (e.g. a chunk error) is retried on the next call. Exported for tests. */
export function lazyGameClient(source: GameSource, load: () => Promise<GameClient>): GameClient {
  let pending: Promise<GameClient> | null = null;
  const get = () =>
    (pending ??= load().catch((err: unknown) => {
      pending = null;
      throw err;
    }));
  return {
    source,
    daily: async (today) => (await get()).daily(today),
    clue: async (cardId, clue, date) => (await get()).clue(cardId, clue, date),
    guess: async (cardId, guess, date) => (await get()).guess(cardId, guess, date),
  };
}

export function createGameClient(source: GameSource = gameSource()): GameClient {
  if (source === 'api') return createHttpGameClient();
  const load = loadFixtureClient;
  if (!load) throw new Error('This build plays the server game (NEXT_PUBLIC_GAME_SOURCE=api); it has no fixture game.');
  return lazyGameClient('fixtures', async () => (await load()).createFixtureGameClient());
}
