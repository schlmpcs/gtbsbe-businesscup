// Pure builders for the duel view-model (useDuel). Every amount comes from the source's PickResult
// (engine scoreDuelPick) or from engine helpers; here they are only arranged for display.
import { DUEL_ROUND_COUNT, duelBlindSpot, duelDifference, duelMultiplier, duelRoundPoints } from '@lifeguessr/engine';
import {
  DUEL_ROUNDS, type CostCategory, type DuelHint, type DuelLetter, type DuelRound, type PickResult, type PublicDuel,
  type Source,
} from '@lifeguessr/types';
import { duel as t } from '@/copy/duel';
import type { GameSource } from '@/lib/config';
import { shareImageUrls } from './derive';
import type { DuelProgress } from './duelClient';
import type {
  DuelCardVM, DuelCategoryVM, DuelDotVM, DuelHintVM, DuelRevealVM, DuelSummaryVM, DuelTileColor,
} from './types';

const other = (letter: DuelLetter): DuelLetter => (letter === 'A' ? 'B' : 'A');

/**
 * Green = right, yellow = right with a hint (fewer than full points), ink = missed. It reads only
 * `correct` and `points`, so the server's share card (server/game/shareCard.tsx) can color a
 * stored pick with the same rule the day result uses, and the two grids never disagree.
 */
export function duelTileColor(result: Pick<PickResult, 'correct' | 'points'>): DuelTileColor {
  if (!result.correct) return 'ink';
  return result.points < duelRoundPoints(0) ? 'yellow' : 'green';
}

/** The two cards of a round: public facts, the hint once open, totals and bars once picked. */
export function buildDuelCards(
  duel: PublicDuel,
  pick: { choice: DuelLetter; result: PickResult } | undefined,
  hint: DuelHint | undefined,
  picking: DuelLetter | null,
): [DuelCardVM, DuelCardVM] {
  const result = pick?.result;
  const scaleMax = result ? Math.max(result.totals.A, result.totals.B) : 0;
  const costlier = result ? duelDifference(result.totals).costlier : null;
  const card = (letter: DuelLetter): DuelCardVM => {
    const pub = duel.cards.find((c) => c.letter === letter)!;
    const categories: DuelCategoryVM[] = result
      ? result.breakdown[letter].map((l) => ({
          category: l.category,
          amount: l.amount,
          scale: scaleMax > 0 ? l.amount / scaleMax : 0,
          isEstimate: l.isEstimate,
          sources: l.sources,
        }))
      : [];
    const state: DuelCardVM['state'] = result
      ? costlier === letter || (costlier === null && pick!.choice === letter) ? 'winner' : 'other'
      : picking === letter ? 'picked' : 'round';
    return {
      letter,
      metro: pub.metro,
      household: pub.household,
      caption: pub.caption,
      facts: pub.facts,
      hintFact: hint ? hint[letter] : null,
      art: pub.art,
      composite: true,
      state,
      pickedByYou: pick?.choice === letter,
      total: result ? result.totals[letter] : null,
      categories,
    };
  };
  return [card('A'), card('B')];
}

/** The hint pill: used or not, and what a right pick is worth now and with one more hint. */
export function buildDuelHint(used: boolean, status: DuelHintVM['status']): DuelHintVM {
  const hints = used ? 1 : 0;
  const now = duelMultiplier(hints);
  const after = duelMultiplier(hints + 1);
  return {
    used,
    status,
    cost: Math.max(0, now - after),
    pointsNow: duelRoundPoints(hints),
    pointsWithHint: duelRoundPoints(hints + 1),
  };
}

/** Every distinct source behind both breakdowns, by category (first-seen order). */
function sourcesOf(result: PickResult): DuelRevealVM['sources'] {
  const out = new Map<CostCategory, Source[]>();
  for (const line of [...result.breakdown.A, ...result.breakdown.B]) {
    const list = out.get(line.category) ?? [];
    for (const s of line.sources) if (!list.some((x) => x.name === s.name && x.year === s.year)) list.push(s);
    out.set(line.category, list);
  }
  return [...out].map(([category, sources]) => ({ category, sources }));
}

export function buildDuelReveal(round: DuelRound, pick: { choice: DuelLetter; result: PickResult }): DuelRevealVM {
  const { result, choice } = pick;
  const { costlier, amount } = duelDifference(result.totals);
  const top = costlier ?? 'A';
  const crowd = result.crowd && result.crowd.total > 0
    ? (() => {
        const shareA = result.crowd.pickedA / result.crowd.total;
        return shareA >= 0.5
          ? { letter: 'A' as const, share: shareA, total: result.crowd.total }
          : { letter: 'B' as const, share: 1 - shareA, total: result.crowd.total };
      })()
    : null;
  return {
    round,
    choice,
    correct: result.correct,
    points: result.points,
    costlier,
    difference: amount,
    totals: result.totals,
    decidedBy: {
      category: result.decidedBy.category,
      amount: result.decidedBy[top],
      otherAmount: result.decidedBy[other(top)],
      otherLetter: other(top),
    },
    lesson: result.lesson,
    crowd,
    sources: sourcesOf(result),
    isLastRound: round === DUEL_ROUND_COUNT,
  };
}

/** Round dots: finished rounds in their tile color, the current one highlighted. */
export function buildDuelDots(picks: DuelProgress['picks'], current: DuelRound | null): DuelDotVM[] {
  return DUEL_ROUNDS.map((round) => {
    const pick = picks[round];
    if (round === current) return { round, state: 'current' };
    return { round, state: pick ? duelTileColor(pick.result) : 'upcoming' };
  });
}

/** Seconds from `now` to the next midnight in New York (when the next five go live). */
export function nextNewYorkMidnight(now: Date): { hours: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23',
  }).formatToParts(now);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const left = Math.max(0, 86_400 - (part('hour') * 3_600 + part('minute') * 60 + part('second')));
  return { hours: Math.floor(left / 3_600), minutes: Math.floor((left % 3_600) / 60) };
}

/** The day result once every round is picked. */
export function buildDuelSummary(
  date: string,
  picks: DuelProgress['picks'],
  origin: string,
  now: Date,
  source: GameSource,
): DuelSummaryVM | null {
  const played = DUEL_ROUNDS.map((round) => ({ round, pick: picks[round] }));
  if (played.some((p) => !p.pick)) return null;
  const tiles = played.map(({ round, pick }) => ({ round, color: duelTileColor(pick!.result) }));
  const right = played.filter((p) => p.pick!.result.correct).length;
  const totalPoints = played.reduce((s, p) => s + p.pick!.result.points, 0);
  const resultId = played[0]!.pick!.result.resultId;
  const challengeUrl = `${origin}/duel?c=${encodeURIComponent(resultId)}`;
  const missed = played.filter((p) => !p.pick!.result.correct).map((p) => p.pick!.result.decidedBy.category);
  const shareText = [
    t.share.header(date),
    tiles.map((tile) => t.share.tiles[tile.color]).join(''),
    t.share.score(right, played.length, totalPoints.toLocaleString('en-US')),
    challengeUrl,
  ].join('\n');
  return {
    right,
    rounds: played.length,
    totalPoints,
    maxPoints: played.length * duelRoundPoints(0),
    tiles,
    blindSpot: duelBlindSpot(missed),
    challengeUrl,
    shareText,
    // Only the server has the picks to draw the image from; a fixture duel's id means nothing there.
    shareImage: shareImageUrls(source, resultId),
    nextIn: nextNewYorkMidnight(now),
  };
}
