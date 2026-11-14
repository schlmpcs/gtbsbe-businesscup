// Y1 (Amir): guess scoring. Spec: docs/ENGINEERING.md → Guess scoring.
import type { CostBreakdown, GuessResult, Money } from '@lifeguessr/types';
import { clueCost, clueFloor, guessMaxPoints } from './assumptions';

/**
 * Score a monthly-cost guess against the card's range, with the clue multiplier applied.
 * In range → guessMaxPoints (1000) base points. Outside → measured in log space from the NEAREST edge (not the mid),
 * so the score is continuous at the edges and reaches 0 at 2× off the edge. A guess ≤ 0 (or not a
 * number) scores 0 with `logError: Infinity`. multiplier = max(clueFloor, 1 − clueCost × clues).
 */
export function scoreGuess(guess: Money, cost: CostBreakdown, cluesOpened: number): GuessResult {
  const clues = cluesOpened > 0 ? cluesOpened : 0; // NaN or negative counts as no clues
  const multiplier = Math.max(clueFloor.value, 1 - clueCost.value * clues);

  if (!(guess > 0)) {
    return { points: 0, basePoints: 0, multiplier, inRange: false, logError: Number.POSITIVE_INFINITY };
  }

  const { low, high } = cost.total;
  const inRange = guess >= low && guess <= high;
  const logError = inRange ? 0 : Math.abs(Math.log(guess / (guess < low ? low : high)));
  const max = guessMaxPoints.value;
  const basePoints = inRange ? max : Math.max(0, Math.round(max * (1 - logError / Math.LN2)));

  return { points: Math.round(basePoints * multiplier), basePoints, multiplier, inRange, logError };
}
