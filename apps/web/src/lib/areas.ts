// AreaData lookup for the browser: the real T2 data (packages/data/out/areas.json, 60 ZIPs in
// 15 metros, every value sourced). An unknown ZIP returns null and callers fall back to national
// defaults. Area data is public; the life-card catalog (answers) is never imported here.
import { inflationAnnualOf } from '@lifeguessr/engine';
import { areaData, findArea } from '@lifeguessr/data/areas';
import type { AreaData, Money, Rate, Source } from '@lifeguessr/types';

/** AreaData for a ZIP, or null when we have no data for it. */
export function areaForZip(zip: string | undefined | null): AreaData | null {
  return findArea(zip);
}

/** Yearly inflation for a ZIP (BLS CPI-U from its AreaData, else the engine's fallback). */
export function inflationForZip(zip: string | undefined | null): Rate {
  return inflationAnnualOf(areaForZip(zip));
}

/**
 * Monthly childcare for one infant, for the kid shortcut on S10: the area's center-based figure (DOL
 * National Database of Childcare Prices) for a ZIP we cover, else the median of our areas' infant
 * figures, sourced as such.
 */
export type InfantChildcare =
  | { basis: 'area'; monthly: Money; source: Source }
  | { basis: 'median'; monthly: Money; source: Source; areaCount: number };

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length / 2;
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[Math.floor(mid)]!;
}

let areasMedian: Extract<InfantChildcare, { basis: 'median' }> | undefined;

/** The median of every covered area's infant figure (computed once). */
function infantChildcareMedian(): Extract<InfantChildcare, { basis: 'median' }> {
  if (areasMedian) return areasMedian;
  const figures = areaData.flatMap((a) => (a.childcareMonthly ? [a.childcareMonthly] : []));
  const first = figures[0]!.source;
  areasMedian = {
    basis: 'median',
    monthly: median(figures.map((f) => f.infant)),
    areaCount: figures.length,
    source: {
      name: `U.S. DOL Women's Bureau, National Database of Childcare Prices: infant, center-based, median of our ${figures.length} areas`,
      year: Math.max(...figures.map((f) => f.source.year)),
      ...(first.url ? { url: first.url } : {}),
    },
  };
  return areasMedian;
}

/** Infant childcare per month for a ZIP: the area's figure, else the median of our areas (see InfantChildcare). */
export function infantChildcareFor(zip: string | undefined | null): InfantChildcare {
  const own = areaForZip(zip)?.childcareMonthly;
  return own ? { basis: 'area', monthly: own.infant, source: own.source } : infantChildcareMedian();
}
