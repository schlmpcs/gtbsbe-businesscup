// plan(): the yearly plan to the end age, with shortfall, withdrawal order and savings split.
// Task MP3 (#163). Stub until then: the signature is final, the body throws.
import type { Account, AreaData, PlanResult, Profile, Scenario } from '@lifeguessr/types';

/** One PlanYear per calendar year from `profile.asOf` to `scenario.assumptions.endAge`, plus the four KPIs. */
export function plan(_profile: Profile, _accounts: readonly Account[], _scenario: Scenario, _area?: AreaData): PlanResult {
  throw new Error('not implemented: plan (MP3)');
}
