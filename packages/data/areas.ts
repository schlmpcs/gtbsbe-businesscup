// Real area data: the T2 pipeline output (out/areas.json, built by scripts/refresh.py from HUD,
// Census ACS, DOL NDCP, USDA, EIA, BLS and NAIC; see README.md and out/incomplete-data-report.json).
//
// Browser-safe: public data only, no game answers. Validated with the contract's zod schema when
// this module loads, so a bad refresh fails loudly in tests and CI instead of skewing numbers.
import { AreaDataSchema, type AreaData } from '@lifeguessr/types';
import areasJson from './out/areas.json';

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object') {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
};

/** Validate raw area rows: the AreaData schema, at least one row, and unique ZIPs. */
export function parseAreas(raw: unknown): AreaData[] {
  const areas = AreaDataSchema.array().min(1).parse(raw);
  const seen = new Set<string>();
  for (const a of areas) {
    if (seen.has(a.zip)) throw new Error(`areas.json: ZIP ${a.zip} appears twice`);
    seen.add(a.zip);
  }
  return areas;
}

/** Every area we have data for: 60 ZIPs, 15 metros x 4 tiers (cheap, mid, expensive, suburb). */
export const areaData: readonly AreaData[] = deepFreeze(parseAreas(areasJson));

const byZip = new Map(areaData.map((a) => [a.zip, a]));

/** AreaData for a ZIP, or null when the pipeline has no data for it. */
export function findArea(zip: string | null | undefined): AreaData | null {
  return zip ? (byZip.get(zip) ?? null) : null;
}

/** AreaData for a ZIP; throws when the ZIP is not covered (use for data that must exist). */
export function getArea(zip: string): AreaData {
  const area = byZip.get(zip);
  if (!area) throw new Error(`No AreaData for ZIP ${zip} in packages/data/out/areas.json`);
  return area;
}
