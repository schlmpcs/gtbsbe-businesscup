// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { cloneProfileDemo } from '@/fixtures';
import { useAppStore } from '@/state';
import { resetClientState } from '@/test/clientState';
import { useOwnProfile } from './useOwnProfile';

beforeEach(resetClientState);

describe('useOwnProfile', () => {
  it('is null while the store holds only the sample household', () => {
    const { result } = renderHook(() => useOwnProfile());
    expect(useAppStore.getState().profileOrigin).toBe('demo');
    expect(result.current).toBeNull();
  });

  it('is the person\'s profile once they have made or chosen one', () => {
    const { result, rerender } = renderHook(() => useOwnProfile());
    useAppStore.getState().setSpending('groceries', 640);
    rerender();
    expect(useAppStore.getState().profileOrigin).toBe('user');
    expect(result.current).toBe(useAppStore.getState().profile);
    expect(result.current?.spending.groceries.value).toBe(640);
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
