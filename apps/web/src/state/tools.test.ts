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
      selectedServiceIds: ['spotify'],
      cancelIds: [],
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
