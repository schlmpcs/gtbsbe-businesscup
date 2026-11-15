// What every /plan hook feeds the engine: the person's profile (stamped with this month, `asOf`), their
// accounts and their area. Live in the app (the app store's profile, the Accounts store, the ZIP's
// AreaData); pinned to the demo fixtures in tests (planStore.ts `pinnedInputs`).
// Also the plan's calendar (which year is which age) and a cache of plan() results, so the hooks that
// read the same scenario share one engine run.
import { accountsToProfile, plan } from '@lifeguessr/engine';
import type { PlanResult, Profile, Scenario } from '@lifeguessr/types';
import { useEffect, useMemo } from 'react';
import { areaForZip } from '@/lib/areas';
import { useAccountsReady, useAccountsStore } from '@/lib/model/accounts';
import { useProfile } from '@/state/profile';
import { FIXTURE_AS_OF, type PlanInputs } from './planFixtures';
import { initPlan, usePlanStore } from './planStore';

export { FIXTURE_AS_OF, FIXTURE_ZIP, fixturePlanInputs, type PlanInputs } from './planFixtures';

/**
 * The engine inputs for /plan. Pinned inputs win; otherwise the live profile and accounts, and once
 * both are loaded in this browser, the saved scenarios (or the Baseline for a new user) are loaded.
 */
export function usePlanInputs(): PlanInputs {
  const pinned = usePlanStore((s) => s.pinnedInputs);
  const profile = useProfile();
  const accountsReady = useAccountsReady();
  const accounts = useAccountsStore((s) => s.accounts);
  const live = useMemo((): PlanInputs => {
    const area = areaForZip(profile.zip);
    return { profile, accounts: accountsReady ? accounts : [], ...(area ? { area } : {}) };
  }, [profile, accounts, accountsReady]);
  useEffect(() => {
    if (!pinned && accountsReady) initPlan(live);
  }, [pinned, accountsReady, live]);
  return pinned ?? live;
}

// ----- Calendar ---------------------------------------------------------------------------------

/** plan()'s calendar: the person is `round(age)` in the asOf year, so age in year Y = Y − birthYear. */
export type PlanCalendar = { asOfYear: number; birthYear: number };

export function calendarOf(profile: Profile): PlanCalendar {
  const asOfYear = Number((profile.asOf ?? FIXTURE_AS_OF).slice(0, 4));
  return { asOfYear, birthYear: asOfYear - Math.round(profile.age.value) };
}

export const ageAtYear = (cal: PlanCalendar, year: number): number => year - cal.birthYear;
export const yearAtAge = (cal: PlanCalendar, age: number): number => cal.birthYear + age;
/** The years a plan to `endAge` covers (inclusive): this year to the year the person turns `endAge`. */
export const yearRangeOf = (cal: PlanCalendar, endAge: number): { min: number; max: number } =>
  ({ min: cal.asOfYear, max: Math.max(cal.asOfYear, cal.birthYear + endAge) });

// ----- Engine runs ------------------------------------------------------------------------------

const planCache = new WeakMap<PlanInputs, WeakMap<Scenario, PlanResult>>();

/** plan() of `scenario` on `inputs`, computed once per (inputs, scenario) pair: both are immutable. */
export function planFor(inputs: PlanInputs, scenario: Scenario): PlanResult {
  let byScenario = planCache.get(inputs);
  if (!byScenario) planCache.set(inputs, (byScenario = new WeakMap()));
  let result = byScenario.get(scenario);
  if (!result) byScenario.set(scenario, (result = plan(inputs.profile, inputs.accounts, scenario, inputs.area)));
  return result;
}

/** The profile plan() builds on: cash, retirement and debts from the accounts (none: the profile's own). */
export function planProfileOf(inputs: PlanInputs): Profile {
  return inputs.accounts.length > 0 ? accountsToProfile(inputs.accounts, inputs.profile) : inputs.profile;
}
