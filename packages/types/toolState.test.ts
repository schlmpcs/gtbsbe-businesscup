// What each micro-tool keeps in this browser (packages/types/tools.ts, from M2): the subscription audit's slice
// (M5's shape: guess, ticks with their plan, the choices made about findings, the last audit) and the payoff
// planner's target month. Every sample is written by hand; nothing is read back from an implementation.
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  MAX_ID_LENGTH, PayoffToolStateSchema, SUBSCRIPTION_FINDINGS_MAX, SUBSCRIPTION_TICKS_MAX, SubscriptionToolStateSchema,
  ToolsStateSchema, type SubscriptionAudit,
} from './index';

const bad = (schema: z.ZodType, value: unknown) => expect(schema.safeParse(value).success).toBe(false);
const good = (schema: z.ZodType, value: unknown) => expect(schema.safeParse(value).success).toBe(true);

describe('SubscriptionToolStateSchema (the subscription audit in this browser)', () => {
  // An audit of one finding: Netflix, 17.99 a month (215.88 a year), the only finding, so both totals are those.
  const audit: SubscriptionAudit = {
    findings: [{
      id: 'netflix-com-ca', merchantKey: 'NETFLIX COM CA', label: 'NETFLIX.COM # CA', serviceId: 'netflix', category: 'video',
      cadence: 'monthly', amount: 17.99, monthly: 17.99, yearly: 215.88, chargesSeen: 5,
      lastCharge: { month: '2026-11', day: 7 }, nextExpected: { month: '2026-12', day: 7 },
      status: 'active', flags: [], confidence: 'high', origin: 'statement', isEstimate: false,
    }],
    monthlyTotal: 17.99, yearlyTotal: 215.88, monthsCovered: 5, asOf: { month: '2026-11', day: 12 },
  };
  const state = {
    guess: 86,
    ticks: [{ serviceId: 'netflix', planId: 'default' }, { serviceId: 'spotify', planId: 'default' }],
    confirmed: ['spotify-usa-ny'], dismissed: ['apple-com-bill-ca'], cancelMarked: ['netflix-com-ca', 'tick:spotify'],
    audit,
  };

  it('takes the whole slice: a guess, ticks with their plan, the choices made, and the last audit', () => {
    expect(SubscriptionToolStateSchema.parse(state)).toEqual(state);
  });

  it('fills an empty slice in: no guess, nothing ticked, no choices, no audit', () => {
    expect(SubscriptionToolStateSchema.parse({})).toEqual({ ticks: [], confirmed: [], dismissed: [], cancelMarked: [] });
    // A guess of zero is a guess.
    expect(SubscriptionToolStateSchema.parse({ guess: 0 })).toEqual({ guess: 0, ticks: [], confirmed: [], dismissed: [], cancelMarked: [] });
  });

  it('is a part of the tools state, next to the other two tools', () => {
    good(ToolsStateSchema, { subscriptions: state, payoff: { method: 'snowball', extra: 100 } });
  });

  it('accepts as many ticks as the tick-list has, and as many choices as findings plus ticks', () => {
    const ticks = Array.from({ length: SUBSCRIPTION_TICKS_MAX }, (_, i) => ({ serviceId: `service-${i}`, planId: 'default' }));
    good(SubscriptionToolStateSchema, { ticks });
    const ids = (n: number) => Array.from({ length: n }, (_, i) => `finding-${i}`);
    for (const key of ['confirmed', 'dismissed', 'cancelMarked']) {
      good(SubscriptionToolStateSchema, { [key]: ids(SUBSCRIPTION_FINDINGS_MAX + SUBSCRIPTION_TICKS_MAX) });
    }
  });

  it.each([
    ['the old fields of the first draft of the slice', { guess: 50, selectedServiceIds: ['spotify'], cancelIds: [] }],
    ['a field it does not have', { ...state, note: 'Netflix is too dear' }],
    ['a negative guess', { guess: -1 }],
    ['a guess of NaN', { guess: Number.NaN }],
    ['a guess of Infinity', { guess: Number.POSITIVE_INFINITY }],
    ['a service ticked twice', { ticks: [{ serviceId: 'netflix', planId: 'a' }, { serviceId: 'netflix', planId: 'b' }] }],
    ['a tick with no plan', { ticks: [{ serviceId: 'netflix' }] }],
    ['a tick with an extra field', { ticks: [{ serviceId: 'netflix', planId: 'default', price: 8.99 }] }],
    ['a tick with an empty service id', { ticks: [{ serviceId: '', planId: 'default' }] }],
    ['more ticks than the tick-list has', {
      ticks: Array.from({ length: SUBSCRIPTION_TICKS_MAX + 1 }, (_, i) => ({ serviceId: `service-${i}`, planId: 'default' })),
    }],
    ['an id that is not a short string', { confirmed: ['x'.repeat(MAX_ID_LENGTH + 1)] }],
    ['an empty id', { dismissed: [''] }],
    ['an id that is not a string', { cancelMarked: [7] }],
    ['more choices than findings plus ticks', { cancelMarked: Array.from({ length: SUBSCRIPTION_FINDINGS_MAX + SUBSCRIPTION_TICKS_MAX + 1 }, (_, i) => `finding-${i}`) }],
    ['an audit with a total of NaN', { audit: { ...audit, monthlyTotal: Number.NaN } }],
    ['an audit that breaks its own rules (a finding charged after the as-of date)', { audit: { ...audit, asOf: { month: '2026-11', day: 1 } } }],
    ['a list of ids that is not a list', { confirmed: 'netflix-com-ca' }],
  ])('refuses %s', (_why, value) => bad(SubscriptionToolStateSchema, value));
});

