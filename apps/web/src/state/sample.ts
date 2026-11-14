// The sample life ("Try with sample data"): whether it is on screen, for the banner every screen
// shows while it is (docs/design/USER-JOURNEY.md → Global UI). Loading it is useSampleRequest's
// (features/forecast/model), which S10 runs for /future?sample=1.
import { useHydrated } from './hydration';
import { isSampleActive, useAppStore } from './store';

export type SampleBannerVM = {
  /** The sample life is on screen (false until saved state is loaded). */
  active: boolean;
  /** "Use mine": stop treating the profile as the sample; the user builds their own next. */
  clear: () => void;
};

export function useSampleBanner(): SampleBannerVM {
  const hydrated = useHydrated();
  const active = useAppStore(isSampleActive);
  const clear = useAppStore((s) => s.clearSample);
  return { active: hydrated && active, clear };
}
