// S5 Guess yourself: the user's guess of their own monthly cost, on the same slider as the game.
import type { Money } from '@lifeguessr/types';
import { useCallback, useMemo, useState } from 'react';
import { GUESS_DEFAULT, GUESS_MAX, GUESS_MIN, GUESS_STEP } from '@/features/game/model/constants';
import { directionOf } from '@/features/game/model/derive';
import { logScale, logSliderVM, snap } from '@/lib/model/slider';
import { useAppReady, useAppStore, useGameStore } from '@/state';
import type { GuessYourselfVM } from './types';

const scale = logScale(GUESS_MIN, GUESS_MAX);
const clamp = (v: Money) => snap(v, GUESS_MIN, GUESS_MAX, GUESS_STEP);

export function useGuessYourself(): GuessYourselfVM {
  const ready = useAppReady();
  const savedGuess = useAppStore((s) => s.selfGuess);
  const setSelfGuess = useAppStore((s) => s.setSelfGuess);
  const cards = useGameStore((s) => s.cards);
  const reveals = useGameStore((s) => s.reveals);
  const guesses = useGameStore((s) => s.guesses);

  // Local slider value until submitted; starts at the saved guess (or the track's middle).
  const [draft, setDraft] = useState<Money | null>(null);
  const value = draft ?? (savedGuess !== null ? clamp(savedGuess) : GUESS_DEFAULT);

  const setGuess = useCallback((v: Money) => setDraft(clamp(v)), []);
  const setGuessPosition = useCallback((p: number) => setDraft(clamp(scale.fromPosition(p))), []);
  const submit = useCallback(() => setSelfGuess(value), [setSelfGuess, value]);

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
    bridge,
    setGuess,
    setGuessPosition,
    submit,
  };
}