describe('PayoffToolStateSchema (the payoff planner in this browser)', () => {
  it('keeps the method and the extra payment; the method defaults, the extra stays absent until one was set', () => {
    expect(PayoffToolStateSchema.parse({})).toEqual({ method: 'avalanche' });
    expect(PayoffToolStateSchema.parse({ method: 'snowball', extra: 150 })).toEqual({ method: 'snowball', extra: 150 });
    // A saved $0 is the person's own pick and is kept as it is, not confused with "never set".
    expect(PayoffToolStateSchema.parse({ method: 'snowball', extra: 0 })).toEqual({ method: 'snowball', extra: 0 });
  });

  it('keeps a target as the calendar month it names, so it does not move when the slice is restored later', () => {
    // 'YYYY-MM': December 2029 stays December 2029, whatever day the slice is read back on.
    expect(PayoffToolStateSchema.parse({ targetMonth: '2029-12' })).toEqual({ method: 'avalanche', targetMonth: '2029-12' });
    for (const targetMonth of ['2026-01', '2026-12', '2100-06', '2126-11']) good(PayoffToolStateSchema, { targetMonth });
  });

  it.each([
    ['months from the save date, the old field that drifts', { targetMonths: 36 }],
    ['a month 13', { targetMonth: '2029-13' }],
    ['a month 00', { targetMonth: '2029-00' }],
    ['a month without its zero', { targetMonth: '2029-1' }],
    ['a full date', { targetMonth: '2029-12-01' }],
    ['a number', { targetMonth: 202912 }],
    ['text', { targetMonth: 'December 2029' }],
    ['an empty string', { targetMonth: '' }],
    ['a year before 2000', { targetMonth: '1999-12' }],
    ['a year after 2200', { targetMonth: '2201-01' }],
    ['the method "minimum"', { method: 'minimum' }],
    ['a negative extra payment', { extra: -1 }],
    ['an extra payment of Infinity', { extra: Number.POSITIVE_INFINITY }],
  ])('refuses %s', (_why, value) => bad(PayoffToolStateSchema, value));
});
