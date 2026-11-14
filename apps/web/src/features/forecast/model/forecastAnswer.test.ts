import { forecast, moveCandidates, rulesBundle } from '@lifeguessr/engine';
import type { Forecast, ForecastBundle, Profile } from '@lifeguessr/types';
import { describe, expect, it } from 'vitest';
import { cloneProfileDemo } from '@/fixtures';
import { areaRates } from '@/lib/model/profile';
import {
  answerDollars, bandIsZero, bandKindOf, buildRequest, committedScenario, committedScenarioId, coversRequest,
  forecastIsBusy, patchesEqual, shownForecast,
} from './forecastAnswer';
import type { ForecastAnswer, ForecastState } from './types';

const profile = cloneProfileDemo();
const candidates = moveCandidates(profile, { rates: areaRates(profile) });
const scenarios = candidates.map(({ id, patch }) => ({ id, patch }));
const bundle = rulesBundle(profile, scenarios, areaRates(profile));
const answer: ForecastAnswer = { bundle, profile, candidates };
const ready = (source: 'ai' | 'rules', isRefreshing = false, a: ForecastAnswer = answer, isStale = false): ForecastState => ({
  status: 'ready', source, answer: a, isRefreshing, isStale,
});

describe('patchesEqual', () => {
  it('ignores key order, not values', () => {
    expect(patchesEqual({ debts: [{ id: 'a', extraPayment: 5, apr: 0.2 }], retirementShare: 0.1 }, { retirementShare: 0.1, debts: [{ apr: 0.2, id: 'a', extraPayment: 5 }] })).toBe(true);
    expect(patchesEqual({ spending: { other: 100 } }, { spending: { other: 101 } })).toBe(false);
    expect(patchesEqual({ spending: { other: 100 } }, { spending: { eatingOut: 100 } })).toBe(false);
  });
});

describe('buildRequest', () => {
  it('keys on the facts, the scenarios and the rates, not on order, ZIP or the committed move', () => {
    const a = buildRequest(profile, candidates, undefined);
    const b = buildRequest({ ...profile, committedMoveId: candidates[0]!.id, doneMoveIds: ['x'] }, [...candidates].reverse(), undefined);
    expect(b.key).toBe(a.key);
    expect(a.scenarios).toEqual(scenarios);
    expect(buildRequest(profile, candidates.slice(1), undefined).key).not.toBe(a.key);
  });

  it('adds committed:<id> only for a stored patch that differs from its candidate’s, naming debts the profile has', () => {
    const same = candidates[0]!;
    expect(buildRequest(profile, candidates, { id: same.id, patch: structuredClone(same.patch) }).scenarios).toEqual(scenarios);
    const stale = { id: 'cutCategory:other', patch: { spending: { other: 1 } } };
    expect(buildRequest(profile, candidates, stale).scenarios.at(-1)).toEqual({ id: committedScenarioId(stale.id), patch: stale.patch });
    const gone = { id: 'payCardFirst:gone', patch: { debts: [{ id: 'gone', extraPayment: 50 }] } };
    expect(buildRequest(profile, candidates, gone).scenarios).toEqual(scenarios);
  });
});

describe('coversRequest', () => {
  const nominal = (f: Forecast): Forecast => ({ ...f, todaysDollars: false });
  it('needs nominal dollars and every requested scenario, as own properties', () => {
    expect(coversRequest(bundle, scenarios)).toBe(true);
    expect(coversRequest(bundle, [...scenarios, { id: 'nope', patch: {} }])).toBe(false);
    expect(coversRequest(bundle, [{ id: 'toString', patch: {} }])).toBe(false);
    expect(coversRequest({ ...bundle, base: { ...bundle.base, todaysDollars: true } }, scenarios)).toBe(false);
    const deflatedScenario: ForecastBundle = { ...bundle, scenarios: { ...bundle.scenarios, [scenarios[0]!.id]: { ...nominal(bundle.scenarios[scenarios[0]!.id]!), todaysDollars: true } } };
    expect(coversRequest(deflatedScenario, scenarios)).toBe(false);
  });
});

describe('answerDollars and committedScenario', () => {
  it('deflates by the inflation the answer was asked with, or leaves the bundle’s nominal dollars', () => {
    const deflated = answerDollars(answer, true)(bundle.base);
    expect(deflated).toEqual(forecast(profile, 10, { todaysDollars: true, rates: areaRates(profile) }));
    expect(answerDollars(answer, false)(bundle.base)).toBe(bundle.base);
  });

  it('reads the candidate’s scenario for an equal patch, the committed:<id> one for another, else nothing', () => {
    const c = candidates[0]!;
    expect(committedScenario(answer, { id: c.id, patch: c.patch })).toBe(bundle.scenarios[c.id]);
    const stale = { id: c.id, patch: { spending: { other: 1 } } };
    expect(committedScenario(answer, stale)).toBeUndefined();
    const withCommitted: ForecastAnswer = { ...answer, bundle: { ...bundle, scenarios: { ...bundle.scenarios, [committedScenarioId(c.id)]: bundle.base } } };
    expect(committedScenario(withCommitted, stale)).toBe(bundle.base);
  });
});

