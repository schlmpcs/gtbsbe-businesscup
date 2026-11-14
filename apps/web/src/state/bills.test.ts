// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { resetClientState } from '@/test/clientState';
import { initialBillsSettings, restoreBills } from './bills';
import { APP_STORE_KEY, useAppStore } from './store';

beforeEach(resetClientState);

describe('restoreBills', () => {
  it('gives the defaults for missing or broken data', () => {
    for (const raw of [undefined, null, 'x', 3, []]) expect(restoreBills(raw)).toEqual(initialBillsSettings());
  });

  it('keeps valid due days and drops only the broken ones', () => {
    expect(restoreBills({ dueDays: { rent: 1, 'debt:a': 0, 'sub:b': 31, 'sub:c': 2.5, '': 4, 'sub:d': '5' }, paydays: null })).toEqual({
      dueDays: { rent: 1, 'sub:b': 31 },
      paydays: null,
    });
  });

  it('keeps valid paydays (sorted, unique) and falls back to "not set" for broken ones', () => {
    expect(restoreBills({ dueDays: {}, paydays: [15, 1, 15] }).paydays).toEqual([1, 15]);
    expect(restoreBills({ dueDays: {}, paydays: [] }).paydays).toBeNull();
    expect(restoreBills({ dueDays: {}, paydays: [0] }).paydays).toBeNull();
    expect(restoreBills({ dueDays: {}, paydays: [1, 2, 3, 4, 5] }).paydays).toBeNull();
  });
});

describe('app store: bills settings', () => {
  it('starts empty, sets and clears a due day, sets paydays, and persists them', () => {
    expect(useAppStore.getState().bills).toEqual({ dueDays: {}, paydays: null });
    useAppStore.getState().setBillDueDay('rent', 3);
    useAppStore.getState().setBillDueDay('sub:netflix', 31);
    useAppStore.getState().setBillDueDay('debt:x', 0); // not a day: ignored
    useAppStore.getState().setPaydays([15, 30]);
    expect(useAppStore.getState().bills).toEqual({ dueDays: { rent: 3, 'sub:netflix': 31 }, paydays: [15, 30] });
    const saved = JSON.parse(localStorage.getItem(APP_STORE_KEY)!);
    expect(saved.state.bills).toEqual({ dueDays: { rent: 3, 'sub:netflix': 31 }, paydays: [15, 30] });

    useAppStore.getState().setBillDueDay('rent', null);
    useAppStore.getState().setPaydays(null);
    expect(useAppStore.getState().bills).toEqual({ dueDays: { 'sub:netflix': 31 }, paydays: null });
  });

  it('migrates saved state from before the field existed: defaults, the rest kept', async () => {
    localStorage.setItem(APP_STORE_KEY, JSON.stringify({ version: 1, state: { selfGuess: 4100 } }));
    await useAppStore.persist.rehydrate();
    expect(useAppStore.getState().selfGuess).toBe(4100);
    expect(useAppStore.getState().bills).toEqual({ dueDays: {}, paydays: null });
  });

  it('salvages a partly broken saved field', async () => {
    localStorage.setItem(
      APP_STORE_KEY,
      JSON.stringify({ version: 1, state: { bills: { dueDays: { rent: 5, bad: 99 }, paydays: 'often' } } }),
    );
    await useAppStore.persist.rehydrate();
    expect(useAppStore.getState().bills).toEqual({ dueDays: { rent: 5 }, paydays: null });
  });

  it('reset clears them', () => {
    useAppStore.getState().setBillDueDay('rent', 3);
    useAppStore.getState().reset();
    expect(useAppStore.getState().bills).toEqual({ dueDays: {}, paydays: null });
  });
});
