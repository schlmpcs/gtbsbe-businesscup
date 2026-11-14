// S5 Guess yourself: the user's guess of their own monthly cost, on the same slider as the game,
// then the guess next to the engine's monthly cost for the current profile.
import { COST_CATEGORIES, type Money, type Profile } from '@lifeguessr/types';
import { useCallback, useMemo, useState } from 'react';
import { GUESS_DEFAULT, GUESS_MAX, GUESS_MIN, GUESS_STEP } from '@/features/game/model/constants';
import { directionOf } from '@/features/game/model/derive';
import { track } from '@/lib/events';
import { thisMonth } from '@/lib/model/profile';
import { logScale, logSliderVM, snap } from '@/lib/model/slider';
import { useAppReady, useAppStore, useGameStore, type ProfileOrigin } from '@/state';
import type { GuessYourselfVM, SelfGuessComparisonVM } from './types';

const scale = logScale(GUESS_MIN, GUESS_MAX);
const clamp = (v: Money) => snap(v, GUESS_MIN, GUESS_MAX, GUESS_STEP);
/** A guess within $1 of the estimate counts as a match (it shows as the same whole-dollar amount). */
const MATCH_TOLERANCE = 1;

/**
 * The self guess against the engine's monthly cost of `profile`: this month's spending + debt
 * payments (the same number S7 shows as "your month"). Tagged as an estimate when any spending
 * category or minimum payment behind it is one.
 */
export function compareSelfGuess(guess: Money, profile: Profile, basis: ProfileOrigin): SelfGuessComparisonVM {
  const month = thisMonth(profile);
  const estimate = month.spending + month.debtPayments;
  const difference = guess - estimate;
  const isEstimate =
    COST_CATEGORIES.some((c) => c !== 'debtPayments' && profile.spending[c].isEstimate) ||
    profile.debts.some((d) => d.minPayment.isEstimate);
  const direction = Math.abs(difference) < MATCH_TOLERANCE ? 'match' : difference > 0 ? 'above' : 'below';
  return {
    guess, estimate, isEstimate, basis, difference,
    differenceShare: estimate > 0 ? difference / estimate : 0,
    direction,
  };
}

export function useGuessYourself(): GuessYourselfVM {
  const ready = useAppReady();
  const savedGuess = useAppStore((s) => s.selfGuess);
  const setSelfGuess = useAppStore((s) => s.setSelfGuess);
  const profile = useAppStore((s) => s.profile);
  const profileOrigin = useAppStore((s) => s.profileOrigin);
  const cards = useGameStore((s) => s.cards);
  const reveals = useGameStore((s) => s.reveals);
  const guesses = useGameStore((s) => s.guesses);

  // Local slider value until submitted; starts at the saved guess (or the track's middle).
  const [draft, setDraft] = useState<Money | null>(null);
  const value = draft ?? (savedGuess !== null ? clamp(savedGuess) : GUESS_DEFAULT);

  const setGuess = useCallback((v: Money) => setDraft(clamp(v)), []);
  const setGuessPosition = useCallback((p: number) => setDraft(clamp(scale.fromPosition(p))), []);
  const submit = useCallback(() => {
    setSelfGuess(value);
    track({ name: 'own_guess_submitted' }, { once: 'own_guess_submitted' });
  }, [setSelfGuess, value]);

  const comparison = useMemo(
    () => (savedGuess === null ? null : compareSelfGuess(savedGuess, profile, profileOrigin)),
    [savedGuess, profile, profileOrigin],
  );

  const bridge = useMemo(() => {
    const played = cards.filter((c) => reveals[c.id]);
    if (played.length === 0) return null;
    const dirs = played.map((c) => directionOf(guesses[c.id] ?? Number.NaN, reveals[c.id]!.cost.total));
    return {
      played: played.length,
      guessedLow: dirs.filter((d) => d === 'low').length,
      guessedHigh: dirs.filter((d) => d === 'high').length,
    };
  }, [cards, reveals, guesses]);

  return {
    status: ready ? 'ready' : 'loading',
    guess: logSliderVM(value, GUESS_MIN, GUESS_MAX, GUESS_STEP),
    savedGuess,
    comparison,
    bridge,
    setGuess,
    setGuessPosition,
    submit,
  };
}
