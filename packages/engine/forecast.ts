// Y2 (Amir): net-worth forecast and profile patches. Spec: docs/ENGINEERING.md → Forecast.
/* eslint-disable @typescript-eslint/no-unused-vars -- signatures are fixed; Y2 replaces the bodies */
import type { Forecast, Profile, ProfilePatch, Purchase } from '@lifeguessr/types';
import { notImplemented } from './errors';

export type ForecastOptions = { todaysDollars?: boolean; extra?: Purchase[] };

/** Month-by-month net worth with a range band from estimated inputs; simulates ≥ 120 months. */
export function forecast(p: Profile, years = 10, opts?: ForecastOptions): Forecast {
  throw notImplemented('Y2');
}

/** A new Profile with the patch applied (the input is not mutated). */
export function applyPatch(p: Profile, patch: ProfilePatch): Profile {
  throw notImplemented('Y2');
}
