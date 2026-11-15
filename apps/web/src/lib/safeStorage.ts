// localStorage that never throws: private windows, blocked site data, quota errors and the server
// (no `window`) all degrade to "nothing stored" instead of crashing a screen.
import type { StateStorage } from 'zustand/middleware';

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null; // reading window.localStorage itself throws when site data is blocked
  }
}

export function readStorage(key: string): string | null {
  try {
    return storage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    storage()?.setItem(key, value);
  } catch {
    // Quota exceeded or storage blocked: keep working in memory.
  }
}

/** Like writeStorage, but says whether the value was stored (false: no storage, blocked or over quota). */
export function tryWriteStorage(key: string, value: string): boolean {
  try {
    const s = storage();
    if (!s) return false;
    s.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeStorage(key: string): void {
  try {
    storage()?.removeItem(key);
  } catch {
    // ignore
  }
}

/** Zustand `persist` storage backed by the safe helpers above. */
export const safeStateStorage: StateStorage = {
  getItem: readStorage,
  setItem: writeStorage,
  removeItem: removeStorage,
};
