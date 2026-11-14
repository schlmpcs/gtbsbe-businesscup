// @vitest-environment jsdom
import { beforeEach, expect, it } from 'vitest';
import { resetClientState } from '@/test/clientState';
import { APP_STORE_KEY, useAppStore } from './store';
import { restoreTools } from './tools';
beforeEach(resetClientState);
it('persists tool settings and resets only the damaged tool on hydration', async () => {
  useAppStore.getState().setSpending('groceries', 640);
  useAppStore.getState().setTool('payoff', { method: 'snowball', extra: 100 });
  useAppStore
    .getState()
    .setTool('subscriptions', {
      guess: 50,
      ticks: [{ serviceId: 'spotify', planId: 'default' }],
      confirmed: [],
      dismissed: [],
      cancelMarked: [],
    });
  const saved = JSON.parse(localStorage.getItem(APP_STORE_KEY)!);
  expect(saved.state.tools.payoff.extra).toBe(100);
  saved.state.tools.subscriptions = { guess: -1 };
  localStorage.setItem(APP_STORE_KEY, JSON.stringify(saved));
  await useAppStore.persist.rehydrate();
  const state = useAppStore.getState();
  expect(state.tools).toEqual({ payoff: { method: 'snowball', extra: 100 } });
  expect(state.profile.spending.groceries.value).toBe(640);
  state.clearTool('payoff');
  expect(useAppStore.getState().tools).toEqual({});
});
it('migrates missing tool data and refuses malformed settings', () => {
  expect(restoreTools(undefined)).toEqual({});
  expect(restoreTools({ payoff: { extra: Infinity } })).toEqual({});
  expect(() =>
    useAppStore
      .getState()
      .setTool('payoff', { method: 'avalanche', extra: -1 }),
  ).toThrow();
});
it('restores the subscription audit slice in full, and drops a damaged one without touching the other tools', () => {
  const slice = {
    guess: 86,
    ticks: [{ serviceId: 'netflix', planId: 'default' }],
    confirmed: ['spotify-usa-ny'],
    dismissed: [],
    cancelMarked: ['tick:netflix'],
  };
  expect(restoreTools({ subscriptions: slice, payoff: { method: 'snowball', extra: 50 } })).toEqual({
    subscriptions: slice,
    payoff: { method: 'snowball', extra: 50 },
  });
  // Saved by the first draft of the slice, or with a service ticked twice: dropped, not thrown, and the payoff slice survives.
  const old = { guess: 50, selectedServiceIds: ['spotify'], cancelIds: [] };
  const twice = { ticks: [{ serviceId: 'a', planId: 'x' }, { serviceId: 'a', planId: 'y' }] };
  for (const damaged of [old, twice]) {
    expect(() => restoreTools({ subscriptions: damaged, payoff: { extra: 5 } })).not.toThrow();
    expect(restoreTools({ subscriptions: damaged, payoff: { extra: 5 } })).toEqual({ payoff: { method: 'avalanche', extra: 5 } });
  }
});
it('restores a payoff target as a calendar month, and drops one saved as months from the save date', () => {
  expect(restoreTools({ payoff: { extra: 5, targetMonth: '2029-12' } })).toEqual({
    payoff: { method: 'avalanche', extra: 5, targetMonth: '2029-12' },
  });
  expect(restoreTools({ payoff: { extra: 5, targetMonths: 36 } })).toEqual({});
});
