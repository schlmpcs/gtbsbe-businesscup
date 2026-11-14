// rulesBundle() and forecastFacts() (Y15). Fixtures only.
import { describe, expect, it } from 'vitest';
import type { LifeEvent, Profile, ProfilePatch } from '@lifeguessr/types';
import { ForecastBundleSchema, ForecastSchema } from '@lifeguessr/types';
import { areaByZip, cloneProfileDemo, profileDemo } from '@lifeguessr/data/fixtures';
import { forecastFacts, rulesBundle } from './bundle';
import { addMonths } from './events';
import { applyPatch, forecast } from './forecast';
import { inflationAnnualOf } from './simulate';

const rates = { inflationAnnual: inflationAnnualOf(areaByZip(profileDemo.zip!)) };
const patchA: ProfilePatch = { spending: { eatingOut: 200 } };
const patchB: ProfilePatch = { debts: [{ id: 'card-1', extraPayment: 400 }] };

describe('rulesBundle', () => {
  const bundle = rulesBundle(profileDemo, [{ id: 'a', patch: patchA }, { id: 'b', patch: patchB }], rates);

  it('is a rules bundle in nominal dollars, with no model', () => {
    expect(bundle.source).toBe('rules');
    expect('model' in bundle).toBe(false);
    expect(bundle.base.todaysDollars).toBe(false);
    for (const f of Object.values(bundle.scenarios)) expect(f.todaysDollars).toBe(false);
  });

  it('base is forecast(profile, 10, { rates })', () => {
    expect(bundle.base).toEqual(forecast(profileDemo, 10, { rates }));
  });

  it('each scenario is forecast(applyPatch(profile, patch), 10, { rates }), keyed by id', () => {
    expect(Object.keys(bundle.scenarios)).toEqual(['a', 'b']);
    expect(bundle.scenarios.a).toEqual(forecast(applyPatch(profileDemo, patchA), 10, { rates }));
    expect(bundle.scenarios.b).toEqual(forecast(applyPatch(profileDemo, patchB), 10, { rates }));
  });

  it('every forecast has 121 points and a move changes the 10-year result', () => {
    expect(bundle.base.points).toHaveLength(121);
    expect(bundle.scenarios.a!.points).toHaveLength(121);
    expect(bundle.scenarios.a!.in10y.mid).toBeGreaterThan(bundle.base.in10y.mid);
  });

  it('parses with ForecastBundleSchema, and each forecast with ForecastSchema', () => {
    expect(ForecastBundleSchema.safeParse(bundle).success).toBe(true);
    expect(ForecastSchema.safeParse(bundle.base).success).toBe(true);
  });

  it('works with no scenarios and with default rates', () => {
    const none = rulesBundle(profileDemo, []);
    expect(none.scenarios).toEqual({});
    expect(none.base).toEqual(forecast(profileDemo, 10, { rates: undefined }));
    expect(ForecastBundleSchema.safeParse(none).success).toBe(true);
  });

  it('does not mutate the (frozen) profile or the patches', () => {
    const before = cloneProfileDemo();
    rulesBundle(profileDemo, [{ id: 'a', patch: patchA }], rates);
    expect(profileDemo).toEqual(before);
  });
});

describe('forecastFacts', () => {
  it('has no zip, committedMoveId or doneMoveIds', () => {
    const p = { ...cloneProfileDemo(), committedMoveId: 'cutCategory:eatingOut', doneMoveIds: ['payCardFirst:card-1'] };
    const facts = forecastFacts(p);
    expect(facts).not.toHaveProperty('zip');
    expect(facts).not.toHaveProperty('committedMoveId');
    expect(facts).not.toHaveProperty('doneMoveIds');
  });

  it('keeps every other field, value for value', () => {
    const { zip: _zip, committedMoveId: _committed, doneMoveIds: _done, ...rest } = cloneProfileDemo();
    expect(forecastFacts(profileDemo)).toEqual(rest);
    expect(Object.keys(forecastFacts(profileDemo)).sort()).toEqual(
      ['age', 'cash', 'debts', 'retirement', 'retirementShare', 'spending', 'takeHomePay'],
    );
  });

  it('gives equal facts for profiles that differ only in those fields', () => {
    const a = { ...cloneProfileDemo(), zip: '75206', committedMoveId: 'cutCategory:eatingOut', doneMoveIds: ['x'] };
    const b = { ...cloneProfileDemo(), zip: '10001', doneMoveIds: [] };
    expect(forecastFacts(a)).toEqual(forecastFacts(b));
    expect(JSON.stringify(forecastFacts(a))).toBe(JSON.stringify(forecastFacts(b)));
  });

  it('gives different facts when a number differs', () => {
    const a = cloneProfileDemo();
    const b = cloneProfileDemo();
    b.cash.value += 1;
    expect(forecastFacts(a)).not.toEqual(forecastFacts(b));
  });

  it('is a copy: changing the facts does not reach the profile', () => {
    const p = cloneProfileDemo();
    const facts = forecastFacts(p);
    facts.cash.value = 999_999;
    facts.spending.eatingOut.value = 999_999;
    facts.debts[0]!.balance = 999_999;
    expect(p).toEqual(cloneProfileDemo());
  });
});

