// Server-only: the daily set (T5). Which 5 cards a US Eastern calendar day plays, what the
// browser may see of them before a guess, what a clue reveals, and how a guess is scored. Every
// number comes from the engine (sceneOf, costOfLife, scoreGuess) and the card catalog; the routes
// only move it around.
//
// The day: the calendar date in America/New_York (DST-aware through Intl), so the set rolls over
// at US Eastern midnight for everyone, whatever the server's or the player's time zone. Its
// integer day number picks the cards (`dailyCards`), so every player gets the same 5 homes.
import { getArea } from '@lifeguessr/data/areas';
import { dailyCards } from '@lifeguessr/data/cards';
import { costOfLife, sceneOf, scoreGuess } from '@lifeguessr/engine';
import type { ClueId, ClueReveal, CostBreakdown, LifeCard, Money, PublicCard } from '@lifeguessr/types';
import { dayNumber, usEasternDate } from '@/lib/dates';
import type { GuessScorer } from '@/server/store/game';

/**
 * After US Eastern midnight, requests that name the previous day's set are still accepted for
 * this long, so a player who loaded the set at 11:58 PM can finish the home on screen. After it,
 * they answer 409 day_over and the browser loads the new set.
 */
export const DAY_GRACE_MS = 30 * 60 * 1000;

/** Today's set date, 'YYYY-MM-DD' in US Eastern time. */
export function playDate(now: Date = new Date()): string {
  return usEasternDate(now);
}

/**
 * The set a clue or guess plays: `requested` (the date the browser got from GET /api/daily) when
 * it is today's, or yesterday's within DAY_GRACE_MS of midnight; today's when none was sent.
 */
export function resolvePlayDate(
  requested: string | undefined,
  now: Date = new Date(),
): { ok: true; date: string } | { ok: false; today: string } {
  const today = playDate(now);
  if (requested === undefined || requested === today) return { ok: true, date: today };
  if (requested === playDate(new Date(now.getTime() - DAY_GRACE_MS))) return { ok: true, date: requested };
  return { ok: false, today };
}

/** The day's 5 cards, in play order (easy → curveball). Server only: they hold the answers. */
export function dailySet(date: string): LifeCard[] {
  return dailyCards(dayNumber(date));
}

/** A card of that day's set, or null when the id is not in it. */
export function findDailyCard(date: string, cardId: string): LifeCard | null {
  return dailySet(date).find((c) => c.id === cardId) ?? null;
}

type Derived = { scene: ReturnType<typeof sceneOf>; cost: CostBreakdown };

// sceneOf and costOfLife are deterministic and the catalog is frozen, so each card is derived
// once per process (60 cards at most).
const derived = new Map<string, Derived>();

function derive(card: LifeCard): Derived {
  let d = derived.get(card.id);
  if (!d) {
    const area = getArea(card.zip);
    d = { scene: sceneOf(card, area), cost: costOfLife(card, area) };
    derived.set(card.id, d);
  }
  return d;
}

/** What the browser sees before guessing: no costs, no card fields behind the clues. */
export function publicCards(date: string): PublicCard[] {
  return dailySet(date).map((card) => derive(card).scene.public);
}

/** The room a clue opens: its props and the facts behind them. */
export function clueReveal(card: LifeCard, clue: ClueId): ClueReveal {
  return derive(card).scene.clues[clue];
}

/** Scores `guess` against the card's cost range with the clues the store recorded. */
export function scorerFor(card: LifeCard, guess: Money): GuessScorer {
  return (cluesOpened) => {
    const { cost } = derive(card);
    return { cost, result: scoreGuess(guess, cost, cluesOpened.length), card };
  };
}
