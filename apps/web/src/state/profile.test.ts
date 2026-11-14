// @vitest-environment jsdom
import type { LifeEvent } from '@lifeguessr/types';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetClientState, waitForReady } from '@/test/clientState';
import { useAppReady } from './index';
import { stampProfile, useCurrentMonth, useProfile } from './profile';
import { APP_STORE_KEY, useAppStore } from './store';

const kid: LifeEvent = {
  id: 'ev-kid', kind: 'spending', month: '2026-12', preset: 'kid', category: 'childcare', monthly: { value: 1_375, isEstimate: true },
};

beforeEach(() => {
  resetClientState();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 15, 12)); // 15 Nov 2026, local time
});
afterEach(() => vi.useRealTimers());

/** The month rolls over while the page is open (the hooks look again on focus). */
function rollTo(date: Date) {
  vi.setSystemTime(date);
  act(() => void window.dispatchEvent(new Event('focus')));
}

describe('stampProfile', () => {
  it('sets asOf to the given month and leaves the input untouched', () => {
    const p = useAppStore.getState().profile;
    expect(stampProfile(p, '2026-11')).toEqual({ ...p, asOf: '2026-11' });
    expect(p.asOf).toBeUndefined();
  });
});

describe('useProfile', () => {
  it('is the store profile stamped with the local month, the same object until the profile or the month changes', () => {
    const { result, rerender } = renderHook(() => useProfile());
    const first = result.current;
    expect(first).toEqual({ ...useAppStore.getState().profile, asOf: '2026-11' });
    rerender();
    expect(result.current).toBe(first);

    rollTo(new Date(2026, 11, 1, 0, 5));
    expect(result.current.asOf).toBe('2026-12');

    act(() => void useAppStore.getState().setSpending('groceries', 640));
    expect(result.current.spending.groceries.value).toBe(640);
    expect(result.current.asOf).toBe('2026-12');
    expect(useAppStore.getState().profile.asOf).toBeUndefined(); // never stored
  });

  it('useCurrentMonth follows the local calendar month', () => {
    const { result } = renderHook(() => useCurrentMonth());
    expect(result.current).toBe('2026-11');
    rollTo(new Date(2027, 0, 1, 0, 1));
    expect(result.current).toBe('2027-01');
  });
});

describe('started events fold into today', () => {
  it('after the saved state loads, and again when the month rolls over while open', async () => {
    const raise: LifeEvent = { id: 'ev-raise', kind: 'pay', month: '2026-11', takeHomePay: { value: 6_000, isEstimate: false } };
    useAppStore.getState().addLifeEvent(raise);
    useAppStore.getState().addLifeEvent(kid);
    const saved = localStorage.getItem(APP_STORE_KEY)!;
    useAppStore.setState({ profile: { ...useAppStore.getState().profile, events: [] } });
    localStorage.setItem(APP_STORE_KEY, saved);
    await act(async () => {
      await useAppStore.persist.rehydrate();
    });

    const { result } = renderHook(() => ({ status: useAppReady() ? 'ready' : 'loading' }));
    await waitForReady(result);
    expect(useAppStore.getState().profile.takeHomePay).toEqual({ value: 6_000, isEstimate: false });
    expect(useAppStore.getState().profile.events).toEqual([kid]);
    expect(useAppStore.getState().foldedNotes).toEqual([{ kind: 'pay', month: '2026-11' }]);

    rollTo(new Date(2026, 11, 1, 0, 1));
    expect(useAppStore.getState().profile.spending.childcare).toEqual({ value: 1_375, isEstimate: true });
    expect(useAppStore.getState().profile.events).toEqual([]);
    expect(useAppStore.getState().foldedNotes.map((n) => n.kind)).toEqual(['pay', 'spending']);
  });

  it('folds a profile restored later (e.g. from the server session) too', async () => {
    const { result } = renderHook(() => ({ status: useAppReady() ? 'ready' : 'loading' }));
    await waitForReady(result);
    const past: LifeEvent = { id: 'ev-trip', kind: 'oneOff', month: '2026-10', amount: 900, direction: 'cost' };
    act(() => useAppStore.getState().setProfile({ ...useAppStore.getState().profile, events: [past, kid] }, 'user'));
    expect(useAppStore.getState().profile.events).toEqual([kid]);
    expect(useAppStore.getState().foldedNotes).toEqual([{ kind: 'oneOff', month: '2026-10', direction: 'cost' }]);
  });
});
