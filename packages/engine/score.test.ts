// Y1: scoreGuess. Expected numbers are worked out by hand from ENGINEERING.md → Guess scoring:
//   basePoints = max(0, round(1000 × (1 − |ln(guess / nearest edge)| / ln 2))), clueCost 0.1, clueFloor 0.5.
import { describe, expect, it } from 'vitest';
import type { CostBreakdown } from '@lifeguessr/types';
import { clueCost, clueFloor, guessMaxPoints } from './assumptions';
import { scoreGuess } from './score';

const range = (low: number, mid: number, high: number): CostBreakdown => ({ total: { low, mid, high }, items: [] });
const COST = range(3000, 3500, 4000);

describe('scoreGuess', () => {
  it('uses the tuning the hand-checked numbers assume', () => {
    expect(guessMaxPoints.value).toBe(1000);
    expect(clueCost.value).toBe(0.1);
    expect(clueFloor.value).toBe(0.5);
  });

  it('scores 1000 anywhere in the range, edges included', () => {
    for (const guess of [3000, 3200, 3500, 4000]) {
      expect(scoreGuess(guess, COST, 0)).toEqual({
        points: 1000, basePoints: 1000, multiplier: 1, inRange: true, logError: 0,
      });
    }
  });

  it('is continuous at the range edges: 0.1% outside scores ~1000, not ~800', () => {
    // |ln 1.001| / ln 2 = 0.0014420 → round(998.558) = 999
    const above = scoreGuess(4000 * 1.001, COST, 0);
    expect(above.inRange).toBe(false);
    expect(above.logError).toBeCloseTo(Math.log(1.001), 12);
    expect(above.points).toBe(999);
    const below = scoreGuess(3000 / 1.001, COST, 0);
    expect(below.logError).toBeCloseTo(Math.log(1.001), 12);
    expect(below.points).toBe(999);
  });

  it('measures from the nearest edge in log space: a 10% miss scores the same on $3K and $9K', () => {
    // ln 1.1 / ln 2 = 0.1375035 → round(862.496) = 862
    expect(scoreGuess(4400, COST, 0).basePoints).toBe(862);
    expect(scoreGuess(9900, range(8000, 8500, 9000), 0).basePoints).toBe(862);
    expect(scoreGuess(3000 / 1.1, COST, 0).basePoints).toBe(862);
  });

  it('scores 0 at 2× off the nearest edge and never goes negative', () => {
    expect(scoreGuess(8000, COST, 0)).toMatchObject({ points: 0, basePoints: 0, inRange: false });
    expect(scoreGuess(1500, COST, 0)).toMatchObject({ points: 0, basePoints: 0, inRange: false });
    expect(scoreGuess(1500, COST, 0).logError).toBeCloseTo(Math.LN2, 12);
    expect(scoreGuess(40_000, COST, 0).basePoints).toBe(0);
  });

  it('scores 0 for a guess ≤ 0 or not a number', () => {
    for (const guess of [0, -1, -3500, Number.NaN]) {
      const r = scoreGuess(guess, COST, 0);
      expect(r).toMatchObject({ points: 0, basePoints: 0, inRange: false });
      expect(r.logError).toBe(Number.POSITIVE_INFINITY);
    }
  });

  it('applies the clue multiplier and floors it at clueFloor', () => {
    expect(scoreGuess(3500, COST, 1)).toMatchObject({ multiplier: 0.9, points: 900 });
    expect(scoreGuess(3500, COST, 2).points).toBe(800);
    expect(scoreGuess(4400, COST, 3)).toMatchObject({ basePoints: 862, points: 603 }); // round(862 × 0.7 = 603.4)
    expect(scoreGuess(3500, COST, 5)).toMatchObject({ multiplier: 0.5, points: 500 });
    expect(scoreGuess(3500, COST, 9)).toMatchObject({ multiplier: 0.5, points: 500 }); // 1 − 0.9 = 0.1 → floor
    expect(scoreGuess(0, COST, 2).multiplier).toBeCloseTo(0.8, 12);
  });

  it('treats a negative or NaN clue count as no clues', () => {
    expect(scoreGuess(3500, COST, -2).multiplier).toBe(1);
    expect(scoreGuess(3500, COST, Number.NaN).multiplier).toBe(1);
  });

  it('never rises as the guess moves away from the range', () => {
    let prev = 1000;
    for (let guess = 4000; guess <= 9000; guess += 50) {
      const { basePoints } = scoreGuess(guess, COST, 0);
      expect(basePoints).toBeLessThanOrEqual(prev);
      prev = basePoints;
    }
    prev = 1000;
    for (let guess = 3000; guess >= 1000; guess -= 50) {
      const { basePoints } = scoreGuess(guess, COST, 0);
      expect(basePoints).toBeLessThanOrEqual(prev);
      prev = basePoints;
    }
  });
});
