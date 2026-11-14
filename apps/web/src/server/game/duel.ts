// Server-only: the day's duels (DU1, "Which life costs more?"). Which 5 pairs of lives a US Eastern
// calendar day plays, what the browser may see of them before a pick, the hint for each round, and
// how a pick is scored. Every number comes from the engine (costOfLife, dailyDuelPairs,
// scoreDuelPick) and the card catalog; the routes (GET /api/daily?game=duel, POST /api/daily/hint,
// POST /api/daily/pick) only move it around. The duel's twin of ./daily (the slider's daily set).
//
// The day: the same New York calendar date as the slider. The routes resolve it with playDate /
// resolvePlayDate / DAY_GRACE_MS from ./daily (one date rule for both games); this module takes
// the resolved 'YYYY-MM-DD'. The date seeds the pairing, so every player gets the same five duels.
//
// What the browser sees of a life is built by @/lib/duel/publicDuelCard, the same builder the
// fixture duel client uses, so fixture and API builds show byte-identical cards.
import { getArea } from '@lifeguessr/data/areas';
import { lifeCards } from '@lifeguessr/data/cards';
import { costOfLife, dailyDuelPairs, duelDifference, scoreDuelPick, type DuelCandidate } from '@lifeguessr/engine';
import type {
  CostBreakdown, DuelHint, DuelLetter, DuelRound, LifeCard, PickResult, PublicDuel, Rate,
} from '@lifeguessr/types';
import { duel as t } from '@/copy/duel';
import { hintOf, publicDuelCard } from '@/lib/duel/publicDuelCard';

/** One round of the day with its two lives. Server only: the cards hold the answer. */
export type DuelPair = {
  round: DuelRound;
  A: LifeCard;
  B: LifeCard;
  /** |total A − total B| / the larger total (0–1); shrinks from round 1 to round 5. */
  gap: Rate;
};

/**
 * A scored pick: PickResult without `resultId` and `crowd`, which the store (one id per player
 * per day) and the pick route (live crowd counts) add. The store keeps it exactly as answered.
 */
export type DuelScored = Omit<PickResult, 'resultId' | 'crowd'>;

/** Scores a pick with the number of hints the store recorded for that round. Pure. */
export type DuelScorer = (hintsRecorded: number) => DuelScored;

/**
 * The lives that play duels: the same pool as the slider's daily set, i.e. every catalog card
 * that is not in a creator pack, in catalog order.
 *
 * Creator-pack cards stay out (decision, DU1): a pack is a creator's curated run of five lives
 * (packCards), played as a set with its own order and story, and it never enters the slider's
 * daily rotation either. Mixing pack lives into the daily duels would spoil a creator's pack for
 * anyone who played the duel first, and would make the duel pool differ from the slider's for no
 * gain: the 50 daily cards already give 1,000+ pairs a day to choose from. If packs should ever
 * play as duels, that is a pack duel mode with its own pairing, not this pool.
 */
export const duelPool: readonly LifeCard[] = Object.freeze(lifeCards.filter((card) => card.pack === undefined));

// costOfLife is deterministic and the catalog is frozen, so each card's breakdown is derived once
// per process (50 cards), like derive() in ./daily.
const costs = new Map<string, CostBreakdown>();

function costOf(card: LifeCard): CostBreakdown {
  let cost = costs.get(card.id);
  if (!cost) {
    cost = costOfLife(card, getArea(card.zip));
    costs.set(card.id, cost);
  }
  return cost;
}

let candidates: readonly DuelCandidate[] | null = null;

/** The pool as the engine's pairing input: each life's id and monthly total (costOfLife total.mid). */
export function duelCandidates(): readonly DuelCandidate[] {
  candidates ??= Object.freeze(duelPool.map((card) => Object.freeze({ id: card.id, total: costOf(card).total.mid })));
  return candidates;
}

/**
 * Dates whose duel set is kept in memory. Two dates are live at once around midnight (yesterday's
 * set stays open for DAY_GRACE_MS); the rest is headroom for share and challenge reads of recent days.
 */
const SET_MEMO_DATES = 4;
const sets = new Map<string, readonly DuelPair[]>();
const byId = new Map(duelPool.map((card) => [card.id, card]));

/** The day's five pairs in round order (easy → close), the same for every player. Throws on a malformed date. */
export function duelSet(date: string): readonly DuelPair[] {
  const memo = sets.get(date);
  if (memo) return memo;
  const set = Object.freeze(
    dailyDuelPairs(date, duelCandidates()).map((p) =>
      Object.freeze({ round: p.round, A: byId.get(p.A)!, B: byId.get(p.B)!, gap: p.gap }),
    ),
  );
  if (sets.size >= SET_MEMO_DATES) sets.delete(sets.keys().next().value!);
  sets.set(date, set);
  return set;
}

/** What the browser sees of the day's duels before any pick: words and art only, no answer. */
export function publicDuels(date: string): PublicDuel[] {
  return duelSet(date).map((pair) => ({
    date,
    round: pair.round,
    kind: 'life',
    cards: [publicDuelCard(pair.A, 'A'), publicDuelCard(pair.B, 'B')],
  }));
}

/** A round of that day's set, or null when the day has no such round. */
export function findDuelPair(date: string, round: number): DuelPair | null {
  return duelSet(date).find((pair) => pair.round === round) ?? null;
}

/** The round's hint: one more fact per life, its neighborhood tier in words. */
export function duelHint(pair: DuelPair): DuelHint {
  return { A: hintOf(getArea(pair.A.zip)), B: hintOf(getArea(pair.B.zip)) };
}

/**
 * The scorer for one pick, for the store to run inside its transaction with the hints IT recorded
 * (never a count from the client). Throws now, before anything is stored, if the two lives cost
 * the same: dailyDuelPairs never pairs them (duelMinGap), and a pick without a right answer must
 * fail loudly rather than score a silent winner.
 */
export function duelScorer(pair: DuelPair, choice: DuelLetter): DuelScorer {
  const cost = { A: costOf(pair.A), B: costOf(pair.B) };
  if (duelDifference({ A: cost.A.total.mid, B: cost.B.total.mid }).costlier === null) {
    throw new Error(`duelScorer: round ${pair.round} pairs two lives that cost the same (${pair.A.id}, ${pair.B.id})`);
  }
  return (hintsRecorded) => {
    if (!Number.isInteger(hintsRecorded) || hintsRecorded < 0) {
      throw new RangeError(`duelScorer: hintsRecorded must be a whole number ≥ 0, got ${hintsRecorded}`);
    }
    const score = scoreDuelPick(cost, choice, hintsRecorded);
    return {
      correct: score.correct,
      points: score.points,
      totals: score.totals,
      breakdown: score.breakdown,
      decidedBy: score.decidedBy,
      lesson: t.lessons[score.lesson],
    };
  };
}
