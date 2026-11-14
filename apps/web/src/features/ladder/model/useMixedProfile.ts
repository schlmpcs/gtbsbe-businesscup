// The mixed-profile warning on /future and /afford (JF1): typed pay next to a sample family's
// spending. One tap scales the sample categories to the person's S5 guess (ownLife.spendingScaledToGuess).
import { useCallback, useMemo } from 'react';
import { SCREEN_ROUTES } from '@/lib/screens';
import { useAppReady, useAppStore, useProfile } from '@/state';
import { mixedProfileWarning, spendingScaledToGuess } from './ownLife';
import type { MixedProfileVM } from './types';

export function useMixedProfile(): MixedProfileVM | null {
  const ready = useAppReady();
  const profile = useProfile();
  const selfGuess = useAppStore((s) => s.selfGuess);
  const closestCardId = useAppStore((s) => s.closestCardId);
  const statementMonths = useAppStore((s) => s.statementMonths);
  const setProfile = useAppStore((s) => s.setProfile);

  const warning = useMemo(
    () => mixedProfileWarning({ profile, selfGuess, closestCardId, statementMonths }),
    [profile, selfGuess, closestCardId, statementMonths],
  );
  const useGuess = useCallback(() => {
    if (selfGuess !== null) setProfile(spendingScaledToGuess(profile, selfGuess), 'user');
  }, [profile, selfGuess, setProfile]);

  if (!ready || warning === null) return null;
  return {
    guess: warning.guess,
    useGuess: warning.guess === null ? null : useGuess,
    spendingHref: SCREEN_ROUTES.S9,
  };
}
