// Y15: the rules side of the forecast bundle, and the profile facts the AI forecaster is given.
// Spec: docs/ENGINEERING.md → AI forecast.
import type { ForecastBundle, Profile, ProfilePatch } from '@lifeguessr/types';
import { applyPatch, cloneProfile, forecast } from './forecast';
import type { ForecastRates } from './simulate';

/**
 * What the AI forecaster sees, and what its cache keys are built from: the profile's numbers and
 * estimate flags, and nothing that identifies a person or a place or only steers the UI (privacy,
 * CLAUDE.md rule 6): no `zip`, no `committedMoveId`, no `doneMoveIds`.
 */
export type ForecastFacts = Omit<Profile, 'zip' | 'committedMoveId' | 'doneMoveIds'>;

/** The profile without `zip`, `committedMoveId` and `doneMoveIds`; a deep copy, so editing it never reaches the profile. */
export function forecastFacts(p: Profile): ForecastFacts {
  const { zip: _zip, committedMoveId: _committedMoveId, doneMoveIds: _doneMoveIds, ...facts } = cloneProfile(p);
  return facts;
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
