// Game data source with two implementations behind one interface:
// - http: the T5 routes (docs/ARCHITECTURE.md → Server routes). The server holds the answers,
//   records opened clues, scores the guess and keeps the one result per card.
// - fixtures: the same contract computed in the browser from the fixture cards with the real
//   engine (sceneOf + costOfLife + scoreGuess), so the game plays without a server.
// Pick one with NEXT_PUBLIC_GAME_SOURCE=fixtures|api (default fixtures; see lib/config).
import { costOfLife, sceneOf, scoreGuess } from '@lifeguessr/engine';
import type { ClueId, ClueReveal, GuessReveal, LifeCard, Money, PublicCard } from '@lifeguessr/types';
import { cardsSample } from '@/fixtures';
import {
  ClueRevealSchema, DailyResponseSchema, GuessReplySchema, type DailyProgress, type PlayedGuess,
} from '@/lib/api/gameSchemas';
import { ApiError, getJson, postJson } from '@/lib/api/http';
import { areaForZip } from '@/lib/areas';
import { gameSource, type GameSource } from '@/lib/config';
import { dayNumber } from '@/lib/dates';
import { readStorage, writeStorage } from '@/lib/safeStorage';
import { getAnonId } from '@/state/anonId';
import { CARDS_PER_DAY } from './constants';

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

// ----- fixtures ---------------------------------------------------------------------------------

/** The fixture "server" log (opened clues and results), kept per day so a reload can't reset clues. */
type FixtureLog = {
  date: string;
  cardIds: string[];
  clues: Record<string, ClueId[]>;
  results: Record<string, GuessReveal>;
  /** The amount each result scored. */
  guesses: Record<string, Money>;
};

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
        return { date, cardIds: saved.cardIds, clues: saved.clues ?? {}, results: saved.results ?? {}, guesses: saved.guesses ?? {} };
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
      // The day's log: this client's own (a second daily() is a reload), else the saved one.
      log = (log?.date === today ? log : null) ?? restore(today)
        ?? { date: today, cardIds: set.map((c) => c.id), clues: {}, results: {}, guesses: {} };
      save();
      const scenes = new Map(set.map((c) => {
        const area = areaForZip(c.zip);
        if (!area) throw new ApiError(`No fixture AreaData for ZIP ${c.zip}`, 404);
        return [c.id, sceneOf(c, area)] as const;
      }));
      const progress: DailyProgress = { clues: {}, guesses: {} };
      for (const [cardId, opened] of Object.entries(log.clues)) {
        const scene = scenes.get(cardId);
        if (scene) progress.clues[cardId] = opened.map((clue) => scene.clues[clue]);
      }
      for (const [cardId, reveal] of Object.entries(log.results)) {
        const guess = log.guesses[cardId];
        if (guess !== undefined) progress.guesses[cardId] = { guess, reveal };
      }
      return { date: today, cards: set.map((c) => scenes.get(c.id)!.public), progress };
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
      // One guess per card: repeat the stored result and the amount it scored.
      if (done) return { guess: log!.guesses[cardId] ?? guess, reveal: done };
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
      log!.guesses[cardId] = guess;
      save();
      return { guess, reveal };
    },
  };
}

export function createGameClient(source: GameSource = gameSource()): GameClient {
  return source === 'api' ? createHttpGameClient() : createFixtureGameClient();
}
