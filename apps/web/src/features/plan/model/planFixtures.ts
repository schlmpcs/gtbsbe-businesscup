// The fixture inputs of /plan: the demo profile, its accounts and its ZIP's area data, the same inputs
// `pnpm fixtures:plan` generates plan.demo.json and monteCarlo.demo.json from. Tests pin the hooks to
// them (planStore.ts `initialPlanData`, `resetPlanStore`).
import type { Account, AreaData, Profile, YearMonth } from '@lifeguessr/types';
import { accountsDemo, areaByZip, cloneProfileDemo } from '@/fixtures';

export type PlanInputs = {
  /** Stamped with `asOf` (plan() needs it). */
  profile: Profile;
  accounts: readonly Account[];
  area?: AreaData;
};

/** The month the demo accounts were last edited: the `asOf` of plan.demo.json and monteCarlo.demo.json. */
export const FIXTURE_AS_OF: YearMonth = '2026-11';
/** The demo profile's ZIP (Dallas). */
export const FIXTURE_ZIP = '75206';

/** The inputs plan.demo.json and monteCarlo.demo.json were generated from. */
export function fixturePlanInputs(): PlanInputs {
  return { profile: { ...cloneProfileDemo(), asOf: FIXTURE_AS_OF }, accounts: accountsDemo, area: areaByZip(FIXTURE_ZIP) };
}
