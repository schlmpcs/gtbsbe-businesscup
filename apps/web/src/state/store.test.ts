// @vitest-environment jsdom
import { COST_CATEGORIES, type CostCategory, type Move } from '@lifeguessr/types';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetClientState, waitForReady } from '@/test/clientState';
import { ANON_ID_KEY, getAnonId } from './anonId';
import { useHydrated } from './hydration';
import { entriesInMonth } from './daily';
import { APP_STORE_KEY, initialAppData, isSampleActive, useAppStore } from './store';

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

  it('the subscription audit sets the subscriptions line and turns the detected flag on', () => {
    expect(useAppStore.getState().subscriptionsDetected).toBe(false);
    useAppStore.getState().applySubscriptionsAudit(69.54, true);
    let s = useAppStore.getState();
    expect(s.profile.spending.subscriptions).toEqual({ value: 69.54, isEstimate: false });
    expect(s.subscriptionsDetected).toBe(true);
    expect(s.profileOrigin).toBe('user');

    useAppStore.getState().applySubscriptionsAudit(54.97, false); // ticks only: a catalogue estimate
    s = useAppStore.getState();
    expect(s.profile.spending.subscriptions).toEqual({ value: 54.97, isEstimate: true });
    expect(s.profile.spending.groceries.value).toBe(520); // nothing else moves
    expect(JSON.parse(localStorage.getItem(APP_STORE_KEY)!).state.subscriptionsDetected).toBe(true);
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

  it('remembers the forecast horizon: 10 years by default, saved, and back to 10 on reset', () => {
    expect(useAppStore.getState().horizonYears).toBe(10);
    useAppStore.getState().setHorizonYears(3);
    expect(useAppStore.getState().horizonYears).toBe(3);
    expect(JSON.parse(localStorage.getItem(APP_STORE_KEY)!).state.horizonYears).toBe(3);
    useAppStore.getState().reset();
    expect(useAppStore.getState().horizonYears).toBe(10);
  });

  it.each([
    ['without the field', undefined],
    ['with a horizon the picker does not offer', 7],
  ])('hydrates a saved state %s to 10 years, keeping the saved profile', async (_label, saved) => {
    useAppStore.getState().setSpending('rentUtilities', 1800);
    const stored = JSON.parse(localStorage.getItem(APP_STORE_KEY)!);
    if (saved === undefined) delete stored.state.horizonYears;
    else stored.state.horizonYears = saved;
    useAppStore.setState({ profile: initialAppData().profile }); // (persisted too: written over below)
    localStorage.setItem(APP_STORE_KEY, JSON.stringify(stored));
    await useAppStore.persist.rehydrate();
    expect(useAppStore.getState().horizonYears).toBe(10);
    expect(useAppStore.getState().profile.spending.rentUtilities.value).toBe(1800);
  });

  it('loads the sample life only without a profile of the user’s own; an edit or "Use mine" ends it', async () => {
    expect(useAppStore.getState().loadSample()).toBe(true);
    expect(useAppStore.getState().isSample).toBe(true);
    expect(isSampleActive(useAppStore.getState())).toBe(true);
    expect(JSON.parse(localStorage.getItem(APP_STORE_KEY)!).state.isSample).toBe(true);
    useAppStore.setState({ isSample: false }, false); // (persisted too) then a reload brings back the saved flag
    const saved = JSON.parse(localStorage.getItem(APP_STORE_KEY)!);
    saved.state.isSample = true;
    localStorage.setItem(APP_STORE_KEY, JSON.stringify(saved));
    await useAppStore.persist.rehydrate();
    expect(useAppStore.getState().isSample).toBe(true);

    useAppStore.getState().clearSample();
    expect(isSampleActive(useAppStore.getState())).toBe(false);

    useAppStore.getState().loadSample();
    useAppStore.getState().setSpending('groceries', 640); // the life is now the user's own
    expect(isSampleActive(useAppStore.getState())).toBe(false);
    const mine = useAppStore.getState().profile;
    expect(useAppStore.getState().loadSample()).toBe(false);
    expect(useAppStore.getState().profile).toBe(mine);
  });

  it('wishlist add / remove', () => {
    const id = useAppStore.getState().addToWishlist({ label: 'Laptop', amount: 1200, recurring: false, payWith: 'card' });
    expect(useAppStore.getState().wishlist.map((w) => w.id)).toEqual([id]);
    useAppStore.getState().removeFromWishlist(id);
    expect(useAppStore.getState().wishlist).toEqual([]);
  });

  it('daily log: add, list by month (newest first), undo, persisted, cleared by reset', () => {
    const s = () => useAppStore.getState();
    const [coffee] = s().addDailyEntries([{ category: 'eatingOut', amount: 5, label: 'coffee' }], '2026-11-02');
    const ids = s().addDailyEntries(
      [{ category: 'other', amount: 18, label: 'taxi' }, { category: 'groceries', amount: 64 }],
      '2026-11-14',
    );
    s().addDailyEntries([{ category: 'groceries', amount: 99 }], '2026-10-30');
    expect(ids).toHaveLength(2);
    expect(entriesInMonth(s().dailyEntries, '2026-11').map((e) => e.amount)).toEqual([64, 18, 5]);
    expect(entriesInMonth(s().dailyEntries, '2026-10').map((e) => e.amount)).toEqual([99]);
    expect(JSON.parse(localStorage.getItem(APP_STORE_KEY)!).state.dailyEntries).toHaveLength(4);

    s().removeDailyEntries(ids); // undo of the second add
    expect(entriesInMonth(s().dailyEntries, '2026-11').map((e) => e.id)).toEqual([coffee]);

    expect(() => s().addDailyEntries([{ category: 'other', amount: -1 }], '2026-11-14')).toThrow();
    expect(() => s().addDailyEntries([{ category: 'other', amount: 1 }], '2026-11-31')).toThrow();
    expect(s().dailyEntries).toHaveLength(2);

    s().reset();
    expect(s().dailyEntries).toEqual([]);
  });

  it('a version 1 save (before the daily log) restores everything, with an empty log', async () => {
    useAppStore.getState().setSelfGuess(4100);
    const stored = JSON.parse(localStorage.getItem(APP_STORE_KEY)!);
    expect(stored.version).toBe(2);
    delete stored.state.dailyEntries;
    stored.version = 1;
    useAppStore.setState({ selfGuess: null, dailyEntries: [] });
    localStorage.setItem(APP_STORE_KEY, JSON.stringify(stored));
    await useAppStore.persist.rehydrate();
    expect(useAppStore.getState().selfGuess).toBe(4100);
    expect(useAppStore.getState().dailyEntries).toEqual([]);
  });

  it('a broken saved log entry is dropped, the others kept', async () => {
    useAppStore.getState().addDailyEntries([{ category: 'other', amount: 7 }], '2026-11-03');
    const stored = JSON.parse(localStorage.getItem(APP_STORE_KEY)!);
    stored.state.dailyEntries.push({ id: 'bad', date: 'yesterday', category: 'other', amount: 3 });
    useAppStore.setState({ dailyEntries: [] });
    localStorage.setItem(APP_STORE_KEY, JSON.stringify(stored));
    await useAppStore.persist.rehydrate();
    expect(useAppStore.getState().dailyEntries.map((e) => e.amount)).toEqual([7]);
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
