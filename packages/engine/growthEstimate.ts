// The check an AI-proposed growth rate must pass before it may fill a field ("Estimate with AI", per
// account and on the plan's growth defaults). The model only proposes the rate, an input; plan() and
// monteCarlo() do every projection with it. A rate that fails here is dropped and the engine default stays.
// Spec: docs/ENGINEERING.md → AI growth estimate.
import type { AssetGroup } from '@lifeguessr/types';
import { aiGrowthEnvelope } from './assumptions';

const percent = (rate: number) => `${Math.round(rate * 1000) / 10}%`;

/** Problems with a proposed yearly growth rate for `group`; empty when it is a finite decimal inside the group's envelope. */
export function growthEstimateIssues(group: AssetGroup, rate: unknown): string[] {
  if (typeof rate !== 'number' || !Number.isFinite(rate)) return [`${group}: the rate must be a finite number`];
  const { min, max } = aiGrowthEnvelope.value[group];
  if (rate >= min && rate <= max) return [];
  // A whole percent (6 for 6%) would fit as a decimal: say so, so the retry fixes the unit.
  if (Math.abs(rate) > 1 && rate / 100 >= min && rate / 100 <= max) {
    return [`${group}: ${rate} looks like a percent; write the rate as a decimal (${rate}% → ${rate / 100})`];
  }
  return [`${group}: ${rate} is outside the plausible yearly range for this asset (${percent(min)} to ${percent(max)})`];
}
