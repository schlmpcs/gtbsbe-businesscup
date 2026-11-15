// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetClientState } from '@/test/clientState';
import { PERSONAL_NUMBER_ROUTES, showsPersonalNumbers, useSampleBanner } from './sample';
import { useAppStore } from './store';

beforeEach(resetClientState);

describe('showsPersonalNumbers', () => {
  it('is true on the planner and tool screens that show a profile’s numbers, and their subpages', () => {
    for (const r of ['/dashboard', '/future', '/plan', '/accounts', '/accounts/abc', '/budget', '/afford', '/loan', '/spend', '/tools/bills']) {
      expect(showsPersonalNumbers(r)).toBe(true);
    }
  });

  it('is false where no personal numbers show: Home (decides itself), the game, Pro, the What if? hub, onboarding', () => {
    for (const r of ['/', '/play', '/duel', '/pro', '/tools', '/tools/overpaying', '/me/guess', '/me/sliders', '/kit', '/futures']) {
      expect(showsPersonalNumbers(r)).toBe(false);
    }
    expect(PERSONAL_NUMBER_ROUTES).not.toContain('/');
  });
});

describe('useSampleBanner', () => {
  it('shows on a numbers screen while the profile is the demo one, even when no sample was asked for', async () => {
    const { result } = renderHook(() => useSampleBanner('/future'));
    await waitFor(() => expect(result.current.active).toBe(true));
    expect(result.current.requested).toBe(false);
  });

  it('never shows on screens without personal numbers, even with the sample on', async () => {
    act(() => void useAppStore.getState().loadSample());
    const play = renderHook(() => useSampleBanner('/play'));
    const pro = renderHook(() => useSampleBanner('/pro'));
    const future = renderHook(() => useSampleBanner('/future'));
    await waitFor(() => expect(future.result.current.active).toBe(true));
    expect(future.result.current.requested).toBe(true);
    expect(play.result.current.active).toBe(false);
    expect(pro.result.current.active).toBe(false);
  });

  it('follows the page’s own say-so when given ({ show })', async () => {
    const off = renderHook(() => useSampleBanner({ show: false }));
    const on = renderHook(() => useSampleBanner({ show: true }));
    await waitFor(() => expect(on.result.current.active).toBe(true));
    expect(off.result.current.active).toBe(false);
  });

  it('goes away once the numbers are the person’s own; "Use mine" leaves the requested sample', async () => {
    act(() => void useAppStore.getState().loadSample());
    const { result } = renderHook(() => useSampleBanner('/future'));
    await waitFor(() => expect(result.current.requested).toBe(true));
    act(() => result.current.clear());
    expect(result.current.requested).toBe(false);
    act(() => useAppStore.getState().setSpending('rentUtilities', 1800));
    expect(useAppStore.getState().profileOrigin).toBe('user');
    expect(result.current.active).toBe(false);
  });

  it('with the person’s own transactions in the ledger: says so, and leaves /transactions (it shows only their lines)', async () => {
    const plan = renderHook(() => useSampleBanner('/plan', { ownLedger: true }));
    const tx = renderHook(() => useSampleBanner('/transactions', { ownLedger: true }));
    const txEmpty = renderHook(() => useSampleBanner('/transactions', { ownLedger: false }));
    await waitFor(() => expect(plan.result.current.active).toBe(true));
    expect(plan.result.current.ownLedger).toBe(true);
    expect(tx.result.current.active).toBe(false);
    expect(txEmpty.result.current.active).toBe(true);
  });

  it('goes away once a statement is applied to the profile (S9)', async () => {
    const { result } = renderHook(() => useSampleBanner('/dashboard'));
    await waitFor(() => expect(result.current.active).toBe(true));
    act(() => useAppStore.getState().applyStatementTotals([]));
    expect(result.current.active).toBe(false);
  });
});
