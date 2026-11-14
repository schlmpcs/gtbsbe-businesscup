// Test helpers for the overpaying check: fake engine, areas and event sender, built on the canonical
// fixtures (areaData.sample.json). Used only by tests; the real ones are bound in ./deps.ts.
import type { AreaData, Benchmark, BenchmarkLine, OverpayingResult } from '@lifeguessr/types';
import { vi } from 'vitest';
import { areaDataSample } from '@/fixtures';
import type { AreaTier, CoveredMetro, OverpayingCheckFn, OverpayingDeps } from './types';

/** The four sample ZIPs of Dallas-Fort Worth: 75216 (cheap), 75206 (mid), 75205 (expensive), 75024 (suburb). */
export const SAMPLE_ZIPS = areaDataSample.map((a) => a.zip);
/** A valid 5-digit ZIP that is not in the sample data. */
export const UNCOVERED_ZIP = '99999';
export const SAMPLE_METRO = 'Dallas-Fort Worth, TX';

const mid = areaDataSample.find((a) => a.zip === '75206')!;

/**
 * A hand-built result for 75206 (mid tier, 2 bedrooms, 1 adult, 1 infant) with all four lines, one of
 * each position pair. Typical ranges are worked out from areaData.sample.json by hand:
 *   rent         2230 ±20% (no Census ratio for this ZIP)      → 1784 – 2676;  yours 3000 → above by 324 a month
 *   carInsurance  150 ±20%                                       → 120 – 180;    yours 100  → below
 *   groceries  367.95 × (1 adult + 0.7 for the infant) = 625.515 ±15% → 531.68775 – 719.34225;  yours 600 → in range
 *   childcare   840.67 (one infant) ±20%                          → 672.536 – 1008.804;  yours 1500 → above by 491.196 a month
 * The 10-year effects (40 000 and 9 000) are the fake engine's answers, chosen so the sums are easy to check.
 * It is checked against OverpayingResultSchema in the tests that use it.
 */
export function sampleOverpayingResult(overrides: { metro?: string; coverage?: 'exact' | 'metro'; isEstimate?: boolean } = {}): OverpayingResult {
  const estimate = overrides.isEstimate ?? true;
  const line = (b: Omit<Benchmark, 'isEstimate'>): Benchmark => ({ ...b, isEstimate: estimate });
  return {
    coverage: overrides.coverage ?? 'exact',
    metro: overrides.metro ?? SAMPLE_METRO,
    lines: [
      line({
        line: 'rent', yours: 3000, typical: { low: 1784, mid: 2230, high: 2676 }, source: mid.rentByBedrooms[2].source,
        position: 'above', gapPerMonth: 324, gapPerYear: 3888, effect10y: 40_000,
      }),
      line({
        line: 'carInsurance', yours: 100, typical: { low: 120, mid: 150, high: 180 }, source: mid.carInsuranceMonthly.source,
        position: 'below', gapPerMonth: 0, gapPerYear: 0, effect10y: 0,
      }),
      line({
        line: 'groceries', yours: 600, typical: { low: 531.68775, mid: 625.515, high: 719.34225 }, source: mid.groceriesPerAdult.source,
        position: 'inRange', gapPerMonth: 0, gapPerYear: 0, effect10y: 0,
      }),
      line({
        line: 'childcare', yours: 1500, typical: { low: 672.536, mid: 840.67, high: 1008.804 }, source: mid.childcareMonthly!.source,
        position: 'above', gapPerMonth: 491.196, gapPerYear: 5894.352, effect10y: 9000,
      }),
    ],
    skipped: [],
  };
}

/** The sample result keeping only some lines, the others skipped as `notEntered`. */
export function onlyLines(result: OverpayingResult, keep: BenchmarkLine[]): OverpayingResult {
  const lines = result.lines.filter((l) => keep.includes(l.line));
  const skipped = result.lines
    .filter((l) => !keep.includes(l.line))
    .map((l) => ({ line: l.line, reason: 'notEntered' as const }));
  return { ...result, lines, skipped };
}

export const SAMPLE_METROS: CoveredMetro[] = [
  { metro: SAMPLE_METRO, state: 'TX', tiers: ['cheap', 'mid', 'expensive', 'suburb'] },
  { metro: 'Boise, ID', state: 'ID', tiers: ['mid'] },
  { metro: 'Austin, TX', state: 'TX', tiers: ['cheap', 'mid', 'suburb'] },
];

export function sampleAreaForMetro(metro: string, tier: AreaTier): AreaData | null {
  return areaDataSample.find((a) => a.metro === metro && a.tier === tier) ?? null;
}

export type FakeDeps = OverpayingDeps & {
  check: ReturnType<typeof vi.fn<OverpayingCheckFn>>;
  track: ReturnType<typeof vi.fn<OverpayingDeps['track']>>;
  trackTool: ReturnType<typeof vi.fn<OverpayingDeps['trackTool']>>;
};

/** Deps over the sample data. `check` returns `result` (default: the hand-built sample) and records its calls. */
export function fakeDeps(opts: { result?: OverpayingResult } = {}): FakeDeps {
  const result = opts.result ?? sampleOverpayingResult();
  return {
    areas: { forZip: (zip) => areaDataSample.find((a) => a.zip === zip) ?? null, zipCount: areaDataSample.length },
    check: vi.fn<OverpayingCheckFn>(() => result),
    metros: { list: () => SAMPLE_METROS, forMetro: sampleAreaForMetro },
    track: vi.fn<OverpayingDeps['track']>(),
    trackTool: vi.fn<OverpayingDeps['trackTool']>(),
  };
}
