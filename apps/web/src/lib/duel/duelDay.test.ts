import { duelRoundPoints } from '@lifeguessr/engine';
import type { DuelRound } from '@lifeguessr/types';
import { describe, expect, it } from 'vitest';
import { duelTileColor, scoreDuelDay } from './duelDay';

const FULL = duelRoundPoints(0);
const HINTED = duelRoundPoints(1);
const pick = (round: DuelRound, correct: boolean, points: number) => ({ round, scored: { correct, points } });

describe('duelTileColor', () => {
  it('is green for a right pick, yellow for a right pick after a hint, ink for a miss', () => {
    expect(duelTileColor({ correct: true, points: FULL })).toBe('green');
    expect(duelTileColor({ correct: true, points: HINTED })).toBe('yellow');
    expect(duelTileColor({ correct: false, points: 0 })).toBe('ink');
  });
});

describe('scoreDuelDay', () => {
  it('adds up a finished day: right picks, points and one tile per round', () => {
    const day = scoreDuelDay([
      pick(1, true, HINTED), pick(2, true, FULL), pick(3, true, FULL), pick(4, false, 0), pick(5, false, 0),
    ]);
    expect(day).toEqual({ played: 5, right: 3, points: HINTED + 2 * FULL, tiles: ['yellow', 'green', 'green', 'ink', 'ink'] });
  });

  it('sorts the grid by round, whatever order the picks arrive in', () => {
    const day = scoreDuelDay([pick(3, false, 0), pick(1, true, FULL), pick(2, true, HINTED)]);
    expect(day.tiles).toEqual(['green', 'yellow', 'ink']);
  });

  it('counts only the rounds played so far, and an empty day is zero', () => {
    expect(scoreDuelDay([pick(2, true, FULL)])).toEqual({ played: 1, right: 1, points: FULL, tiles: ['green'] });
    expect(scoreDuelDay([])).toEqual({ played: 0, right: 0, points: 0, tiles: [] });
  });
});
