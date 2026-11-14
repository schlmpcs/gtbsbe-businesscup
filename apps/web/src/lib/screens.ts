// Route of every screen (docs/ARCHITECTURE.md → Screens). S3 and S4 are states of /play.
import type { ScreenId } from '@/copy';

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
