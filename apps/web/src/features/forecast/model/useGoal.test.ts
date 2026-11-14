// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it } from 'vitest';
import { resetClientState } from '@/test/clientState';
import { APP_STORE_KEY, useAppStore } from '@/state';
import { useGoal } from './useGoal';
beforeEach(resetClientState);
it('validates, computes and persists a goal outside the profile', async () => {
  const { result } = renderHook(useGoal);
  await waitFor(() => expect(result.current.status.status).toBe('ready'));
  const profile = useAppStore.getState().profile;
  act(() => result.current.setGoal({ target: 250000, years: 10 }));
  expect(result.current.status.status).toBe('ready');
  if (result.current.status.status === 'ready')
    expect(result.current.status.data?.goal.target).toBe(250000);
  expect(useAppStore.getState().profile).toBe(profile);
  expect(JSON.parse(localStorage.getItem(APP_STORE_KEY)!).state.goal).toEqual({
    target: 250000,
    years: 10,
  });
  act(() => result.current.setGoal({ target: -1, years: 10 }));
  expect(result.current.inputError).toBe(true);
  expect(result.current.goal?.target).toBe(250000);
  act(() => result.current.clearGoal());
  expect(result.current.goal).toBeNull();
});
