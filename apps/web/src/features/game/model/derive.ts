// Pure view-model builders for the game: reveal, share grid, clue multiplier. Every number comes
// from the engine's CostBreakdown / GuessResult; this file only arranges and labels them.
import { guessMaxPoints, scoreGuess } from '@lifeguessr/engine';
import {
  CLUE_IDS,
  type ClueId, type ClueReveal, type CostBreakdown, type GuessReveal, type LifeCard, type Money, type PublicCard,
  type Source,
} from '@lifeguessr/types';
import { game as gameCopy } from '@/copy';
import type { GameSource } from '@/lib/config';
import { logScale } from '@/lib/model/slider';
import { GUESS_MAX, GUESS_MIN, YELLOW_TILE_MIN_POINTS } from './constants';
import type {
  CategoryCostVM, ClueFactVM, CostItemVM, DayVM, RevealScaleVM, RevealVM, ShareTileColor, SummaryVM,
} from './types';

const UNIT_COST: CostBreakdown = { total: { low: 1, mid: 1, high: 1 }, items: [] };

/** The score multiplier for `opened` clues, from the engine's own scoring (one rule, one place). */
export function clueMultiplier(opened: number): number {
  return scoreGuess(1, UNIT_COST, opened).multiplier;
}

/** Drop float noise from a difference of multipliers (0.9 − 0.8 → 0.1, not 0.09999999999999998). */
const cleanRate = (x: number) => Math.round(x * 1e9) / 1e9;

/** Share of the full score the next clue costs, from the current and next multipliers. */
export function clueCostOf(multiplier: number, nextMultiplier: number): number {
  return Math.max(0, cleanRate(multiplier - nextMultiplier));
}

/** The facts one clue room shows, from its ClueReveal.facts (missing fields are skipped). */
export function clueFacts(clue: ClueId, facts: ClueReveal['facts']): ClueFactVM[] {
  switch (clue) {
    case 'garage':
      return [
        facts.car
          ? {
              kind: 'car',
              price: facts.car.price,
              financed: facts.car.price > facts.car.downPayment,
              termMonths: facts.car.termMonths,
              apr: facts.car.apr,
            }
          : { kind: 'noCar' },
      ];
    case 'kidsRoom':
      return facts.kids ? [{ kind: 'kids', ages: [...facts.kids] }] : [];
    case 'kitchen':
      return facts.eatingOutPerWeek !== undefined ? [{ kind: 'eatingOut', perWeek: facts.eatingOutPerWeek }] : [];
    case 'entry':
      return facts.adults !== undefined ? [{ kind: 'household', adults: facts.adults, kids: facts.kids?.length ?? 0 }] : [];
    case 'mailbox':
      return facts.zip !== undefined ? [{ kind: 'zip', zip: facts.zip, tier: facts.tier ?? null }] : [];
  }
}

/** Every fact of a revealed card, in clue order (no area tier: the card does not carry it). */
export function cardFacts(card: LifeCard): ClueFactVM[] {
  const facts: ClueReveal['facts'] = {
    ...(card.car ? { car: card.car } : {}),
    kids: card.kids,
    eatingOutPerWeek: card.eatingOutPerWeek,
    adults: card.adults,
    zip: card.zip,
  };
  return CLUE_IDS.flatMap((clue) => clueFacts(clue, facts));
}

const sameSource = (a: Source, b: Source) => a.name === b.name && a.year === b.year && a.url === b.url;

/** Cost lines added up per category (largest first; ties keep the first line's order). */
export function aggregateCategories(items: readonly CostItemVM[], mid: Money): CategoryCostVM[] {
  const byCategory = new Map<CostItemVM['category'], CategoryCostVM>();
  for (const item of items) {
    const row = byCategory.get(item.category);
    if (!row) {
      byCategory.set(item.category, {
        category: item.category, amount: item.amount, share: 0, isEstimate: item.isEstimate, sources: [item.source],
      });
      continue;
    }
    row.amount += item.amount;
    row.isEstimate ||= item.isEstimate;
    if (!row.sources.some((s) => sameSource(s, item.source))) row.sources.push(item.source);
  }
  return [...byCategory.values()]
    .map((row) => ({ ...row, share: mid > 0 ? row.amount / mid : 0 }))
    .sort((a, b) => b.amount - a.amount);
}

/** The guess and the range on one log track spanning the slider, widened to fit both. */
export function revealScale(guess: Money, total: CostBreakdown['total']): RevealScaleVM {
  const positive = [guess, total.low, total.mid, total.high].filter((v) => Number.isFinite(v) && v > 0);
  const min = Math.min(GUESS_MIN, ...positive);
  const max = Math.max(GUESS_MAX, ...positive);
  const track = logScale(min, max);
  return {
    min,
    max,
    low: track.toPosition(total.low),
    mid: track.toPosition(total.mid),
    high: track.toPosition(total.high),
    guess: track.toPosition(guess),
  };
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
  const items: CostItemVM[] = r.cost.items
    .map((i) => ({ category: i.category, amount: i.amount, share: mid > 0 ? i.amount / mid : 0, source: i.source, isEstimate: i.isEstimate }))
    .sort((a, b) => b.amount - a.amount);
  const categories = aggregateCategories(items, mid);
  const top = categories[0];
  return {
    cardId: r.card.id,
    resultId: r.resultId,
    guess,
    total: { ...r.cost.total },
    direction: directionOf(guess, r.cost.total),
    missBy: Math.abs(guess - mid),
    result: r.result,
    maxPoints: guessMaxPoints.value,
    scale: revealScale(guess, r.cost.total),
    items,
    categories,
    surprise: top && top.amount > 0 ? { category: top.category, share: top.share } : null,
    card: r.card,
    cardFacts: cardFacts(r.card),
    cluesOpened: r.cluesOpened,
    shareImage: shareImageUrls(source, r.resultId),
    isLastCard,
  };
}

/** Today's running score and strip: points per guessed home, the current one marked. */
export function buildDay(cards: readonly PublicCard[], reveals: Record<string, GuessReveal>, index: number): DayVM {
  const homes = cards.map((c, i) => ({ cardId: c.id, points: reveals[c.id]?.result.points ?? null, current: i === index }));
  return {
    maxPerHome: guessMaxPoints.value,
    totalPoints: homes.reduce((s, h) => s + (h.points ?? 0), 0),
    homes,
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
