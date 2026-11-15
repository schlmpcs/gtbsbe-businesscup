// Y15: the rules side of the forecast bundle, and the profile facts the AI forecaster is given.
// Spec: docs/ENGINEERING.md → AI forecast.
import type { ForecastBundle, Home, LifeEvent, Profile, ProfilePatch } from '@lifeguessr/types';
import { eventStartMonth } from './events';
import { applyPatch, cloneProfile, forecast } from './forecast';
import type { ForecastRates } from './simulate';

/** A life event as the AI forecaster sees it: its kind and values, and how many months from now it starts. */
export type ForecastFactsEvent =
  | { kind: 'pay'; startsInMonths: number; takeHomePay: Extract<LifeEvent, { kind: 'pay' }>['takeHomePay'] }
  | { kind: 'spending'; startsInMonths: number; category: Extract<LifeEvent, { kind: 'spending' }>['category'];
      monthly: Extract<LifeEvent, { kind: 'spending' }>['monthly'] }
  | { kind: 'oneOff'; startsInMonths: number; amount: number; direction: 'cost' | 'income' };

/**
 * What the AI forecaster sees, and what its cache keys are built from: the profile's numbers and
 * estimate flags, and nothing that identifies a person or a place or only steers the UI (privacy,
 * CLAUDE.md rule 6): no `zip`, no `committedMoveId`, no `doneMoveIds`. Life events, when there are
 * any, keep their kind and values but trade the calendar `month` for `startsInMonths` from `asOf`
 * (so the same events give a new cache key each month, as they should: they are a month closer);
 * `asOf`, event ids and presets are dropped. An owner's `home` (JF4) keeps its tenure, value and
 * appreciation, the inputs of the home asset in the rules forecast (net worth includes the home at
 * `value`, growing at `appreciation`); `hoaMonthly` is dropped, it is already in
 * `spending.rentUtilities` (owner costs) and would only invite counting it twice.
 */
export type ForecastFacts = Omit<Profile, 'zip' | 'committedMoveId' | 'doneMoveIds' | 'events' | 'asOf' | 'home'> & {
  home?: ForecastFactsHome;
  events?: ForecastFactsEvent[];
};

/** The home as the AI forecaster sees it (see `ForecastFacts`). */
export type ForecastFactsHome = Pick<Home, 'tenure' | 'value' | 'appreciation'>;

/**
 * The profile as `ForecastFacts`; a deep copy, so editing it never reaches the profile. Each event is
 * rebuilt field by field, so nothing outside the contract reaches the model. RangeError when the
 * profile has events but no `asOf`.
 */
export function forecastFacts(p: Profile): ForecastFacts {
  const {
    zip: _zip, committedMoveId: _committedMoveId, doneMoveIds: _doneMoveIds, events, asOf, home, ...rest
  } = cloneProfile(p);
  const facts: ForecastFacts = home
    ? { ...rest, home: { tenure: home.tenure, value: home.value, appreciation: home.appreciation } }
    : rest;
  if (!events || events.length === 0) return facts;
  if (asOf === undefined) throw new RangeError('Profile.asOf is required when the profile has events');
  return { ...facts, events: events.map((e) => factsEvent(e, eventStartMonth(asOf, e.month))) };
}

function factsEvent(e: LifeEvent, startsInMonths: number): ForecastFactsEvent {
  switch (e.kind) {
    case 'pay':
      return { kind: 'pay', startsInMonths, takeHomePay: { value: e.takeHomePay.value, isEstimate: e.takeHomePay.isEstimate } };
    case 'spending':
      return {
        kind: 'spending', startsInMonths, category: e.category,
        monthly: { value: e.monthly.value, isEstimate: e.monthly.isEstimate },
      };
    case 'oneOff':
      return { kind: 'oneOff', startsInMonths, amount: e.amount, direction: e.direction };
  }
}

/**
 * The bundle the rules engine gives for the same request the AI answers: `forecast()` of the profile
 * and of the profile with each scenario's patch applied, 10 years, nominal dollars, keyed by scenario
 * id (a repeated id keeps the last patch). `source` is 'rules' and there is no `model`. This is both
 * the reference the AI answer is checked against and the fallback shown when it fails.
 */
export function rulesBundle(
  p: Profile,
  scenarios: readonly { id: string; patch: ProfilePatch }[],
  rates?: Partial<ForecastRates>,
): ForecastBundle {
  const opts = { rates };
  return {
    source: 'rules',
    base: forecast(p, 10, opts),
    scenarios: Object.fromEntries(scenarios.map((s) => [s.id, forecast(applyPatch(p, s.patch), 10, opts)])),
  };
}
