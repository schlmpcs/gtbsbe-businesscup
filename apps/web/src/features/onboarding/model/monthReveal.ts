// Chapter 3's big reveal: the chapter 2 guess against the month as it now stands in the profile
// (a statement, the sliders, or the typical month for the household), the gap in dollars and as a
// share of the guess, and where the month goes. The month is the ladder's (ownLife.monthlyCost:
// spending + minimum debt payments); nothing here is a new money number, only shares for bar widths.
import { COST_CATEGORIES, type CategoryTotals, type Money, type Profile } from '@lifeguessr/types';
import { useMemo } from 'react';
import { monthlyCost, spendingIsOwn, startingProfile } from '@/features/ladder/model/ownLife';
import { useAppStore, useProfile } from '@/state';
import type { MonthCategoryVM, MonthRevealVM } from './types';

/** Gaps under a dollar read as "spot on". */
const EXACT = 1;

export function monthReveal(
  guess: Money | null,
  profile: Profile,
  statementMonths: readonly CategoryTotals[],
  closestCardId: string | null,
): MonthRevealVM {
  const actual = monthlyCost(profile);
  const from: MonthRevealVM['from'] =
    statementMonths.length > 0 ? 'statement' : spendingIsOwn(profile, statementMonths, startingProfile(closestCardId)) ? 'sliders' : 'estimate';
  const debt = profile.debts.reduce((s, d) => s + d.minPayment.value, 0);
  const categories: MonthCategoryVM[] = COST_CATEGORIES.map((category) => ({
    category,
    amount: category === 'debtPayments' ? debt : profile.spending[category].value,
  }))
    .filter((c) => c.amount > 0)
    .map((c) => ({ ...c, share: actual > 0 ? c.amount / actual : 0 }))
    .sort((a, b) => b.amount - a.amount);

  const top = Math.max(actual, guess ?? 0);
  const difference = guess === null ? null : actual - guess;
  return {
    guess,
    actual,
    difference,
    differenceShare: guess === null || difference === null ? null : guess > 0 ? Math.abs(difference) / guess : null,
    direction: difference === null ? null : Math.abs(difference) < EXACT ? 'exact' : difference > 0 ? 'more' : 'less',
    guessShare: top > 0 && guess !== null ? guess / top : 0,
    actualShare: top > 0 ? actual / top : 0,
    isEstimate: from === 'estimate',
    from,
    categories,
  };
}

export function useMonthReveal(): MonthRevealVM {
  const guess = useAppStore((s) => s.selfGuess);
  const profile = useProfile();
  const statementMonths = useAppStore((s) => s.statementMonths);
  const closestCardId = useAppStore((s) => s.closestCardId);
  return useMemo(() => monthReveal(guess, profile, statementMonths, closestCardId), [guess, profile, statementMonths, closestCardId]);
}
