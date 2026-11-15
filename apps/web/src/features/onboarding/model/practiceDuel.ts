// Chapter 1's practice duel: three "Which life costs more?" rounds played in the browser, never the
// daily five. They use the sample lives (packages/data/fixtures/cards.ts, shown openly elsewhere as
// "sample lives", and sharing no card with the API duel's catalog), so practice spoils nothing and
// scores nothing on the server. Every number is the engine's: the pairs (dailyDuelPairs on a fixed
// practice seed, easy → close), the totals and what decided the round (costOfLife + scoreDuelPick).
// The only new math is the guess error, |guess − actual| / actual, kept here and tested.
//
// It loads the sample cards, so it is listed in SAMPLE_CARD_MODULES (eslint.config.mjs).
import { costOfLife, dailyDuelPairs, duelDifference, scoreDuelPick } from '@lifeguessr/engine';
import type { CostBreakdown, DuelLetter, LifeCard, Money, Rate } from '@lifeguessr/types';
import { cardsSample } from '@/fixtures/cards';
import { areaForZip } from '@/lib/areas';
import { publicDuelCard } from '@/lib/duel/publicDuelCard';
import type { PracticeArt, PracticeBarVM, PracticeCardVM, PracticeResultVM, PracticeSummaryVM } from './types';

/** Practice rounds in chapter 1. */
export const PRACTICE_ROUNDS = 3;
/** The seed of the practice pairs: a fixed date, so every visitor practices on the same three pairs. */
export const PRACTICE_SEED_DATE = '2000-01-01';
/** Category bars shown per revealed card. */
export const PRACTICE_BARS = 4;

export type PracticePair = {
  round: number;
  cards: Record<DuelLetter, LifeCard>;
  costs: Record<DuelLetter, CostBreakdown>;
};

/** The practice pairs (engine dailyDuelPairs on the sample lives with a fixed seed). */
export function practicePairs(cards: readonly LifeCard[] = cardsSample, rounds = PRACTICE_ROUNDS): PracticePair[] {
  const priced = cards.flatMap((card) => {
    const area = areaForZip(card.zip);
    return area ? [{ card, cost: costOfLife(card, area) }] : [];
  });
  const byId = new Map(priced.map((p) => [p.card.id, p]));
  return dailyDuelPairs(PRACTICE_SEED_DATE, priced.map((p) => ({ id: p.card.id, total: p.cost.total.mid })), rounds).map((p) => {
    const a = byId.get(p.A)!;
    const b = byId.get(p.B)!;
    return { round: p.round, cards: { A: a.card, B: b.card }, costs: { A: a.cost, B: b.cost } };
  });
}

/** House cutout from the facts the card shows (bedrooms, kids, car), never from the cost. */
export function practiceArt(card: LifeCard): PracticeArt {
  if (card.bedrooms >= 4) return 'home-large';
  if (card.kids.length > 0) return card.car ? 'home-family' : 'home-cottage';
  if (card.bedrooms <= 1) return card.car ? 'home-apartment' : 'home-apartment-nocar';
  return 'home-suburb';
}

/** |guess − actual| / actual: how far off a guess was (0 = spot on). */
export function guessError(guess: Money, actual: Money): Rate {
  if (!(actual > 0) || !Number.isFinite(guess)) return 1;
  return Math.abs(guess - actual) / actual;
}

/** Score one practice round: the engine's pick score, plus how far the number for the picked life was. */
export function scorePractice(pair: PracticePair, choice: DuelLetter, guess: Money): PracticeResultVM {
  const score = scoreDuelPick(pair.costs, choice, 0);
  const actual = score.totals[choice];
  return {
    round: pair.round,
    correct: score.correct,
    guess,
    actual,
    error: guessError(guess, actual),
    low: guess < actual,
    decidedBy: score.decidedBy.category,
    gap: duelDifference(score.totals).amount,
  };
}

/** The chapter's line: the average error over the rounds played, and how many picks were right. */
export function practiceSummary(results: readonly PracticeResultVM[]): PracticeSummaryVM {
  const n = results.length;
  const averageError = n > 0 ? results.reduce((s, r) => s + r.error, 0) / n : 0;
  const low = results.filter((r) => r.low).length;
  return {
    averageError,
    right: results.filter((r) => r.correct).length,
    rounds: results.map((r) => ({ ...r })),
    mostlyLow: low > n - low,
  };
}

/** One card of a pair; totals and bars only once revealed. */
export function practiceCard(pair: PracticePair, letter: DuelLetter, opts: { revealed: boolean; picked: boolean }): PracticeCardVM {
  const pub = publicDuelCard(pair.cards[letter], letter);
  const base: PracticeCardVM = {
    letter,
    household: pub.household,
    metro: pub.metro,
    caption: pub.caption,
    facts: pub.facts,
    art: practiceArt(pair.cards[letter]),
    total: null,
    totalShare: null,
    bars: [],
    costlier: false,
    picked: opts.picked,
  };
  if (!opts.revealed) return base;
  const score = scoreDuelPick(pair.costs, letter, 0);
  const top = Math.max(score.totals.A, score.totals.B);
  const bars: PracticeBarVM[] = score.breakdown[letter]
    .slice(0, PRACTICE_BARS)
    .map((l) => ({ category: l.category, amount: l.amount, share: top > 0 ? l.amount / top : 0 }));
  return {
    ...base,
    total: score.totals[letter],
    totalShare: top > 0 ? score.totals[letter] / top : 0,
    bars,
    costlier: score.costlier === letter,
  };
}
