// monteCarlo(): seeded paths of plan(), p10/p50/p90 bands, success rate and histograms.
// Task MP5 (#165). Stub until then: the signature is final, the body throws.
import type { Account, AreaData, MonteCarloResult, MonteCarloSettings, Profile, Scenario } from '@lifeguessr/types';

/** `settings.seed` null = the caller picks a seed outside the pure core; the result returns the seed used. */
export function monteCarlo(
  _profile: Profile, _accounts: readonly Account[], _scenario: Scenario, _settings: MonteCarloSettings, _area?: AreaData,
): MonteCarloResult {
  throw new Error('not implemented: monteCarlo (MP5)');
}
