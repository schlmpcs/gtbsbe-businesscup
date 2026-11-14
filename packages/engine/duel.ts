// The duel game (S2/S3 "Which life costs more?", decision D-1): the daily pairing, the pick score,
// what decided each round and the day's blind spot. Pure and deterministic: the date seeds the
// pairing, no clock and no randomness. Totals come from costOfLife; this module only compares them.
// The engine returns no user-facing strings: lessons and blind spots are ids the UI maps to copy.
import {
  COST_CATEGORIES,
  type CategoryLine, type CostBreakdown, type CostCategory, type DuelLetter, type DuelRound, type Money, type Rate,
} from '@lifeguessr/types';
import { clueCost, clueFloor, duelMinGap, guessMaxPoints } from './assumptions';

/** Rounds in a day's duel set. */
export const DUEL_ROUND_COUNT = 5;

/** A life that can enter today's duels: its id and its monthly total (costOfLife(card).total.mid). */
export type DuelCandidate = { id: string; total: Money };

/** One round of the day: which life is A and which is B, and how far apart they are. */
export type DuelPair = {
  round: DuelRound;
  A: string;
  B: string;
  /** |total A − total B| / the larger total (0–1). Shrinks from round 1 (easy) to round 5 (close). */
  gap: Rate;
};

// ----- seeded randomness (deterministic: same date → same numbers) -----------------------------

/** FNV-1a 32-bit hash of a string. */
function hash32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: a small seeded generator of numbers in [0, 1). */
function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** Relative gap between two monthly totals: |a − b| / max(a, b). */
export function duelGap(a: Money, b: Money): Rate {
  const top = Math.max(a, b);
  return top > 0 ? Math.abs(a - b) / top : 0;
}

/**
 * Today's duel pairs: `rounds` pairs of lives, the same for everyone on `date` ('YYYY-MM-DD', New
 * York). Every pair of candidates at least `duelMinGap` apart is ranked by its gap, widest first,
 * and cut into `rounds` bands; round k takes one pair from band k, so the gap shrinks from an easy
 * round 1 to a close round 5. Within a band the date picks the pair (preferring lives not shown yet
 * that day) and which life is A. The input order does not matter. Throws if there are not enough
 * distinct pairs.
 */
export function dailyDuelPairs(
  date: string,
  candidates: readonly DuelCandidate[],
  rounds: number = DUEL_ROUND_COUNT,
): DuelPair[] {
  if (!ISO_DATE.test(date)) throw new Error(`dailyDuelPairs: expected a YYYY-MM-DD date, got ${JSON.stringify(date)}`);
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > DUEL_ROUND_COUNT) {
    throw new Error(`dailyDuelPairs: rounds must be 1–${DUEL_ROUND_COUNT}, got ${rounds}`);
  }
  const lives = [...new Map(candidates.filter((c) => Number.isFinite(c.total) && c.total > 0).map((c) => [c.id, c])).values()]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const pairs: { a: DuelCandidate; b: DuelCandidate; gap: Rate }[] = [];
  for (let i = 0; i < lives.length; i++) {
    for (let j = i + 1; j < lives.length; j++) {
      const gap = duelGap(lives[i]!.total, lives[j]!.total);
      if (gap >= duelMinGap.value) pairs.push({ a: lives[i]!, b: lives[j]!, gap });
    }
  }
  if (pairs.length < rounds) {
    throw new Error(`dailyDuelPairs: ${pairs.length} pairs at least ${duelMinGap.value} apart; ${rounds} rounds need ${rounds}`);
  }
  // Widest gap first; ties by ids so the order never depends on the input.
  pairs.sort((x, y) => y.gap - x.gap || (x.a.id + x.b.id < y.a.id + y.b.id ? -1 : 1));

  const random = seededRandom(hash32(`duel:${date}`));
  const shown = new Set<string>();
  const out: DuelPair[] = [];
  for (let k = 0; k < rounds; k++) {
    const band = pairs.slice(Math.floor((k * pairs.length) / rounds), Math.floor(((k + 1) * pairs.length) / rounds));
    const fresh = band.filter((p) => !shown.has(p.a.id) && !shown.has(p.b.id));
    const halfFresh = band.filter((p) => !shown.has(p.a.id) || !shown.has(p.b.id));
    const pool = fresh.length > 0 ? fresh : halfFresh.length > 0 ? halfFresh : band;
    const pick = pool[Math.floor(random() * pool.length)]!;
    shown.add(pick.a.id).add(pick.b.id);
    const swap = random() < 0.5;
    out.push({
      round: (k + 1) as DuelRound,
      A: swap ? pick.b.id : pick.a.id,
      B: swap ? pick.a.id : pick.b.id,
      gap: pick.gap,
    });
  }
  return out;
}

// ----- one pick ------------------------------------------------------------------------------