describe('forecastFacts: life events', () => {
  const events: LifeEvent[] = [
    { id: 'ev-raise', kind: 'pay', month: '2027-02', preset: 'raise', takeHomePay: { value: 5_200, isEstimate: false } },
    { id: 'ev-kid', kind: 'spending', month: '2028-03', preset: 'kid', category: 'childcare', monthly: { value: 1_100, isEstimate: true } },
    { id: 'ev-car', kind: 'oneOff', month: '2027-06', preset: 'bigPurchase', amount: 9_000, direction: 'cost' },
  ];
  const withEvents = (asOf: string, evs: LifeEvent[] = events): Profile => ({ ...cloneProfileDemo(), events: evs, asOf });

  it('gives each event as kind, startsInMonths and its values; no id, month, preset or asOf', () => {
    const facts = forecastFacts(withEvents('2026-11'));
    expect(facts.events).toEqual([
      { kind: 'pay', startsInMonths: 3, takeHomePay: { value: 5_200, isEstimate: false } },
      { kind: 'spending', startsInMonths: 16, category: 'childcare', monthly: { value: 1_100, isEstimate: true } },
      { kind: 'oneOff', startsInMonths: 7, amount: 9_000, direction: 'cost' },
    ]);
    expect(facts).not.toHaveProperty('asOf');
    for (const e of facts.events!) {
      for (const key of ['id', 'month', 'preset']) expect(e).not.toHaveProperty(key);
    }
  });

  it('never passes on a field outside the contract (no free text)', () => {
    const sneaky = { ...events[0]!, label: 'Promotion at Acme' } as unknown as LifeEvent;
    expect(JSON.stringify(forecastFacts(withEvents('2026-11', [sneaky])))).not.toContain('Acme');
  });

  it('has no events key without events, and drops a lone asOf', () => {
    expect(forecastFacts({ ...cloneProfileDemo(), events: [], asOf: '2026-11' })).toEqual(forecastFacts(profileDemo));
    expect(forecastFacts({ ...cloneProfileDemo(), asOf: '2026-11' })).not.toHaveProperty('asOf');
    expect(forecastFacts(profileDemo)).not.toHaveProperty('events');
  });

  it('changes when the month rolls over (each event is a month closer), and only then', () => {
    const nov = forecastFacts(withEvents('2026-11'));
    const dec = forecastFacts(withEvents('2026-12'));
    expect(dec).not.toEqual(nov);
    expect(dec.events!.map((e) => e.startsInMonths)).toEqual([2, 15, 6]);
    expect(forecastFacts(withEvents('2026-11'))).toEqual(nov);
    // a profile one month later with every event one month later is the same situation
    const later = events.map((e) => ({ ...e, month: addMonths(e.month, 1) }));
    expect(forecastFacts(withEvents('2026-12', later))).toEqual(nov);
  });

  it('refuses events without asOf (RangeError)', () => {
    expect(() => forecastFacts({ ...cloneProfileDemo(), events })).toThrow(RangeError);
  });

  it('the rules bundle follows the events', () => {
    const p = withEvents('2026-11');
    expect(rulesBundle(p, [], rates).base).toEqual(forecast(p, 10, { rates }));
    expect(rulesBundle(p, [], rates).base.in10y.mid).not.toBe(rulesBundle(profileDemo, [], rates).base.in10y.mid);
  });
});
