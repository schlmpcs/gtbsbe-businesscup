// How a duel day is scored for display: the tile of a round, and the right picks, points and grid
// of a day. Pure, and shared by every place that colours a grid: the browser's day result
// (features/game/model/duelDerive.ts), the server's share card (server/game/shareCard.tsx), the
// server's challenge reply (GET /api/daily/challenge) and the fixture duel's own challenge answer.
// One rule here means your grid, the share image and a friend's grid on your screen never disagree.
import { duelRoundPoints } from '@lifeguessr/engine';
import type { DuelRound, PickResult } from '@lifeguessr/types';
import type { DuelTileColor } from '@/copy/duel';

/**
 * Green = right, yellow = right with a hint (fewer than full points), ink = missed. It reads only
 * `correct` and `points`, so a stored pick (server) and a result shown to the player (browser) are
 * coloured by the same rule.
 */
export function duelTileColor(result: Pick<PickResult, 'correct' | 'points'>): DuelTileColor {
  if (!result.correct) return 'ink';
  return result.points < duelRoundPoints(0) ? 'yellow' : 'green';
}

/** What a day's scored picks add up to. `tiles` has one colour per played round, in round order. */
export type DuelDayScore = { played: number; right: number; points: number; tiles: DuelTileColor[] };

/**
 * The score of the picks a day holds so far. Every pick already carries the verdict and points it
 * was scored with, so nothing is re-scored here. Rounds may be picked in any order and a store may
 * hand them back in any order: the grid is sorted by round.
 */
export function scoreDuelDay(picks: readonly { round: DuelRound; scored: Pick<PickResult, 'correct' | 'points'> }[]): DuelDayScore {
  const byRound = [...picks].sort((a, b) => a.round - b.round);
  return {
    played: byRound.length,
    right: byRound.filter((p) => p.scored.correct).length,
    points: byRound.reduce((sum, p) => sum + p.scored.points, 0),
    tiles: byRound.map((p) => duelTileColor(p.scored)),
  };
}
