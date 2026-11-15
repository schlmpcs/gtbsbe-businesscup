// The sanity envelope for AI-proposed growth rates (docs/ENGINEERING.md → AI growth estimate). The model
// only proposes a yearly rate; these checks decide whether it may fill a field at all.
import { ASSET_GROUPS } from '@lifeguessr/types';
import { describe, expect, it } from 'vitest';
import { aiGrowthEnvelope, assumptions } from './assumptions';
import { growthEstimateIssues } from './growthEstimate';

describe('aiGrowthEnvelope', () => {
  it('has a range for every asset group, min below max, as decimals per year', () => {
    for (const group of ASSET_GROUPS) {
      const range = aiGrowthEnvelope.value[group];
      expect(range.min).toBeLessThan(range.max);
      expect(Math.abs(range.min)).toBeLessThanOrEqual(1);
      expect(Math.abs(range.max)).toBeLessThanOrEqual(1);
    }
  });

  it('holds the documented guard values and stays out of the user-facing list', () => {
    expect(aiGrowthEnvelope.value).toEqual({
      cash: { min: 0, max: 0.06 },
      investments: { min: -0.05, max: 0.15 },
      retirement: { min: -0.05, max: 0.15 },
      realEstate: { min: -0.05, max: 0.12 },
      vehicle: { min: -0.35, max: 0.05 },
      otherAsset: { min: -0.5, max: 0.5 },
    });
    expect(aiGrowthEnvelope.assumption).toBe(true);
    expect(Object.keys(assumptions)).not.toContain('aiGrowthEnvelope');
  });
});

describe('growthEstimateIssues', () => {
  it('accepts a rate inside the group range, ends included', () => {
    expect(growthEstimateIssues('vehicle', -0.12)).toEqual([]);
    expect(growthEstimateIssues('vehicle', -0.35)).toEqual([]);
    expect(growthEstimateIssues('vehicle', 0.05)).toEqual([]);
    expect(growthEstimateIssues('realEstate', 0.0487)).toEqual([]);
    expect(growthEstimateIssues('cash', 0)).toEqual([]);
    expect(growthEstimateIssues('investments', 0.07)).toEqual([]);
  });

  it('rejects a rate outside the group range and names the range in percent', () => {
    const [issue] = growthEstimateIssues('vehicle', 0.08);
    expect(issue).toMatch(/vehicle/);
    expect(issue).toMatch(/-35%.*5%/);
    expect(growthEstimateIssues('cash', -0.01)).toHaveLength(1);
    expect(growthEstimateIssues('realEstate', 0.2)).toHaveLength(1);
    expect(growthEstimateIssues('retirement', -0.06)).toHaveLength(1);
  });

  it('rejects a percent written as a number (6 for 6%) with a hint to use a decimal', () => {
    const [issue] = growthEstimateIssues('investments', 6);
    expect(issue).toMatch(/decimal/);
  });

  it('rejects non-finite and non-number values', () => {
    expect(growthEstimateIssues('investments', Number.NaN)).toHaveLength(1);
    expect(growthEstimateIssues('investments', Number.POSITIVE_INFINITY)).toHaveLength(1);
    expect(growthEstimateIssues('investments', '0.06')).toHaveLength(1);
    expect(growthEstimateIssues('investments', null)).toHaveLength(1);
  });
});
