// The profile every engine call reads: the stored profile stamped with `asOf`, the calendar month its
// "today" values describe (forecast month 0). Life events are dated by calendar month, so the engine
// needs `asOf` to know how far ahead each one is (docs/superpowers/specs/2026-11-15-life-events-design.md).
//
// `stampProfile` is the one place `asOf` is set, and `useProfile` the one way screens read the profile
// for the engine. `asOf` is never stored or saved: it is the local month at the time of use, from the
// browser's clock (the server never reads the clock).
//
// The month is looked at again every minute and whenever the page regains focus or becomes visible, so a
// page left open over a month end moves to the new month (and folds the events that started: index.ts).
import type { Profile, YearMonth } from '@lifeguessr/types';
import { useMemo, useSyncExternalStore } from 'react';
import { localMonthDay } from '@/lib/dates';
import { useAppStore } from './store';

/** How often an open page checks whether the month has rolled over. */
export const MONTH_CHECK_MS = 60_000;

/** The profile with `asOf` = `month`: the only place `asOf` is set. */
export function stampProfile(profile: Profile, month: YearMonth): Profile {
  return { ...profile, asOf: month };
}

/** This local calendar month, 'YYYY-MM'. */
export function currentMonth(): YearMonth {
  return localMonthDay().month;
}

// One timer and one pair of listeners for the page, however many hooks read the month.
const monthListeners = new Set<() => void>();
const notifyMonth = () => monthListeners.forEach((listener) => listener());
let stopWatchingMonth: (() => void) | null = null;

function subscribeToMonth(onChange: () => void): () => void {
  monthListeners.add(onChange);
  if (stopWatchingMonth === null) {
    const timer = setInterval(notifyMonth, MONTH_CHECK_MS);
    window.addEventListener('focus', notifyMonth);
    document.addEventListener('visibilitychange', notifyMonth);
    stopWatchingMonth = () => {
      clearInterval(timer);
      window.removeEventListener('focus', notifyMonth);
      document.removeEventListener('visibilitychange', notifyMonth);
    };
  }
  return () => {
    monthListeners.delete(onChange);
    if (monthListeners.size === 0 && stopWatchingMonth !== null) {
      stopWatchingMonth();
      stopWatchingMonth = null;
    }
  };
}

/** The local calendar month, updated when it rolls over while the page is open. */
export function useCurrentMonth(): YearMonth {
  return useSyncExternalStore(subscribeToMonth, currentMonth, currentMonth);
}

/**
 * The stored profile stamped with this month (`stampProfile`): what every engine call site reads. The
 * same object until the profile or the month changes, so it can key memos and requests.
 */
export function useProfile(): Profile {
  const profile = useAppStore((s) => s.profile);
  const month = useCurrentMonth();
  return useMemo(() => stampProfile(profile, month), [profile, month]);
}
