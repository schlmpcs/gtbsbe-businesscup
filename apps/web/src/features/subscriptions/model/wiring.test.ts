// @vitest-environment jsdom
// The audit on its real pieces: M4's catalogue (`knownServices`) and the app store's `tools.subscriptions`
// slice (M2), with only the statement categorizer faked (it is a network call). Saving, restoring after a
// reload, and a damaged slice being dropped without a throw are checked on the real store and the real
// browser storage of the test (jsdom localStorage).
import { knownServices } from '@lifeguessr/data/subscriptions';
import { subscriptionsExpected } from '@lifeguessr/data/fixtures/tools';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_STORE_KEY, useAppStore } from '@/state';
import { resetClientState } from '@/test/clientState';
import { fakeCategorize, reloadAppStore as reload, sampleStatementFile } from '@/test/subscriptions';
import { useSubscriptions } from './useSubscriptions';
import { useSubscriptionsDeps } from './wiring';

const trackTool = vi.fn();
const categorize = fakeCategorize();

/** The tool as a page builds it: the wired deps, with the categorizer and the opened-event faked. */
function renderWired() {
  return renderHook(() => {
    const deps = useSubscriptionsDeps();
    const profile = useAppStore((s) => s.profile);
    const vm = useSubscriptions(profile, { ...deps, track: () => {}, trackTool, categorize });
    return { deps, vm };
  });
}
const ready = (view: ReturnType<typeof renderWired>) => waitFor(() => expect(view.result.current.vm.status).toBe('ready'));
const savedSlice = () => JSON.parse(localStorage.getItem(APP_STORE_KEY)!).state.tools?.subscriptions;

beforeEach(() => {
  resetClientState();
  trackTool.mockClear();
});

describe('wiring: the real catalogue and the real store slice', () => {
  it('is connected: M4’s catalogue and a store that starts empty', async () => {
    const view = renderWired();
    await ready(view);
    expect(view.result.current.deps.catalogue).toBe(knownServices);
    expect(view.result.current.deps.store.state).toBeUndefined();
    expect(useAppStore.getState().tools).toEqual({});
    expect(trackTool).toHaveBeenCalledExactlyOnceWith('subscriptions');
  });

  it('keeps the same store object while nothing changes, so the view-model does not rebuild on every render', async () => {
    const view = renderWired();
    await ready(view);
    const first = view.result.current.deps.store;
    view.rerender();
    expect(view.result.current.deps.store).toBe(first);
    act(() => view.result.current.vm.guess.set(40));
    expect(view.result.current.deps.store).not.toBe(first);
    expect(view.result.current.deps.store.state).toMatchObject({ guess: 40 });
  });

  it('saves through setTool into tools.subscriptions and clears through clearTool, leaving the other tools alone', async () => {
    useAppStore.getState().setTool('payoff', { method: 'snowball', extra: 100 });
    const view = renderWired();
    await ready(view);
    act(() => view.result.current.vm.guess.set(86));
    act(() => view.result.current.vm.ticks.toggle('netflix'));
    expect(useAppStore.getState().tools.subscriptions).toEqual({
      guess: 86, ticks: [{ serviceId: 'netflix', planId: 'default' }], confirmed: [], dismissed: [], cancelMarked: [],
    });
    expect(savedSlice()).toEqual(useAppStore.getState().tools.subscriptions); // written to the browser's storage
    act(() => view.result.current.vm.clearLocalData());
    expect(useAppStore.getState().tools).toEqual({ payoff: { method: 'snowball', extra: 100 } });
    expect(savedSlice()).toBeUndefined();
  });

  it('finds the golden findings of the sample statement on the real catalogue: $69.54 a month, $834.52 a year', async () => {
    const view = renderWired();
    await ready(view);
    act(() => view.result.current.vm.statement.upload(sampleStatementFile()));
    await waitFor(() => expect(view.result.current.vm.statement.status).toBe('done'));
    const { findings } = view.result.current.vm;
    expect(findings.active.map((f) => f.id)).toEqual(subscriptionsExpected.findings.map((f) => f.id));
    expect(findings).toMatchObject({ found: 5, monthly: 69.54, yearly: 834.52 });
    expect(findings.active.map((f) => f.name)).toEqual(['Planet Fitness', 'Netflix', 'Spotify', 'Amazon Prime', 'APPLE.COM/BILL # CA']);
  });

  it('survives a reload: the guess, the ticks, the findings and the choices are all back, and the tool starts where it left off', async () => {
    const view = renderWired();
    await ready(view);
    act(() => view.result.current.vm.guess.set(40));
    act(() => view.result.current.vm.ticks.toggle('netflix'));
    act(() => view.result.current.vm.statement.upload(sampleStatementFile()));
    await waitFor(() => expect(view.result.current.vm.statement.status).toBe('done'));
    act(() => view.result.current.vm.findings.dismiss('apple-com-bill-ca'));
    act(() => view.result.current.vm.plan.markCancel('spotify-usa-ny'));
    const before = useAppStore.getState().tools.subscriptions;
    view.unmount();

    await reload();
    expect(useAppStore.getState().tools.subscriptions).toEqual(before);

    const again = renderWired();
    await ready(again);
    const { vm } = again.result.current;
    expect(vm.step).toBe('findings');
    expect(vm.guess.value).toBe(40);
    expect(vm.ticks.count).toBe(1);
    expect(vm.findings).toMatchObject({ found: 4, dismissedCount: 1, monthly: 66.55 }); // 69.54 − 2.99 (Apple dismissed)
    expect(vm.plan).toMatchObject({ markedCount: 1, saving: { monthly: 11.99 } });
  });

  it('a damaged slice is dropped without a throw: the tool starts empty, and the profile and the other tools are kept', async () => {
    useAppStore.getState().setSpending('groceries', 640);
    useAppStore.getState().setTool('payoff', { method: 'snowball', extra: 100 });
    const saved = JSON.parse(localStorage.getItem(APP_STORE_KEY)!);
    saved.state.tools.subscriptions = { guess: -1, ticks: 'nope', audit: { findings: 'x' } };
    localStorage.setItem(APP_STORE_KEY, JSON.stringify(saved));

    await expect(reload()).resolves.not.toThrow();
    expect(useAppStore.getState().tools).toEqual({ payoff: { method: 'snowball', extra: 100 } });
    expect(useAppStore.getState().profile.spending.groceries.value).toBe(640);

    const view = renderWired();
    await ready(view);
    expect(view.result.current.vm.step).toBe('statement');
    expect(view.result.current.deps.store.state).toBeUndefined();
    act(() => view.result.current.vm.ticks.toggle('netflix')); // and it saves again
    expect(savedSlice().ticks).toEqual([{ serviceId: 'netflix', planId: 'default' }]);
  });

  it('a slice whose audit was damaged on its own is dropped whole, never half-restored', async () => {
    const view = renderWired();
    await ready(view);
    act(() => view.result.current.vm.statement.upload(sampleStatementFile()));
    await waitFor(() => expect(view.result.current.vm.statement.status).toBe('done'));
    view.unmount();
    await reload();
    expect(useAppStore.getState().tools.subscriptions?.audit?.findings).toHaveLength(5); // undamaged, it comes back whole
    const saved = JSON.parse(localStorage.getItem(APP_STORE_KEY)!);
    saved.state.tools.subscriptions.audit.findings[0].monthly = -5;
    localStorage.setItem(APP_STORE_KEY, JSON.stringify(saved));
    await reload();
    expect(useAppStore.getState().tools.subscriptions).toBeUndefined();
  });
});
