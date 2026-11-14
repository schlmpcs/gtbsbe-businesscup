// JF4 (#136): what screens show about the home a person owns. The math is the engine's (`ownerCosts`,
// `defaultHome`); this file only finds the area the profile's ZIP uses and pairs each number with its
// source or estimate flag. Renting = no `Profile.home` = null here.
import { inflationAnnualOf, ownerCosts } from '@lifeguessr/engine';
import type { AreaData, HomeTenure, Money, OwnerCostLine, Profile, Rate, Source } from '@lifeguessr/types';
import { ownArea } from '@/features/ladder/model/ownLife';

/** The area data the profile's ZIP uses: that ZIP's own, else a covered one with the same first three digits (S6 rule). */
export function homeArea(zip: string | undefined | null): AreaData | null {
  return zip ? (ownArea(zip)?.area ?? null) : null;
}

/** A value shown with its estimate flag and, when we have one, where it comes from. */
export type SourcedValue<T> = { value: T; isEstimate: boolean; source: Source | null };

export type OwnerCostLineVM = { key: OwnerCostLine['key']; monthly: Money; isEstimate: boolean; source: Source | null };

export type HomeSummary = {
  tenure: Exclude<HomeTenure, 'rent'>;
  /** BALANCE: what the home is worth today. */
  value: SourcedValue<Money>;
  /** Per year, nominal. */
  appreciation: SourcedValue<Rate>;
  /** Monthly HOA the user typed (0 = none). */
  hoaMonthly: Money;
  /** Monthly owner costs (engine ownerCosts); `total` is what the housing line holds. */
  costs: { lines: OwnerCostLineVM[]; total: Money; isEstimate: boolean };
};

/** The home's value, appreciation and owner costs with sources; null when the profile rents. */
export function homeSummary(p: Pick<Profile, 'home' | 'zip'>): HomeSummary | null {
  const home = p.home;
  if (!home) return null;
  const area = homeArea(p.zip);
  // A typed value is the person's own; an estimate is the area median (defaultHome), sourced as such.
  const valueSource = home.value.isEstimate ? (area?.homeValueMedian?.source ?? null) : null;
  // defaultHome falls back to the area's inflation when it has no appreciation figure.
  const appreciationSource = !home.appreciation.isEstimate
    ? null
    : area?.homeAppreciationAnnual
      ? area.homeAppreciationAnnual.source
      : home.appreciation.value === inflationAnnualOf(area) && area
        ? area.cpiYoY.source
        : null;
  const costs = ownerCosts(home, area ?? undefined);
  return {
    tenure: home.tenure,
    value: { value: home.value.value, isEstimate: home.value.isEstimate, source: valueSource },
    appreciation: { value: home.appreciation.value, isEstimate: home.appreciation.isEstimate, source: appreciationSource },
    hoaMonthly: home.hoaMonthly,
    costs: {
      lines: costs.lines.map((l) => ({ key: l.key, monthly: l.monthly, isEstimate: l.isEstimate, source: l.source ?? null })),
      total: costs.total,
      isEstimate: costs.lines.some((l) => l.isEstimate),
    },
  };
}

