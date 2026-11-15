// The story's progress in this browser (localStorage, never sent): the chapter reached, whether the
// story was finished (then "/" sends the person to /dashboard), and the practice duel's average error
// (for chapter 2's bridge line). It holds no number of the person's month: those live in the app store.
// A tiny external store: every hook that reads it re-renders on a write, in this tab and in others.
import { useCallback, useSyncExternalStore } from 'react';
import { readStorage, writeStorage } from '@/lib/safeStorage';
import type { ChapterId, OnboardingRecord } from './types';

export const ONBOARDING_KEY = 'lifeguessr.onboarding';
export const CHAPTERS: readonly ChapterId[] = [1, 2, 3, 4];

/** Where the story lives, and its chapters' URLs (a chapter can be opened directly, e.g. from the ladder). */
export const START_ROUTE = '/start';
export const chapterHref = (chapter: ChapterId): string => (chapter === 1 ? START_ROUTE : `${START_ROUTE}?ch=${chapter}`);
export const DASHBOARD_ROUTE = '/dashboard';

export const isChapter = (n: unknown): n is ChapterId => n === 1 || n === 2 || n === 3 || n === 4;

/** A stored record, or null when there is none or it is not one of ours. */
export function parseRecord(raw: string | null): OnboardingRecord | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<OnboardingRecord>;
    if (!isChapter(v.chapter) || typeof v.done !== 'boolean') return null;
    const err = v.practiceError;
    return { chapter: v.chapter, done: v.done, practiceError: typeof err === 'number' && Number.isFinite(err) && err >= 0 ? err : null };
  } catch {
    return null;
  }
}

const listeners = new Set<() => void>();
let cache: { raw: string | null; record: OnboardingRecord | null } = { raw: null, record: null };

function snapshot(): OnboardingRecord | null {
  const raw = readStorage(ONBOARDING_KEY);
  if (raw !== cache.raw) cache = { raw, record: parseRecord(raw) };
  return cache.record;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === ONBOARDING_KEY) onChange();
  };
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(onChange);
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
  };
}

/** Write a record (merged onto the stored one) and tell every reader. */
export function writeRecord(patch: Partial<OnboardingRecord>): OnboardingRecord {
  const cur = snapshot() ?? { chapter: 1, done: false, practiceError: null };
  const next: OnboardingRecord = { ...cur, ...patch };
  // A finished story stays finished; the chapter reached only moves forward unless set explicitly.
  next.done = cur.done || next.done;
  writeStorage(ONBOARDING_KEY, JSON.stringify(next));
  for (const l of listeners) l();
  return next;
}

/** The stored record: undefined on the server and before the first client render, null when there is none. */
export function useOnboardingRecord(): OnboardingRecord | null | undefined {
  const get = useCallback(() => snapshot(), []);
  return useSyncExternalStore(subscribe, get, () => undefined);
}