/** A cost breakdown added up per category (monthly), largest first; ties in COST_CATEGORIES order. */
export function duelCategoryLines(cost: CostBreakdown): CategoryLine[] {
  const byCategory = new Map<CostCategory, CategoryLine>();
  for (const item of cost.items) {
    const line = byCategory.get(item.category) ?? { category: item.category, amount: 0, sources: [], isEstimate: false };
    line.amount += item.amount;
    line.isEstimate ||= item.isEstimate;
    if (!line.sources.some((s) => s.name === item.source.name && s.year === item.source.year)) line.sources.push(item.source);
    byCategory.set(item.category, line);
  }
  const order = (c: CostCategory) => COST_CATEGORIES.indexOf(c);
  return [...byCategory.values()].sort((a, b) => b.amount - a.amount || order(a.category) - order(b.category));
}

/** Score multiplier after `hints` hints: −clueCost per hint, never below clueFloor (same tuning as clues). */
export function duelMultiplier(hints: number): number {
  const n = hints > 0 ? hints : 0;
  return Math.max(clueFloor.value, 1 - clueCost.value * n);
}

/** Points a right pick scores after `hints` hints: guessMaxPoints × duelMultiplier, rounded. */
export function duelRoundPoints(hints: number): number {
  return Math.round(guessMaxPoints.value * duelMultiplier(hints));
}

/** The costlier life of a pair (null when the totals are equal) and how much more it costs a month. */
export function duelDifference(totals: Record<DuelLetter, Money>): { costlier: DuelLetter | null; amount: Money } {
  if (totals.A === totals.B) return { costlier: null, amount: 0 };
  return totals.A > totals.B ? { costlier: 'A', amount: totals.A - totals.B } : { costlier: 'B', amount: totals.B - totals.A };
}

/** Lesson ids (copy: duel.lessons). One per category, plus childcare that tops the same home's rent. */
export type DuelLessonId = CostCategory | 'childcareOverRent';

export type DuelPickScore = {
  correct: boolean;
  /** Null when both cost the same (then either pick counts as right). */
  costlier: DuelLetter | null;
  /** Points for this round: guessMaxPoints × multiplier when right, else 0. */
  points: number;
  multiplier: number;
  /** Points a right pick with no hint scores (the per-round maximum). */
  maxPoints: number;
  /** Monthly totals (costOfLife total.mid). */
  totals: Record<DuelLetter, Money>;
  breakdown: Record<DuelLetter, CategoryLine[]>;
  /** The category with the biggest gap toward the costlier life, and what each life spends on it (monthly). */
  decidedBy: { category: CostCategory; A: Money; B: Money };
  lesson: DuelLessonId;
};

/**
 * Score one duel pick. Right = the picked life is the costlier one (by total.mid). Points =
 * guessMaxPoints × duelMultiplier(hintsUsed), rounded; 0 when wrong. `decidedBy` = the category
 * where the costlier life outspends the other the most (ties: COST_CATEGORIES order); with equal
 * totals, the category with the biggest gap either way.
 */
export function scoreDuelPick(
  costs: Record<DuelLetter, CostBreakdown>,
  choice: DuelLetter,
  hintsUsed: number,
): DuelPickScore {
  const totals = { A: costs.A.total.mid, B: costs.B.total.mid };
  const { costlier } = duelDifference(totals);
  const correct = costlier === null || costlier === choice;
  const multiplier = duelMultiplier(hintsUsed);
  const maxPoints = guessMaxPoints.value;
  const breakdown = { A: duelCategoryLines(costs.A), B: duelCategoryLines(costs.B) };

  const amountOf = (letter: DuelLetter, category: CostCategory) =>
    breakdown[letter].find((l) => l.category === category)?.amount ?? 0;
  let best: { category: CostCategory; gap: number } | null = null;
  for (const category of COST_CATEGORIES) {
    const a = amountOf('A', category);
    const b = amountOf('B', category);
    if (a === 0 && b === 0) continue;
    const gap = costlier === 'A' ? a - b : costlier === 'B' ? b - a : Math.abs(a - b);
    if (best === null || gap > best.gap) best = { category, gap };
  }
  const category = best?.category ?? 'rentUtilities';
  const decidedBy = { category, A: amountOf('A', category), B: amountOf('B', category) };

  const top = costlier ?? (decidedBy.A >= decidedBy.B ? 'A' : 'B');
  const lesson: DuelLessonId =
    category === 'childcare' && decidedBy[top] > amountOf(top, 'rentUtilities') ? 'childcareOverRent' : category;

  return {
    correct,
    costlier,
    points: correct ? duelRoundPoints(hintsUsed) : 0,
    multiplier,
    maxPoints,
    totals,
    breakdown,
    decidedBy,
    lesson,
  };
}

/**
 * The day's blind spot: the category that decided the most missed rounds (ties: the earliest
 * missed). Null when nothing was missed.
 */
export function duelBlindSpot(missedDecidedBy: readonly CostCategory[]): CostCategory | null {
  const counts = new Map<CostCategory, number>();
  for (const c of missedDecidedBy) counts.set(c, (counts.get(c) ?? 0) + 1);
  let best: CostCategory | null = null;
  for (const c of missedDecidedBy) if (best === null || counts.get(c)! > counts.get(best)!) best = c;
  return best;
}
