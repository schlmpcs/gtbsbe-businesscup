// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { flush, resetClientState } from '@/test/clientState';
import { setSessionAdapter, useAppStore } from '@/state';
import { useSessionSync, SESSION_SAVE_DEBOUNCE_MS } from './sessionSync';
beforeEach(resetClientState);
afterEach(() => vi.useRealTimers());
it('restores a server goal beside an existing local profile and saves goal-only changes', async () => {
  const save = vi.fn().mockResolvedValue(undefined),
    load = vi.fn().mockResolvedValue({ goal: { target: 100000, years: 10 } });
  useAppStore.setState({ profileOrigin: 'user' });
  setSessionAdapter({ enabled: true, load, save });
  renderHook(() => useSessionSync(true));
  await waitFor(() => expect(useAppStore.getState().goal?.target).toBe(100000));
  vi.useFakeTimers();
  act(() => useAppStore.getState().clearGoal());
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SESSION_SAVE_DEBOUNCE_MS);
  });
  expect(save).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({ goal: null }),
  );
});
it('does not overwrite a goal edited and cleared while the server load is pending', async () => {
  let resolve!: (value: { goal: { target: number; years: number } }) => void;
  const load = vi.fn(
    () =>
      new Promise<{ goal: { target: number; years: number } }>((done) => {
        resolve = done;
      }),
  );
  setSessionAdapter({
    enabled: true,
    load,
    save: vi.fn().mockResolvedValue(undefined),
  });
  renderHook(() => useSessionSync(true));
  act(() => {
    useAppStore.getState().setGoal({ target: 200000, years: 5 });
    useAppStore.getState().clearGoal();
  });
  resolve({ goal: { target: 100000, years: 10 } });
  await flush();
  expect(useAppStore.getState().goal).toBeNull();
});
