// Pure view-model builders for the game: reveal, share grid, clue multiplier. Every number comes
// from the engine's CostBreakdown / GuessResult; this file only arranges and labels them.
import { guessMaxPoints, scoreGuess } from '@lifeguessr/engine';
import type { CostBreakdown, GuessReveal, Money, PublicCard } from '@lifeguessr/types';
import { game as gameCopy } from '@/copy';
import type { GameSource } from '@/lib/config';
import { YELLOW_TILE_MIN_POINTS } from './constants';
import type { RevealVM, ShareTileColor, SummaryVM } from './types';

const UNIT_COST: CostBreakdown = { total: { low: 1, mid: 1, high: 1 }, items: [] };

/** The score multiplier for `opened` clues, from the engine's own scoring (one rule, one place). */
export function clueMultiplier(opened: number): number {
  return scoreGuess(1, UNIT_COST, opened).multiplier;
}

export function shareImageUrls(source: GameSource, resultId: string): { story: string; square: string } | null {
  if (source !== 'api') return null;
  const id = encodeURIComponent(resultId);
  return { story: `/api/share?resultId=${id}&format=9x16`, square: `/api/share?resultId=${id}&format=1x1` };
}

export function directionOf(guess: Money, total: CostBreakdown['total']): RevealVM['direction'] {
  if (guess < total.low) return 'low';
  if (guess > total.high) return 'high';
  return 'in';
}

export function buildReveal(r: GuessReveal, guess: Money, source: GameSource, isLastCard: boolean): RevealVM {
  const mid = r.cost.total.mid;
  const items = r.cost.items
    .map((i) => ({ category: i.category, amount: i.amount, share: mid > 0 ? i.amount / mid : 0, source: i.source, isEstimate: i.isEstimate }))
    .sort((a, b) => b.amount - a.amount);
  const top = items[0];
  return {
    cardId: r.card.id,
    resultId: r.resultId,
    guess,
    total: { ...r.cost.total },
    direction: directionOf(guess, r.cost.total),
    result: r.result,
    items,
    surprise: top && top.amount > 0 ? { category: top.category, share: top.share } : null,
    card: r.card,
    cluesOpened: r.cluesOpened,
    shareImage: shareImageUrls(source, r.resultId),
    isLastCard,
  };
}

export function tileColor(r: GuessReveal): ShareTileColor {
  if (r.result.inRange) return 'green';
  return r.result.points >= YELLOW_TILE_MIN_POINTS ? 'yellow' : 'red';
}

/** The share grid and bridge numbers for the cards played so far (in card order). */
export function buildSummary(
  date: string | null,
  cards: readonly PublicCard[],
  reveals: Record<string, GuessReveal>,
  guesses: Record<string, Money>,
  source: GameSource,
): SummaryVM {
  const played = cards.map((c) => reveals[c.id]).filter((r): r is GuessReveal => r !== undefined);
  const tiles = played.map((r) => ({ cardId: r.card.id, color: tileColor(r), points: r.result.points }));
  const totalPoints = played.reduce((s, r) => s + r.result.points, 0);
  const maxPoints = guessMaxPoints.value * cards.length;
  const dirs = played.map((r) => directionOf(guesses[r.card.id] ?? Number.NaN, r.cost.total));

  // Biggest miss = largest log error; ties keep the earlier card.
  let worst: GuessReveal | null = null;
  for (const r of played) if (!worst || r.result.logError > worst.result.logError) worst = r;

  const s = gameCopy.share;
  const shareText = [
    s.header(date ?? ''),
    tiles.map((t) => s.tiles[t.color]).join(''),
    s.score(totalPoints.toLocaleString('en-US'), maxPoints.toLocaleString('en-US')),
  ].join('\n');

  return {
    tiles,
    totalPoints,
    maxPoints,
    played: played.length,
    guessedLow: dirs.filter((d) => d === 'low').length,
    guessedHigh: dirs.filter((d) => d === 'high').length,
    inRange: dirs.filter((d) => d === 'in').length,
    shareText,
    mostSurprising: worst
      ? { cardId: worst.card.id, resultId: worst.resultId, shareImage: shareImageUrls(source, worst.resultId) }
      : null,
  };
}
