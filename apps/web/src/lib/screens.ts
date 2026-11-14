// Route of every screen (docs/ARCHITECTURE.md → Screens). S2 and S3 are states of /play (the duel
// by default, the slider game with NEXT_PUBLIC_GAME_MODE=slider); S4 is the slider's streamer mode.
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
} as const satisfies Record<ScreenId, string>;

/** Screens in order S1–S15. */
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
