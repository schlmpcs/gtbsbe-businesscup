// Game data source with two implementations behind one interface:
// - http: the T5 routes (docs/ARCHITECTURE.md → Server routes). The server holds the answers,
//   records opened clues and scores the guess.
// - fixtures: the same contract computed in the browser from the fixture cards with the real
//   engine (sceneOf + costOfLife + scoreGuess), so the game is playable before T5 lands.
// Pick one with NEXT_PUBLIC_GAME_SOURCE=fixtures|api (default fixtures; see lib/config).
import { costOfLife, sceneOf, scoreGuess } from '@lifeguessr/engine';
import type { ClueId, ClueReveal, GuessReveal, LifeCard, Money, PublicCard } from '@lifeguessr/types';
import { cardsSample } from '@/fixtures';
import { ClueRevealSchema, DailyResponseSchema, GuessRevealSchema } from '@/lib/api/gameSchemas';
import { ApiError, getJson, postJson } from '@/lib/api/http';
import { areaForZip } from '@/lib/areas';
import { gameSource, type GameSource } from '@/lib/config';
import { dayNumber } from '@/lib/dates';
import { readStorage, writeStorage } from '@/lib/safeStorage';
import { getAnonId } from '@/state/anonId';
import { CARDS_PER_DAY } from './constants';

export type DailySet = { date: string; cards: PublicCard[] };

export interface GameClient {
  readonly source: GameSource;
  /** Today's public cards. `today` is the client's US Eastern date; the server's date wins. */
  daily(today: string): Promise<DailySet>;
  /** Open a clue room; the source records it (it lowers the score multiplier). */
  clue(cardId: string, clue: ClueId): Promise<ClueReveal>;
  /** Score a guess (monthly dollars) and reveal the card. One guess per card per day. */
  guess(cardId: string, guess: Money): Promise<GuessReveal>;
}

// ----- http (T5) ------------------------------------------------------------------------------

export function createHttpGameClient(opts: { anonId?: () => string; base?: string } = {}): GameClient {
  const anonId = opts.anonId ?? getAnonId;
  const base = opts.base ?? '';
  return {
    source: 'api',
    async daily(today) {
      const res = await getJson(`${base}/api/daily`, DailyResponseSchema, { anonId: anonId() });
      return { date: res.date ?? today, cards: res.cards };
    },
    clue(cardId, clue) {
      const id = anonId();
      return postJson(`${base}/api/daily/clue`, { anonId: id, cardId, clue }, ClueRevealSchema, { anonId: id });
    },
    guess(cardId, guess) {
      const id = anonId();
      return postJson(`${base}/api/daily/guess`, { anonId: id, cardId, guess }, GuessRevealSchema, { anonId: id });
    },
  };
}

// ----- fixtures ---------------------------------------------------------------------------------

/** The fixture "server" log (opened clues and results), kept per day so a reload can't reset clues. */
type FixtureLog = { date: string; cardIds: string[]; clues: Record<string, ClueId[]>; results: Record<string, GuessReveal> };

export const FIXTURE_LOG_KEY = 'lifeguessr.fixtureGame';

/** The day's cards: `count` consecutive fixture cards starting at a date-seeded offset. */
export function fixtureDailyCards(date: string, cards: readonly LifeCard[] = cardsSample, count = CARDS_PER_DAY): LifeCard[] {
  if (cards.length === 0) return [];
  const start = ((dayNumber(date) % cards.length) + cards.length) % cards.length;
  return Array.from({ length: Math.min(count, cards.length) }, (_, i) => cards[(start + i) % cards.length]!);
}

export function createFixtureGameClient(opts: { cards?: readonly LifeCard[]; persist?: boolean } = {}): GameClient {
  const cards = opts.cards ?? cardsSample;
  const persist = opts.persist ?? true;
  let log: FixtureLog | null = null;

  const save = () => {
    if (persist && log) writeStorage(FIXTURE_LOG_KEY, JSON.stringify(log));
  };
  const restore = (date: string): FixtureLog | null => {
    if (!persist) return null;
    try {
      const saved = JSON.parse(readStorage(FIXTURE_LOG_KEY) ?? 'null') as FixtureLog | null;
      if (saved && saved.date === date && Array.isArray(saved.cardIds)) {
        // Results went through JSON: Infinity became null.
        for (const r of Object.values(saved.results ?? {})) r.result.logError ??= Number.POSITIVE_INFINITY;
        return { date, cardIds: saved.cardIds, clues: saved.clues ?? {}, results: saved.results ?? {} };
      }
    } catch {
      // corrupt log: start the day fresh
    }
    return null;
  };

  const resolve = (cardId: string) => {
    if (!log || !log.cardIds.includes(cardId)) throw new ApiError(`Card ${cardId} is not in today's set`, 404);
    const card = cards.find((c) => c.id === cardId);
    const area = card ? areaForZip(card.zip) : null;
    if (!card || !area) throw new ApiError(`No fixture data for card ${cardId}`, 404);
    return { card, area };
  };

  return {
    source: 'fixtures',
    async daily(today) {
      const set = fixtureDailyCards(today, cards);
      log = restore(today) ?? { date: today, cardIds: set.map((c) => c.id), clues: {}, results: {} };
      save();
      return {
        date: today,
        cards: set.map((c) => {
          const area = areaForZip(c.zip);
          if (!area) throw new ApiError(`No fixture AreaData for ZIP ${c.zip}`, 404);
          return sceneOf(c, area).public;
        }),
      };
    },
    async clue(cardId, clue) {
      const { card, area } = resolve(cardId);
      const opened = log!.clues[cardId] ?? [];
      // Like the server: clues opened after the guess don't change the score.
      if (!log!.results[cardId] && !opened.includes(clue)) log!.clues[cardId] = [...opened, clue];
      save();
      return sceneOf(card, area).clues[clue];
    },
    async guess(cardId, guess) {
      const { card, area } = resolve(cardId);
      const done = log!.results[cardId];
      if (done) return done; // one guess per card: repeat the stored result
      const cluesOpened = log!.clues[cardId] ?? [];
      const cost = costOfLife(card, area);
      const reveal: GuessReveal = {
        resultId: `fixture-${log!.date}-${cardId}`,
        cost,
        result: scoreGuess(guess, cost, cluesOpened.length),
        card,
        cluesOpened,
      };
      log!.results[cardId] = reveal;
      save();
      return reveal;
    },
  };
}

export function createGameClient(source: GameSource = gameSource()): GameClient {
  return source === 'api' ? createHttpGameClient() : createFixtureGameClient();
}
