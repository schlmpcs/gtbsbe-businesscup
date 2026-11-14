import { subscriptionsExpected } from '@lifeguessr/data/fixtures/tools';
import { describe, expect, it } from 'vitest';
import { SubscriptionToolStateSchema as SubscriptionsToolStateSchema } from '@lifeguessr/types';
import { emptyToolState, restoreToolState } from './state';

describe('the slice schema the tool saves with (the contract’s SubscriptionToolStateSchema)', () => {
  it('an empty object is the empty state: the lists default to empty', () => {
    expect(SubscriptionsToolStateSchema.parse({})).toEqual(emptyToolState());
    expect(emptyToolState()).toEqual({ ticks: [], confirmed: [], dismissed: [], cancelMarked: [] });
  });

  it('takes every field of the issue’s slice and survives a trip through JSON', () => {
    const state = {
      guess: 86,
      ticks: [{ serviceId: 'netflix', planId: 'standard' }, { serviceId: 'spotify', planId: 'individual' }],
      confirmed: ['maybe-one'], dismissed: ['not-one'], cancelMarked: ['tick:netflix', 'apple-com-bill-ca'],
      audit: structuredClone(subscriptionsExpected),
    };
    const parsed = SubscriptionsToolStateSchema.parse(state);
    expect(parsed).toEqual(state);
    expect(restoreToolState(JSON.parse(JSON.stringify(parsed)))).toEqual(state);
  });

  it('a guess of 0 is a guess; a negative, infinite or non-numeric one is not', () => {
    expect(SubscriptionsToolStateSchema.safeParse({ guess: 0 }).success).toBe(true);
    for (const guess of [-1, Infinity, Number.NaN, '50']) expect(SubscriptionsToolStateSchema.safeParse({ guess }).success, String(guess)).toBe(false);
  });

  it('refuses a service ticked twice, unknown fields and an audit that is not one', () => {
    const tick = { serviceId: 'netflix', planId: 'standard' };
    expect(SubscriptionsToolStateSchema.safeParse({ ticks: [tick, { ...tick, planId: 'premium' }] }).success).toBe(false);
    expect(SubscriptionsToolStateSchema.safeParse({ extra: 1 }).success).toBe(false);
    expect(SubscriptionsToolStateSchema.safeParse({ ticks: [{ serviceId: 'netflix' }] }).success).toBe(false);
    expect(SubscriptionsToolStateSchema.safeParse({ audit: { findings: [], monthlyTotal: -1, yearlyTotal: 0, monthsCovered: 0, asOf: null } }).success).toBe(false);
  });
});

describe('restoreToolState', () => {
  it('gives the state when it is valid, undefined for anything else: a damaged slice never takes more with it', () => {
    expect(restoreToolState({ guess: 40 })).toEqual({ guess: 40, ticks: [], confirmed: [], dismissed: [], cancelMarked: [] });
    expect(restoreToolState(undefined)).toBeUndefined();
    expect(restoreToolState('nope')).toBeUndefined();
    expect(restoreToolState({ guess: -1 })).toBeUndefined();
  });
});
