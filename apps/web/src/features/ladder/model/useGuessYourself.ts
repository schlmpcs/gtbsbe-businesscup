// S5 Guess yourself: only the gut guess of the user's own monthly cost, on the same slider as the
// game. Nothing to compare it with until the spending is the user's own (a statement or typed
// categories): only then the reveal, "You guessed $X. You actually spend $Y".
import type { CategoryTotals, Money, Profile } from '@lifeguessr/types';
import { useCallback, useMemo, useState } from 'react';
import { GUESS_DEFAULT, GUESS_MAX, GUESS_MIN, GUESS_STEP } from '@/features/game/model/constants';
import { directionOf } from '@/features/game/model/derive';
import { gameMode, type GameMode } from '@/lib/config';
import { track } from '@/lib/events';
import { logScale, logSliderVM, snap } from '@/lib/model/slider';
import { useAppReady, useAppStore, useProfile, useGameStore } from '@/state';
import { monthlyCost, spendingIsOwn, startingProfile } from './ownLife';
import type { GuessYourselfVM, SelfGuessRevealVM } from './types';

const scale = logScale(GUESS_MIN, GUESS_MAX);
const clamp = (v: Money) => snap(v, GUESS_MIN, GUESS_MAX, GUESS_STEP);

/**
 * The guess against what the month really costs (spending + minimum debt payments), only once the
 * spending is the user's own: null while every spending category is still an estimate.
 */
export function selfGuessReveal(
  guess: Money | null,
  profile: Profile,
  statementMonths: readonly CategoryTotals[],
  closestCardId: string | null,
): SelfGuessRevealVM | null {
  if (guess === null || !spendingIsOwn(profile, statementMonths, startingProfile(closestCardId))) return null;
  const actual = monthlyCost(profile);
  return { guess, actual, difference: actual - guess };
}

export function useGuessYourself(opts: { mode?: GameMode } = {}): GuessYourselfVM {
  const mode = opts.mode ?? gameMode();
  const ready = useAppReady();
  const savedGuess = useAppStore((s) => s.selfGuess);
  const setSelfGuess = useAppStore((s) => s.setSelfGuess);
  const profile = useProfile();
  const statementMonths = useAppStore((s) => s.statementMonths);
  const closestCardId = useAppStore((s) => s.closestCardId);
  const cards = useGameStore((s) => s.cards);
  const reveals = useGameStore((s) => s.reveals);
  const guesses = useGameStore((s) => s.guesses);

  // Before the first save the slider is a local draft; once a guess is saved, the slider IS the
  // guess (every move saves it), so the big number and the saved guess never disagree.
  const [draft, setDraft] = useState<Money | null>(null);
  const value = savedGuess !== null ? clamp(savedGuess) : (draft ?? GUESS_DEFAULT);

  const setGuess = useCallback(
    (v: Money) => (savedGuess !== null ? setSelfGuess(clamp(v)) : setDraft(clamp(v))),
    [savedGuess, setSelfGuess],
  );
  const setGuessPosition = useCallback((p: number) => setGuess(scale.fromPosition(p)), [setGuess]);
  const submit = useCallback(() => {
    setSelfGuess(value);
    track({ name: 'own_guess_submitted' }, { once: 'own_guess_submitted' });
  }, [setSelfGuess, value]);

  const reveal = useMemo(
    () => selfGuessReveal(savedGuess, profile, statementMonths, closestCardId),
    [savedGuess, profile, statementMonths, closestCardId],
  );

  // "You guessed low on 4 of 5" compares slider guesses with the homes' costs. The duel has no
  // guessed amounts (a pick is A or B), so there is no honest version of that line: none.
  const bridge = useMemo(() => {
    if (mode !== 'slider') return null;
    const played = cards.filter((c) => reveals[c.id]);
    if (played.length === 0) return null;
    const dirs = played.map((c) => directionOf(guesses[c.id] ?? Number.NaN, reveals[c.id]!.cost.total));
    return {
      played: played.length,
      guessedLow: dirs.filter((d) => d === 'low').length,
      guessedHigh: dirs.filter((d) => d === 'high').length,
    };
  }, [mode, cards, reveals, guesses]);

  return {
    status: ready ? 'ready' : 'loading',
    guess: logSliderVM(value, GUESS_MIN, GUESS_MAX, GUESS_STEP),
    savedGuess,
    reveal,
    bridge,
    setGuess,
    setGuessPosition,
    submit,
  };
}
