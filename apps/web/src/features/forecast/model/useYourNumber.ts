// S1 sample-life card and S10 "Your number" hero: engine numbers (rules forecast), see ./yourNumber.ts.
import { useMemo } from 'react';
import { profileDemo } from '@/fixtures';
import { runEngine } from '@/lib/model/errors';
import { isSampleActive, useAppReady, useAppStore } from '@/state';
import type { Loadable, NumberHeroVM, SampleLifeVM } from './types';
import { SAMPLE_GOAL, sampleLife, yourNumber } from './yourNumber';

/** The sample life on S1, computed by the engine from the demo profile (no saved state needed). */
export function useSampleLife(opts: { now?: Date } = {}): Loadable<SampleLifeVM> {
  const { now } = opts;
  return useMemo(() => runEngine(() => sampleLife(profileDemo, now)), [now]);
}

/**
 * S10 hero: the current profile's number from the rules forecast, with the user's goal; while the
 * sample life is on and no goal is set, with the sample goal (labeled as such).
 */
export function useNumberHero(opts: { now?: Date } = {}): NumberHeroVM {
  const { now } = opts;
  const ready = useAppReady();
  const profile = useAppStore((s) => s.profile);
  const goal = useAppStore((s) => s.goal);
  const isSample = useAppStore(isSampleActive);
  const isSampleGoal = goal === null && isSample;
  const shownGoal = goal ?? (isSampleGoal ? SAMPLE_GOAL : null);
  const number = useMemo(
    () => (ready ? runEngine(() => yourNumber(profile, shownGoal, now)) : ({ status: 'loading' } as const)),
    [ready, profile, shownGoal, now],
  );
  return { number, isSampleGoal };
}
