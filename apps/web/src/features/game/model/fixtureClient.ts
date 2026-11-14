// The fixture game: the GameClient contract computed in the browser from the sample cards with the
// real engine (sceneOf + costOfLife + scoreGuess), so the game plays without a server.
//
// It holds the answers (the cards), so it is its own module and only ./client loads it, with a
// dynamic import() behind the build-time NEXT_PUBLIC_GAME_SOURCE flag: an API build
// (NEXT_PUBLIC_GAME_SOURCE=api) has no chunk for it at all. Don't import it statically from browser
// code; an ESLint rule (eslint.config.mjs) and a CI check of the built chunks
// (apps/web/scripts/check-client-bundle.mjs) hold that.
import { costOfLife, sceneOf, scoreGuess } from '@lifeguessr/engine';
import type { ClueId, GuessReveal, LifeCard, Money } from '@lifeguessr/types';
import { cardsSample } from '@/fixtures/cards';
import type { DailyProgress } from '@/lib/api/gameSchemas';
import { ApiError } from '@/lib/api/http';
import { areaForZip } from '@/lib/areas';
import { dayNumber } from '@/lib/dates';
import { readStorage, writeStorage } from '@/lib/safeStorage';
import type { GameClient } from './client';
import { CARDS_PER_DAY } from './constants';

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
