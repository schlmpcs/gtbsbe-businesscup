// @vitest-environment jsdom
import { COST_CATEGORIES, type CostCategory, type Move } from '@lifeguessr/types';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetClientState, waitForReady } from '@/test/clientState';
import { ANON_ID_KEY, getAnonId } from './anonId';
import { useHydrated } from './hydration';
import { APP_STORE_KEY, useAppStore } from './store';

const totals = (over: Partial<Record<CostCategory, number>>) =>
  Object.fromEntries(COST_CATEGORIES.map((c) => [c, over[c] ?? 0])) as Record<CostCategory, number>;

const move: Move = { id: 'cutCategory:eatingOut', kind: 'cutCategory', level: 1, category: 'eatingOut', effect10y: 5000, patch: { spending: { eatingOut: 272 } } };

beforeEach(resetClientState);

describe('app store', () => {
  it('starts on the demo profile', () => {
    const s = useAppStore.getState();
    expect(s.profileOrigin).toBe('demo');
    expect(s.profile.takeHomePay.value).toBe(5200);
  });

  it('persists to localStorage and restores valid fields, dropping broken ones', async () => {
    useAppStore.getState().setSelfGuess(4200);
    useAppStore.getState().setSpending('rentUtilities', 1800);
    const saved = JSON.parse(localStorage.getItem(APP_STORE_KEY)!);
    expect(saved.state.selfGuess).toBe(4200);
    expect(saved.state.profile.spending.rentUtilities).toEqual({ value: 1800, isEstimate: false });

    // A corrupt wishlist must not take the rest down with it.
    useAppStore.setState({ selfGuess: null, wishlist: [] }); // (this write is persisted too)
    saved.state.wishlist = [{ nope: true }];
    localStorage.setItem(APP_STORE_KEY, JSON.stringify(saved));
    await useAppStore.persist.rehydrate();
    expect(useAppStore.getState().selfGuess).toBe(4200);
    expect(useAppStore.getState().profile.spending.rentUtilities.value).toBe(1800);
    expect(useAppStore.getState().wishlist).toEqual([]);
  });

  it('useHydrated turns true after the saved state loads', async () => {
    const { result } = renderHook(() => ({ status: useHydrated() ? 'ready' : 'loading' }));
    await waitForReady(result);
    expect(result.current.status).toBe('ready');
  });

  it('statement totals become measured spending; one-off labels are not kept; subscriptions detected', () => {
    useAppStore.getState().applyStatementTotals([
      { month: '2026-10', totals: totals({ groceries: 640, subscriptions: 42 }), oneOffs: [{ label: 'BEST BUY', amount: 899 }] },
    ]);
    const s = useAppStore.getState();
    expect(s.profile.spending.groceries).toEqual({ value: 640, isEstimate: false });
    expect(s.statementMonths[0]!.oneOffs).toEqual([]);
    expect(s.subscriptionsDetected).toBe(true);
    expect(localStorage.getItem(APP_STORE_KEY)).not.toContain('BEST BUY');
  });

  it('commit then done applies the move patch and clears the commitment', () => {
    useAppStore.getState().commitMove(move);
    expect(useAppStore.getState().profile.committedMoveId).toBe(move.id);
    useAppStore.getState().markMoveDone(move);
    const s = useAppStore.getState();
    expect(s.profile.spending.eatingOut.value).toBe(272);
    expect(s.profile.doneMoveIds).toEqual([move.id]);
    expect(s.profile.committedMoveId).toBeUndefined();
    expect(s.committedMove).toBeNull();
  });

  it('wishlist add / remove', () => {
    const id = useAppStore.getState().addToWishlist({ label: 'Laptop', amount: 1200, recurring: false, payWith: 'card' });
    expect(useAppStore.getState().wishlist.map((w) => w.id)).toEqual([id]);
    useAppStore.getState().removeFromWishlist(id);
    expect(useAppStore.getState().wishlist).toEqual([]);
  });
});

describe('anonymous id', () => {
  it('is a UUID kept in localStorage and stable across calls', () => {
    const id = getAnonId();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(localStorage.getItem(ANON_ID_KEY)).toBe(id);
    expect(getAnonId()).toBe(id);
  });
});
