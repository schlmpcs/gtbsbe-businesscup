// Client state: the persisted app store (profile, wishlist, committed move, statement history),
// today's game progress, the anonymous id and the server-session sync.
import { useEffect } from 'react';
import { useHydrated } from './hydration';
import { useCurrentMonth } from './profile';
import { useSessionSync } from './sessionSync';
import { useAppStore } from './store';

export { useAppStore, initialAppData, isSampleActive, APP_STORE_KEY } from './store';
export type { AppData, AppActions, AppSessionData, AppState, ProfileOrigin, WishlistItem } from './store';
export { useGameStore, initialGameData, GAME_STORE_KEY } from './game';
export type { GameData, GameActions, GameState } from './game';
export { getAnonId, ANON_ID_KEY } from './anonId';
export { useHydrated, startHydration } from './hydration';
export { useSessionSync, setSessionAdapter } from './sessionSync';
export type { DebtInput, FoldedNote, LifeEventCategory, ProfileField } from './profileOps';
export { stampProfile, useCurrentMonth, useProfile } from './profile';
export { usePro, useProStore, initialProData, resetProStore, PRO_CACHE_KEY } from './pro';
export type { ProActions, ProData, ProState, ProVM } from './pro';

/**
 * Life events whose month has come become today's values (store `foldStartedEvents`): once the saved
 * state is loaded, when the month rolls over while the page is open, and when a whole profile arrives
 * later (the server session). A no-op when nothing has started.
 */
function useFoldStartedEvents(hydrated: boolean): void {
  const month = useCurrentMonth();
  const profile = useAppStore((s) => s.profile);
  useEffect(() => {
    if (hydrated) useAppStore.getState().foldStartedEvents(month);
  }, [hydrated, month, profile]);
}

/** Every screen hook calls this: true once saved state is loaded; also runs the session sync and folds started life events. */
export function useAppReady(): boolean {
  const hydrated = useHydrated();
  useFoldStartedEvents(hydrated);
  useSessionSync(hydrated);
  return hydrated;
}
export { useSampleBanner } from './sample';
export type { SampleBannerVM } from './sample';
