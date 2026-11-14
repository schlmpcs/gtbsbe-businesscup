// The sample notice: whether the personal numbers on screen are the sample household's (the demo
// profile) instead of the person's own. Honest both ways: it shows on every screen that shows a
// profile's numbers while the profile is still the demo one, whether the person asked for the sample
// ("See a sample plan", /future?sample=1, loaded by useSampleRequest in features/forecast/model) or
// simply has not entered anything yet; and it never shows on screens with no personal numbers (the
// game, Pro, the What if? hub, onboarding), so it does not follow the person around.
import { useHydrated } from './hydration';
import { isSampleActive, useAppStore } from './store';

/**
 * Routes that show the profile's own numbers (net worth, take-home, spending, bills…). Each matches
 * itself and its subpaths. Home (`/`) is not listed: its first visit has no numbers, so the Home page
 * decides itself (see app/page.tsx). /tools/overpaying only ever uses a profile the person made
 * (useOwnProfile), so it never shows the sample's numbers.
 */
export const PERSONAL_NUMBER_ROUTES: readonly string[] = [
  '/future',
  '/plan',
  '/accounts',
  '/transactions',
  '/cashflow',
  '/budget',
  '/recurring',
  '/goals',
  '/afford',
  '/loan',
  '/decide',
  '/checkin',
  '/spend',
  '/tools/bills',
  '/tools/subscriptions',
];

/** The route shows the profile's numbers (so a sample profile must be said to be one). */
export function showsPersonalNumbers(pathname: string): boolean {
  return PERSONAL_NUMBER_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

export type SampleBannerVM = {
  /** Show the notice: saved state is loaded, the profile is the demo one and the screen shows its numbers. */
  active: boolean;
  /** The person asked for the sample ("See a sample plan"), rather than having entered nothing yet. */
  requested: boolean;
  /** "Use mine": leave the sample (the person builds their own next, from /me/guess). */
  clear: () => void;
};

/**
 * @param where the current pathname (the notice shows only where personal numbers are), or
 *   `{ show }` when the page itself knows whether it shows numbers (Home: not on a first visit).
 */
export function useSampleBanner(where: string | { show: boolean }): SampleBannerVM {
  const hydrated = useHydrated();
  const isDemo = useAppStore((s) => s.profileOrigin === 'demo');
  const requested = useAppStore(isSampleActive);
  const clear = useAppStore((s) => s.clearSample);
  const onScreen = typeof where === 'string' ? showsPersonalNumbers(where) : where.show;
  return { active: hydrated && isDemo && onScreen, requested: hydrated && requested, clear };
}
