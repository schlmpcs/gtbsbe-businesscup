// The sample notice: whether the personal numbers on screen are the sample household's (the demo
// profile) instead of the person's own. Honest both ways: it shows on every screen that shows a
// profile's numbers while the profile is still the demo one, whether the person asked for the sample
// ("See a sample plan", /future?sample=1, loaded by useSampleRequest in features/forecast/model) or
// simply has not entered anything yet; and it never shows on screens with no personal numbers (the
// game, Pro, the What if? hub, onboarding), so it does not follow the person around. It goes away
// once the profile is the person's own: any edit, a life card (S6), a statement applied on S9 or the
// end of onboarding sets `profileOrigin` away from 'demo'.
import { useHydrated } from './hydration';
import { isSampleActive, useAppStore } from './store';

/**
 * Routes that show the profile's own numbers (net worth, take-home, spending, bills…). Each matches
 * itself and its subpaths. Home (`/`) is not listed: its first visit has no numbers, so the Home page
 * decides itself (see app/page.tsx). /tools/overpaying only ever uses a profile the person made
 * (useOwnProfile), so it never shows the sample's numbers.
 */
export const PERSONAL_NUMBER_ROUTES: readonly string[] = [
  '/dashboard',
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
  /**
   * The person imported or typed their own transactions (the ledger has lines) while the profile, which
   * the plan and the KPIs read, is still the sample's: the notice says the plan is still the sample's.
   */
  ownLedger: boolean;
  /** "Use mine": leave the sample (the person builds their own next, from /me/guess). */
  clear: () => void;
};

/** Where the notice is asked about, and what the caller knows about the person's own data. */
export type SampleBannerOptions = {
  /** The person's ledger (Transactions) holds lines of their own. */
  ownLedger?: boolean;
};

/** The Transactions page lists only the ledger's lines: once those are the person's own, it shows no sample. */
const LEDGER_ROUTES: readonly string[] = ['/transactions'];

/**
 * @param where the current pathname (the notice shows only where personal numbers are), or
 *   `{ show }` when the page itself knows whether it shows numbers (Home: not on a first visit).
 * @param options what the caller knows about the person's own data (their ledger).
 *
 * Importing a statement on /transactions fills the ledger but leaves the profile (and so the plan) as
 * it is; S9 (/me/upload) is the step that turns statement totals into the profile. So with lines in the
 * ledger and a demo profile, the notice stays on the plan screens but says the plan is the part still
 * on sample numbers, and it leaves /transactions, which then shows nothing but the person's lines.
 */
export function useSampleBanner(where: string | { show: boolean }, options: SampleBannerOptions = {}): SampleBannerVM {
  const hydrated = useHydrated();
  const isDemo = useAppStore((s) => s.profileOrigin === 'demo');
  const requested = useAppStore(isSampleActive);
  const clear = useAppStore((s) => s.clearSample);
  const ownLedger = options.ownLedger === true;
  const onScreen =
    typeof where === 'string'
      ? showsPersonalNumbers(where) && !(ownLedger && LEDGER_ROUTES.some((r) => where === r || where.startsWith(`${r}/`)))
      : where.show;
  return { active: hydrated && isDemo && onScreen, requested: hydrated && requested, ownLedger, clear };
}
