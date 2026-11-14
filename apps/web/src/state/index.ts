// Client state: the persisted app store (profile, wishlist, committed move, statement history),
// today's game progress, the anonymous id and the server-session sync.
import { useHydrated } from './hydration';
import { useSessionSync } from './sessionSync';

export { useAppStore, initialAppData, isSampleActive, APP_STORE_KEY } from './store';
export type { AppData, AppActions, AppState, ProfileOrigin, WishlistItem } from './store';
export { useGameStore, initialGameData, GAME_STORE_KEY } from './game';
export type { GameData, GameActions, GameState } from './game';
export { getAnonId, ANON_ID_KEY } from './anonId';
export { useHydrated, startHydration } from './hydration';
export { useSessionSync, setSessionAdapter } from './sessionSync';
export type { DebtInput, ProfileField } from './profileOps';
export { usePro, useProStore, initialProData, resetProStore, PRO_CACHE_KEY } from './pro';
export type { ProActions, ProData, ProState, ProVM } from './pro';

/** Every screen hook calls this: true once saved state is loaded; also runs the session sync. */
export function useAppReady(): boolean {
  const hydrated = useHydrated();
  useSessionSync(hydrated);
  return hydrated;
}
export { useSampleBanner } from './sample';
export type { SampleBannerVM } from './sample';
