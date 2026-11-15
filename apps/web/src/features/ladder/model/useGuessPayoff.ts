// The S5 guess ("What do you think your month costs?") paid off wherever the month becomes known: on S9
// once a statement is applied, and on S8 (the last step before the forecast). The month is the profile's
// (spending + minimum debt payments, ownLife.monthlyCost); nothing here is a new number.
import type { CategoryTotals, Money, Profile } from '@lifeguessr/types';
import { useMemo } from 'react';
import { useAppStore, useProfile } from '@/state';
import { monthlyCost, OWN_LIFE_CARD_ID, spendingIsOwn, startingProfile } from './ownLife';
import type { GuessPayoffVM } from './types';

/**
 * The guess against the month. Measured once the spending is the person's own (a statement or typed
 * categories); an estimate while it is the typical month built for their own household (About you).
 * null without a guess, or while the spending is a sample family's (nothing of theirs to compare with).
 */
export function guessPayoff(
  guess: Money | null,
  profile: Profile,
  statementMonths: readonly CategoryTotals[],
  closestCardId: string | null,
): GuessPayoffVM | null {
  if (guess === null) return null;
  const own = spendingIsOwn(profile, statementMonths, startingProfile(closestCardId));
  if (!own && closestCardId !== OWN_LIFE_CARD_ID) return null;
  const actual = monthlyCost(profile);
  return { guess, actual, difference: actual - guess, isEstimate: !own };
}

export function useGuessPayoff(): GuessPayoffVM | null {
  const guess = useAppStore((s) => s.selfGuess);
  const profile = useProfile();
  const statementMonths = useAppStore((s) => s.statementMonths);
  const closestCardId = useAppStore((s) => s.closestCardId);
  return useMemo(
    () => guessPayoff(guess, profile, statementMonths, closestCardId),
    [guess, profile, statementMonths, closestCardId],
  );
}
