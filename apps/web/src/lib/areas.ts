// AreaData lookup for the browser: the real T2 data (packages/data/out/areas.json, 60 ZIPs in
// 15 metros, every value sourced). An unknown ZIP returns null and callers fall back to national
// defaults. Area data is public; the life-card catalog (answers) is never imported here.
import { inflationAnnualOf } from '@lifeguessr/engine';
import { findArea } from '@lifeguessr/data/areas';
import type { AreaData, Rate } from '@lifeguessr/types';

/** AreaData for a ZIP, or null when we have no data for it. */
export function areaForZip(zip: string | undefined | null): AreaData | null {
  return findArea(zip);
}

/** Yearly inflation for a ZIP (BLS CPI-U from its AreaData, else the engine's fallback). */
export function inflationForZip(zip: string | undefined | null): Rate {
  return inflationAnnualOf(areaForZip(zip));
}
