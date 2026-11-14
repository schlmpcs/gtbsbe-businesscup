// Keeps the server session (T4) in step with the local store: restores a saved profile when this
// browser has none of its own, then saves profile + wishlist changes (debounced). A no-op while the
// session adapter is disabled (local mode, or the route doesn't exist yet).
import { useEffect } from 'react';
import { createSessionAdapter, type SessionAdapter } from '@/lib/api/session';
import { getAnonId } from './anonId';
import { isSampleActive, useAppStore } from './store';

export const SESSION_SAVE_DEBOUNCE_MS = 1000;

let adapter: SessionAdapter | null = null;
let users = 0;
let stop: (() => void) | null = null;

/** Replace the adapter (tests, or a later switch to the API). */
export function setSessionAdapter(next: SessionAdapter | null): void {
  stop?.();
  stop = null;
  users = 0;
  adapter = next;
}

function start(a: SessionAdapter): () => void {
  if (!a.enabled) return () => {};
  const anonId = getAnonId();

  // The sample life (isSample) is what the user asked to see: a saved profile does not replace it.
  if (useAppStore.getState().profileOrigin === 'demo' && !useAppStore.getState().isSample) {
    void a.load(anonId).then((saved) => {
      const s = useAppStore.getState();
      if (saved?.profile && s.profileOrigin === 'demo' && !s.isSample) s.setProfile(saved.profile, 'user');
      if (saved?.wishlist && useAppStore.getState().wishlist.length === 0) {
        for (const purchase of saved.wishlist) useAppStore.getState().addToWishlist(purchase);
      }
    });
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const unsubscribe = useAppStore.subscribe((s, prev) => {
    if (s.profile === prev.profile && s.wishlist === prev.wishlist) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const now = useAppStore.getState();
      const wishlist = now.wishlist.map((w) => w.purchase);
      // The sample life is not the user's: it is never saved as their profile.
      void a.save(anonId, isSampleActive(now) ? { wishlist } : { profile: now.profile, wishlist });
    }, SESSION_SAVE_DEBOUNCE_MS);
  });
  return () => {
    clearTimeout(timer);
    unsubscribe();
  };
}

/** Run the sync while at least one mounted screen uses it, starting once the stores are hydrated. */
export function useSessionSync(hydrated: boolean): void {
  useEffect(() => {
    if (!hydrated) return;
    adapter ??= createSessionAdapter();
    if (users++ === 0) stop = start(adapter);
    return () => {
      if (--users === 0) {
        stop?.();
        stop = null;
      }
    };
  }, [hydrated]);
}
