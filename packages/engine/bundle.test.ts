// rulesBundle() and forecastFacts() (Y15). Fixtures only.
import { describe, expect, it } from 'vitest';
import type { ProfilePatch } from '@lifeguessr/types';
import { ForecastBundleSchema, ForecastSchema } from '@lifeguessr/types';
import { areaByZip, cloneProfileDemo, profileDemo } from '@lifeguessr/data/fixtures';
import { forecastFacts, rulesBundle } from './bundle';
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
