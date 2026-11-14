// Route of every screen (docs/ARCHITECTURE.md → Screens). S2 and S3 are states of /play (the duel
// by default, the slider game with NEXT_PUBLIC_GAME_MODE=slider); S4 is the slider's streamer mode.
// The duel has no streamer view, so no link may name `/play?stream=1` while /play is the duel (it
// would open the plain duel and silently drop the mode): linkedScreenIds and streamerGameHref are
// the two places that decide it.
import type { ScreenId } from '@/copy';
import { gameMode } from './config';

export const SCREEN_ROUTES = {
  S1: '/',
  S2: '/play',
  S3: '/play',
  S4: '/play?stream=1',
  S5: '/me/guess',
  S6: '/me/closest',
  S7: '/me/sliders',
  S8: '/me/balance',
  S9: '/me/upload',
  S10: '/future',
  S11: '/afford',
  S12: '/loan',
  S13: '/decide',
  S14: '/checkin',
  S15: '/pro',
  S21: '/tools/subscriptions',
  S23: '/tools/overpaying',
} as const satisfies Record<ScreenId, string>;

/** Screens in order S1–S15, then S21 and S23. */
export const SCREEN_IDS = (Object.keys(SCREEN_ROUTES) as ScreenId[]).sort(
  (a, b) => Number(a.slice(1)) - Number(b.slice(1)),
);

/**
 * Screens the app links to (S1's "All screens" list). S4 Streamer mode exists only in the slider
 * game: with the duel at /play, /play?stream=1 would silently open the duel, so it is not listed.
 */
export function linkedScreenIds(mode = gameMode()): ScreenId[] {
  return SCREEN_IDS.filter((id) => id !== 'S4' || mode === 'slider');
}

/**
 * Where "back to the game" goes from a page opened in streamer mode (`?stream=1`, which hides the
 * tools that show a person's own money). The slider game has a streamer view (S4); the duel does
 * not, so with the duel the link is the plain /play instead of a `?stream=1` it would ignore.
 */
export function streamerGameHref(mode = gameMode()): string {
  return mode === 'slider' ? SCREEN_ROUTES.S4 : SCREEN_ROUTES.S2;
}
