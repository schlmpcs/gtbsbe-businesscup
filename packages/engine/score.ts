// Y1 (Amir): guess scoring. Spec: docs/ENGINEERING.md → Guess scoring.
/* eslint-disable @typescript-eslint/no-unused-vars -- signatures are fixed; Y1 replaces the bodies */
import type { CostBreakdown, GuessResult, Money } from '@lifeguessr/types';
import { notImplemented } from './errors';

/** Score a monthly-cost guess against the card's range, with the clue multiplier applied. */
export function scoreGuess(guess: Money, cost: CostBreakdown, cluesOpened: number): GuessResult {
  throw notImplemented('Y1');
}
