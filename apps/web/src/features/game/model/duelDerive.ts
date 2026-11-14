// Pure builders for the duel view-model (useDuel). Every amount comes from the source's PickResult
// (engine scoreDuelPick) or from engine helpers; here they are only arranged for display.
import { DUEL_ROUND_COUNT, duelBlindSpot, duelDifference, duelMultiplier, duelRoundPoints } from '@lifeguessr/engine';
import {
  DUEL_ROUNDS, type CostCategory, type DuelHint, type DuelLetter, type DuelRound, type PickResult, type PublicDuel,
  type Source,
} from '@lifeguessr/types';
import { duel as t } from '@/copy/duel';
import type { GameSource } from '@/lib/config';
import { duelTileColor } from '@/lib/duel/duelDay';
import { shareImageUrls } from './derive';
import type { DuelChallenge, DuelProgress } from './duelClient';
import type {
  ChallengeVM, DuelCardVM, DuelCategoryVM, DuelDotVM, DuelHintVM, DuelOutcome, DuelRevealVM, DuelScoreVM, DuelSummaryVM,
} from './types';

const other = (letter: DuelLetter): DuelLetter => (letter === 'A' ? 'B' : 'A');

/**
/**
 * The letter a scored result belongs to: the costlier life when the pick was right, the other one
 * when it was wrong. A source answers a repeated pick of a round with the FIRST pick's result, even
 * when the repeat named the other letter (a second tab, a stale page), so the view shows this
 * letter, not the one just tapped. Null only for a tie, which no scored pick has.
 */
export function choiceOf(result: PickResult): DuelLetter | null {
  const { costlier } = duelDifference(result.totals);
  if (!costlier) return null;
  return result.correct ? costlier : other(costlier);
}

// The tile colour rule lives in lib/duel/duelDay (shared with the server's share card and challenge
// reply, so every grid is coloured the same way); re-exported here for the callers that had it.
export { duelTileColor };

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

/** Every source once (same name and year = one), in the order the categories list them. */
export function uniqueSources(byCategory: DuelRevealVM['sources']): Source[] {
  const list: Source[] = [];
  for (const { sources } of byCategory) {
    for (const s of sources) if (!list.some((x) => x.name === s.name && x.year === s.year)) list.push(s);
  }
  return list;
}

/**
 * The reveal's crowd line from the server's counts: the letter most players picked (A on an exact
 * tie) and its share, already rounded to the whole percent the line shows, so the UI only formats
 * it ("61% picked A, from 214 picks").
 *
 * The rounding rule: the share of the majority letter, in whole percent, rounded half up, worked
 * out from the integer counts (100 × picked / total, so 121 of 200 is exactly 60.5 and shows 61%;
 * dividing first would give 0.605, which a double stores as 0.60499…, and Intl would show 60%).
 * One exception: it never says 100% while anyone picked the other life (1,999 of 2,000 shows 99%,
 * not 100%), because "100% picked A" reads as "everyone", and that would not be true.
 *
 * Null when there is nothing to show; the server already answers null below DUEL_CROWD_MIN_PICKS.
 */
export function buildDuelCrowd(crowd: NonNullable<PickResult['crowd']>): DuelRevealVM['crowd'] {
  const { pickedA, total } = crowd;
  if (total <= 0 || pickedA < 0 || pickedA > total) return null; // not a count we can show honestly
  const letter: DuelLetter = 2 * pickedA >= total ? 'A' : 'B';
  const picked = letter === 'A' ? pickedA : total - pickedA;
  const percent = Math.min(Math.round((100 * picked) / total), picked < total ? 99 : 100);
  return { letter, share: percent / 100, total };
}

export function buildDuelReveal(round: DuelRound, pick: { choice: DuelLetter; result: PickResult }): DuelRevealVM {
  const { result, choice } = pick;
  const { costlier, amount } = duelDifference(result.totals);
  const top = costlier ?? 'A';
  const crowd = result.crowd ? buildDuelCrowd(result.crowd) : null;
  const sources = sourcesOf(result);
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
    sources,
    allSources: uniqueSources(sources),
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

// ----- challenge links (/duel?c=…) -------------------------------------------------------------------

/** What you scored on the day result, as the comparison lays it next to a friend's. */
const scoreOfSummary = (summary: DuelSummaryVM): DuelScoreVM => ({
  right: summary.right,
  rounds: summary.rounds,
  points: summary.totalPoints,
  tiles: summary.tiles,
});

/** What a friend's challenge says, one tile per round (it only counts once all the rounds are in). */
const scoreOfChallenge = (challenge: DuelChallenge): DuelScoreVM => ({
  right: challenge.right,
  rounds: challenge.rounds,
  points: challenge.points,
  tiles: challenge.tiles.map((color, i) => ({ round: (i + 1) as DuelRound, color })),
});

/**
 * Who is ahead: more right picks win; on the same number the one with more points (a hint costs 10%
 * of a round, so with equal right picks the player who used fewer hints is ahead); the same on both
 * is a tie. Both scores are the stored ones; nothing is re-scored.
 */
export function duelOutcome(you: DuelScoreVM, friend: DuelScoreVM): DuelOutcome {
  if (you.right !== friend.right) return you.right > friend.right ? 'ahead' : 'behind';
  if (you.points !== friend.points) return you.points > friend.points ? 'ahead' : 'behind';
  return 'tied';
}

const dayLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** A play date ('YYYY-MM-DD') as "Nov 14". The date is a calendar day, not an instant: read in UTC. */
export function challengeDateLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return dayLabel.format(new Date(Date.UTC(y!, m! - 1, d!)));
}

/**
 * What a challenge link says on this screen. `friend` is what the source answered for the link's id
 * (null: no such day); `date` is the day on screen and `picks` what this player did on it.
 *
 * - Your own link (one of today's stored results carries this id) is your result, never a comparison.
 *   It is checked first: the day is yours whatever the source says about it.
 * - A day the source does not hold, or one still being played, is no score to beat: null, and the
 *   screen falls back to the generic line.
 * - A challenge from another day than the one on screen is `earlier`. Both must agree: the source's
 *   `today` (its clock) and the date of the five on screen, so a comparison only ever sets two
 *   scores on the same five duels.
 * - Otherwise the friend's score; with your own once all five are picked (`summary`).
 */
export function buildDuelChallenge(
  friend: DuelChallenge | null,
  ctx: { challengeId: string; date: string; picks: DuelProgress['picks']; summary: DuelSummaryVM | null },
): ChallengeVM | null {
  if (DUEL_ROUNDS.some((round) => ctx.picks[round]?.result.resultId === ctx.challengeId)) return { kind: 'own' };
  if (!friend) return null;
  if (!friend.today || friend.date !== ctx.date) return { kind: 'earlier', dateLabel: challengeDateLabel(friend.date) };
  if (friend.played < friend.rounds) return null;
  const theirs = scoreOfChallenge(friend);
  if (!ctx.summary) return { kind: 'friend', friend: theirs, comparison: null };
  const yours = scoreOfSummary(ctx.summary);
  return { kind: 'friend', friend: theirs, comparison: { you: yours, outcome: duelOutcome(yours, theirs) } };
}
