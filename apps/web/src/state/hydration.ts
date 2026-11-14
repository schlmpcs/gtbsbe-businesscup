// Load the persisted stores after the first client render (they use `skipHydration`), and tell
// hooks when that is done. Server render and first client render both see the defaults.
import { useEffect, useSyncExternalStore } from 'react';
import { useGameStore } from './game';
import { useAppStore } from './store';

const stores = [useAppStore, useGameStore] as const;

let started = false;

/** Rehydrate every persisted store once per page load. Safe to call repeatedly. */
export function startHydration(): void {
  if (started) return;
  started = true;
  for (const store of stores) void store.persist.rehydrate();
}

function subscribe(onChange: () => void): () => void {
  const unsubs = stores.map((s) => s.persist.onFinishHydration(onChange));
  return () => unsubs.forEach((u) => u());
}

const isHydrated = () => stores.every((s) => s.persist.hasHydrated());

/** True once the saved state is loaded (always false on the server). */
export function useHydrated(): boolean {
  useEffect(startHydration, []);
  return useSyncExternalStore(subscribe, isHydrated, () => false);
}
