// AreaData lookup for the browser. Until the data pipeline (T2) ships areas.json, the only areas
// are the fixture ZIPs; an unknown ZIP returns null and callers fall back to national defaults.
import { inflationAnnualOf } from '@lifeguessr/engine';
import type { AreaData, Rate } from '@lifeguessr/types';
import { areaDataSample } from '@/fixtures';

/** AreaData for a ZIP, or null when we have no data for it. */
export function areaForZip(zip: string | undefined | null): AreaData | null {
  if (!zip) return null;
  return areaDataSample.find((a) => a.zip === zip) ?? null;
}

/** Yearly inflation for a ZIP (BLS CPI-U from its AreaData, else the engine's fallback). */
export function inflationForZip(zip: string | undefined | null): Rate {
  return inflationAnnualOf(areaForZip(zip));
}
