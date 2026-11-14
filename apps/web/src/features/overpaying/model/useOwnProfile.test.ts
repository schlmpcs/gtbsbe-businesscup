// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { cloneProfileDemo } from '@/fixtures';
import { useAppStore } from '@/state';
import { currentMonth } from '@/state/profile';
import { resetClientState } from '@/test/clientState';
import { useOwnProfile } from './useOwnProfile';

beforeEach(resetClientState);

describe('useOwnProfile', () => {
  it('is null while the store holds only the sample household', () => {
    const { result } = renderHook(() => useOwnProfile());
    expect(useAppStore.getState().profileOrigin).toBe('demo');
    expect(result.current).toBeNull();
  });

  it('is the person\'s profile once they have made one', () => {
    const { result, rerender } = renderHook(() => useOwnProfile());
    useAppStore.getState().setSpending('groceries', 640);
    rerender();
    expect(useAppStore.getState().profileOrigin).toBe('user');
    expect(result.current).toEqual({ ...useAppStore.getState().profile, asOf: currentMonth() }); // stamped for the engine
    expect(result.current?.spending.groceries.value).toBe(640);
  });

  it('is null for a profile built from someone else\'s life card (closestLife), like the sample', () => {
    const { result, rerender } = renderHook(() => useOwnProfile());
    useAppStore.getState().setProfile(cloneProfileDemo(), 'closestLife');
    rerender();
    expect(useAppStore.getState().profileOrigin).toBe('closestLife');
    expect(result.current).toBeNull();
  });

  it('is the person\'s profile again once they edit a life card they chose', () => {
    useAppStore.getState().setProfile(cloneProfileDemo(), 'closestLife');
    const { result, rerender } = renderHook(() => useOwnProfile());
    expect(result.current).toBeNull();
    useAppStore.getState().setSpending('groceries', 700); // an edit makes the numbers the person's own (origin 'user')
    rerender();
    expect(useAppStore.getState().profileOrigin).toBe('user');
    expect(result.current?.spending.groceries.value).toBe(700);
  });

  it('goes back to null when the sample household is restored', () => {
    useAppStore.getState().setSpending('groceries', 640);
    const { result, rerender } = renderHook(() => useOwnProfile());
    expect(result.current).not.toBeNull();
    useAppStore.getState().setProfile(cloneProfileDemo(), 'demo');
    rerender();
    expect(result.current).toBeNull();
  });
});
