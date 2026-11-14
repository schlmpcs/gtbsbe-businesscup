// @vitest-environment jsdom
import { COST_CATEGORIES, MAX_LIFE_EVENTS, type CostCategory, type LifeEvent, type Move } from '@lifeguessr/types';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetClientState, waitForReady } from '@/test/clientState';
import { ANON_ID_KEY, getAnonId } from './anonId';
import { useHydrated } from './hydration';
import { SESSION_SAVE_DEBOUNCE_MS, setSessionAdapter, useSessionSync } from './sessionSync';
import { APP_STORE_KEY, initialAppData, isSampleActive, useAppStore } from './store';

const totals = (over: Partial<Record<CostCategory, number>>) =>
  Object.fromEntries(COST_CATEGORIES.map((c) => [c, over[c] ?? 0])) as Record<CostCategory, number>;

const move: Move = { id: 'cutCategory:eatingOut', kind: 'cutCategory', level: 1, category: 'eatingOut', effect10y: 5000, patch: { spending: { eatingOut: 272 } } };

beforeEach(resetClientState);
afterEach(() => vi.useRealTimers());

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
});

describe('life events in the store', () => {
  const raise: LifeEvent = { id: 'ev-raise', kind: 'pay', month: '2027-03', preset: 'raise', takeHomePay: { value: 6_000, isEstimate: false } };
  const kid: LifeEvent = {
    id: 'ev-kid', kind: 'spending', month: '2027-06', preset: 'kid', category: 'childcare', monthly: { value: 1_375, isEstimate: true },
  };
  const trip: LifeEvent = { id: 'ev-trip', kind: 'oneOff', month: '2026-12', amount: 3_000, direction: 'cost' };
  const events = () => useAppStore.getState().profile.events ?? [];

  it('adds, updates and removes events on the profile; an edit makes the life the user’s own', () => {
    expect(useAppStore.getState().addLifeEvent(raise)).toBe(true);
    expect(useAppStore.getState().profileOrigin).toBe('user');
    useAppStore.getState().addLifeEvent(kid);
    expect(events().map((e) => e.id)).toEqual(['ev-raise', 'ev-kid']);

    useAppStore.getState().updateLifeEvent('ev-raise', { ...raise, id: 'ignored', takeHomePay: { value: 6_500, isEstimate: false } });
    expect(events()[0]).toEqual({ ...raise, takeHomePay: { value: 6_500, isEstimate: false } }); // the id is kept

    useAppStore.getState().removeLifeEvent('ev-raise');
    expect(events().map((e) => e.id)).toEqual(['ev-kid']);
  });

  it(`rejects a ${MAX_LIFE_EVENTS + 1}th event and an invalid one, changing nothing`, () => {
    for (let i = 0; i < MAX_LIFE_EVENTS; i++) expect(useAppStore.getState().addLifeEvent({ ...trip, id: `ev-${i}` })).toBe(true);
    const before = useAppStore.getState().profile;
    expect(useAppStore.getState().addLifeEvent({ ...trip, id: 'one-too-many' })).toBe(false);
    expect(useAppStore.getState().profile).toBe(before);

    useAppStore.getState().reset();
    expect(useAppStore.getState().addLifeEvent({ ...trip, amount: 0 })).toBe(false);
    expect(useAppStore.getState().addLifeEvent({ ...trip, month: '2027-13' })).toBe(false);
    expect(useAppStore.getState().profile.events).toBeUndefined();
    expect(useAppStore.getState().profileOrigin).toBe('demo');
  });

  it('persists the events with the profile, never `asOf`', async () => {
    useAppStore.getState().addLifeEvent(kid);
    // Even a profile handed in with `asOf` (a stamped one) is stored without it.
    useAppStore.getState().setProfile({ ...useAppStore.getState().profile, asOf: '2026-11' }, 'user');
    expect(useAppStore.getState().profile.asOf).toBeUndefined();
    const saved = JSON.parse(localStorage.getItem(APP_STORE_KEY)!);
    expect(saved.state.profile.events).toEqual([kid]);
    expect(saved.state.profile).not.toHaveProperty('asOf');

    useAppStore.setState({ profile: initialAppData().profile });
    localStorage.setItem(APP_STORE_KEY, JSON.stringify(saved));
    await useAppStore.persist.rehydrate();
    expect(useAppStore.getState().profile.events).toEqual([kid]);
  });

  it('folds started events into today: pay and spending values (with isEstimate), past one-offs dropped, future ones kept', () => {
    for (const e of [raise, kid, trip]) useAppStore.getState().addLifeEvent(e);
    const later: LifeEvent = { ...raise, id: 'ev-later', month: '2028-01', takeHomePay: { value: 7_000, isEstimate: false } };
    useAppStore.getState().addLifeEvent(later);

    const notes = useAppStore.getState().foldStartedEvents('2027-06');
    const s = useAppStore.getState();
    expect(s.profile.takeHomePay).toEqual({ value: 6_000, isEstimate: false });
    expect(s.profile.spending.childcare).toEqual({ value: 1_375, isEstimate: true });
    expect(s.profile.events).toEqual([later]);
    expect(notes).toEqual([
      { kind: 'oneOff', month: '2026-12', direction: 'cost' },
      { kind: 'pay', month: '2027-03', preset: 'raise' },
      { kind: 'spending', month: '2027-06', preset: 'kid', category: 'childcare' },
    ]);
    expect(s.foldedNotes).toEqual(notes);

    // Nothing more to fold: the profile and the notes stay as they are.
    const profile = s.profile;
    expect(useAppStore.getState().foldStartedEvents('2027-06')).toEqual([]);
    expect(useAppStore.getState().profile).toBe(profile);
    expect(useAppStore.getState().foldedNotes).toEqual(notes);

    // S10 shows them once: they leave the saved state, and stay on screen until dismissed.
    useAppStore.getState().showFoldedNotes();
    expect(useAppStore.getState().foldedNotes).toEqual([]);
    expect(useAppStore.getState().foldedNotesShown).toEqual(notes);
    expect(JSON.parse(localStorage.getItem(APP_STORE_KEY)!).state).not.toHaveProperty('foldedNotesShown');
    useAppStore.getState().dismissFoldedNotes();
    expect(useAppStore.getState().foldedNotesShown).toEqual([]);
  });

  it('folds several started events on one field in month order: the latest start wins', () => {
    const early: LifeEvent = { ...raise, id: 'a', month: '2027-05', takeHomePay: { value: 9_000, isEstimate: true } };
    useAppStore.getState().addLifeEvent(early);
    useAppStore.getState().addLifeEvent(raise); // 2027-03, added later but starts earlier
    useAppStore.getState().foldStartedEvents('2027-06');
    expect(useAppStore.getState().profile.takeHomePay).toEqual({ value: 9_000, isEstimate: true });
    expect(useAppStore.getState().profile.events).toEqual([]);
  });

  it('the server session carries the events inside the profile (never `asOf`), both ways', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const restored = { ...initialAppData().profile, events: [raise, kid] };
    setSessionAdapter({ enabled: true, load: vi.fn().mockResolvedValue({ profile: restored }), save });
    renderHook(() => useSessionSync(true));
    await waitFor(() => expect(useAppStore.getState().profile.events).toEqual([raise, kid]));
    expect(useAppStore.getState().profileOrigin).toBe('user');

    vi.useFakeTimers();
    act(() => void useAppStore.getState().addLifeEvent(trip));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SESSION_SAVE_DEBOUNCE_MS);
    });
    const saved = save.mock.lastCall![1];
    expect(saved.profile.events).toEqual([raise, kid, trip]);
    expect(saved.profile).not.toHaveProperty('asOf');
  });

  it('a life card on S6, the sample life and reset replace the events with the new profile’s (none)', () => {
    const add = () => useAppStore.getState().addLifeEvent(kid);
    add();
    useAppStore.getState().chooseClosestLife('card-1', initialAppData().profile);
    expect(useAppStore.getState().profile.events).toBeUndefined();

    add();
    useAppStore.getState().reset();
    expect(useAppStore.getState().profile.events).toBeUndefined();

    useAppStore.setState({ profile: { ...initialAppData().profile, events: [kid] }, profileOrigin: 'demo' });
    expect(useAppStore.getState().loadSample()).toBe(true);
    expect(useAppStore.getState().profile.events).toBeUndefined();
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