describe('the band', () => {
  const point = (low: number, high: number) => ({ month: 120, low, mid: (low + high) / 2, high });
  it('is made of inputs for the rules and of the model’s uncertainty for the AI', () => {
    expect(bandKindOf('rules')).toBe('inputs');
    expect(bandKindOf('ai')).toBe('model');
    expect(bandKindOf(null)).toBe('inputs');
  });

  it('is zero for the rules when no input is an estimate, whatever its width, and for the AI when it has no width', () => {
    expect(bandIsZero('rules', profile, point(1, 1))).toBe(false); // the demo profile has estimates
    const measured: Profile = {
      ...profile,
      age: { ...profile.age, isEstimate: false }, takeHomePay: { ...profile.takeHomePay, isEstimate: false },
      cash: { ...profile.cash, isEstimate: false }, retirement: { ...profile.retirement, isEstimate: false },
      retirementShare: { ...profile.retirementShare, isEstimate: false },
      spending: Object.fromEntries(Object.entries(profile.spending).map(([k, v]) => [k, { ...v, isEstimate: false }])) as Profile['spending'],
      debts: profile.debts.map((d) => ({ ...d, minPayment: { ...d.minPayment, isEstimate: false } })),
    };
    expect(bandIsZero('rules', measured, point(0, 500_000))).toBe(true);
    expect(bandIsZero('ai', profile, point(100, 100.5))).toBe(true);
    expect(bandIsZero('ai', measured, point(100, 5_000))).toBe(false);
  });
});

describe('shownForecast', () => {
  it('reads the answered base in today’s dollars or nominal, with the band of the answered profile', () => {
    const today = shownForecast(ready('rules'), true);
    expect(today).toMatchObject({ status: 'ready', error: null, source: 'rules', band: { kind: 'inputs', isZero: false } });
    expect(today.base).toEqual(forecast(profile, 10, { todaysDollars: true, rates: areaRates(profile) }));
    expect(today.in10y).toBe(today.base!.in10y);
    expect(shownForecast(ready('rules'), false).base).toBe(bundle.base);
  });

  it('has an AI band that follows the shown width', () => {
    const point = (f: Forecast, half: number): Forecast => {
      const points = f.points.map((p) => ({ ...p, low: p.mid - half, high: p.mid + half }));
      return { ...f, points, in10y: points[120]! };
    };
    const single: ForecastAnswer = { ...answer, bundle: { ...bundle, source: 'ai', base: point(bundle.base, 0) } };
    const wide: ForecastAnswer = { ...answer, bundle: { ...bundle, source: 'ai', base: point(bundle.base, 5_000) } };
    expect(shownForecast(ready('ai', false, single), true).band).toEqual({ kind: 'model', isZero: true });
    expect(shownForecast(ready('ai', false, wide), true).band).toEqual({ kind: 'model', isZero: false });
  });

  it('loading has nothing to show; an error carries the error; a bundle that cannot be deflated is an error', () => {
    expect(shownForecast({ status: 'loading' }, true)).toMatchObject({ status: 'loading', error: null, source: null, base: null });
    const error = { kind: 'unknown', message: 'x' } as const;
    expect(shownForecast({ status: 'error', error }, true)).toMatchObject({ status: 'error', error, source: null, base: null });
    const broken: ForecastAnswer = { ...answer, bundle: { ...bundle, base: { ...bundle.base, todaysDollars: true } } };
    const shown = shownForecast(ready('rules', false, broken), true);
    expect(shown).toMatchObject({ status: 'error', base: null, source: 'rules' });
    expect(shown.error).toMatchObject({ kind: 'unknown' });
    expect(shownForecast(ready('rules', false, broken), false).status).toBe('ready'); // nominal needs no deflation
  });
});

describe('forecastIsBusy', () => {
  it('is true while loading and while the answer shown is the previous profile’s, not while the current one is revalidated', () => {
    expect(forecastIsBusy({ status: 'loading' })).toBe(true);
    expect(forecastIsBusy(ready('rules', true, answer, true))).toBe(true);
    expect(forecastIsBusy(ready('rules', true, answer, false))).toBe(false); // same key, asked again in the background
    expect(forecastIsBusy(ready('rules', false))).toBe(false);
    expect(forecastIsBusy({ status: 'error', error: { kind: 'unknown', message: 'x' } })).toBe(false);
  });
});
