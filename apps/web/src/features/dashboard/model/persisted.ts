// The planner's small browser-only stores (budget plan, goals, goal links, hidden recurring items,
// the dismissed checklist) are zustand stores saved with the same `safeStorage` as the rest of the
// app. They use `skipHydration`, like the profile and game stores, so the server render and the first
// client render agree; `usePersistedReady` loads one after the first client render.
import { useEffect, useSyncExternalStore } from 'react';

/** The slice of a zustand `persist` store this file needs. */
export type PersistedStore = {
  persist: {
    rehydrate: () => Promise<void> | void;
    hasHydrated: () => boolean;
    onFinishHydration: (fn: () => void) => () => void;
  };
};

/** True once the store's saved state is loaded (always false on the server). Starts the load. */
export function usePersistedReady(store: PersistedStore): boolean {
  useEffect(() => {
    if (!store.persist.hasHydrated()) void store.persist.rehydrate();
  }, [store]);
  return useSyncExternalStore(
    (onChange) => store.persist.onFinishHydration(onChange),
    () => store.persist.hasHydrated(),
    () => false,
  );
}
