// JF4 (#136): homeowners. A person who owns today has `Profile.home`; their housing line
// (`spending.rentUtilities`) holds owner costs instead of rent, and the home's value is an asset.
// The mortgage is a `Debt` of kind 'mortgage' (its payment is principal + interest), so it is not here.
import type { AreaData, Home, HomeTenure, Money, OwnerCostLine, OwnerCosts, Rate } from '@lifeguessr/types';
import {
  homeInsuranceMonthlyFallback, inflationAnnualFallback, planEventDefaults, utilitiesMonthlyAverage,
} from './assumptions';

/**
 * Monthly owner costs of `home`: property tax (value × area rate, else the 1% rule of thumb),
 * insurance (area NAIC state average, else the countrywide one), upkeep (value × 1% a year), the
 * typed HOA, and utilities (BLS national average). The sum is what `spending.rentUtilities` holds for
 * an owner; mortgage P&I is extra and lives in `Profile.debts`.
 */
export function ownerCosts(home: Home, area?: AreaData): OwnerCosts {
  const value = home.value.value;
  const taxRate = area?.propertyTaxRate;
  const insurance = area?.homeInsuranceMonthly;
  const lines: OwnerCostLine[] = [
    taxRate
      ? { key: 'propertyTax', monthly: (value * taxRate.value) / 12, isEstimate: home.value.isEstimate || !!taxRate.isEstimate, source: taxRate.source }
      : { key: 'propertyTax', monthly: (value * planEventDefaults.value.propertyTaxRate) / 12, isEstimate: true },
    insurance
      ? { key: 'insurance', monthly: insurance.value, isEstimate: !!insurance.isEstimate, source: insurance.source }
      : { key: 'insurance', monthly: homeInsuranceMonthlyFallback.value, isEstimate: true, source: homeInsuranceMonthlyFallback.source },
    { key: 'upkeep', monthly: (value * planEventDefaults.value.upkeepRate) / 12, isEstimate: true },
    { key: 'hoa', monthly: home.hoaMonthly, isEstimate: false },
    { key: 'utilities', monthly: utilitiesMonthlyAverage.value, isEstimate: true, source: utilitiesMonthlyAverage.source },
  ];
  return { lines, total: lines.reduce((sum, l) => sum + l.monthly, 0) };
}

/**
 * The home a person who just picked "own" starts with: the area's median home value and
 * appreciation (else the planner defaults: $400,000 and inflation), no HOA. Both tagged as estimates.
 * `tenure: 'rent'` returns undefined (renting = no `Profile.home`).
 */
export function defaultHome(tenure: HomeTenure, area?: AreaData, inflation: Rate = inflationAnnualFallback.value): Home | undefined {
  if (tenure === 'rent') return undefined;
  const value: Money = area?.homeValueMedian?.value ?? planEventDefaults.value.homeValue;
  const appreciation: Rate = area?.homeAppreciationAnnual?.value ?? inflation;
  return { tenure, value: { value, isEstimate: true }, appreciation: { value: appreciation, isEstimate: true }, hoaMonthly: 0 };
}

/** 'rent' when the profile has no home. */
export function tenureOf(p: { home?: Home }): HomeTenure {
  return p.home?.tenure ?? 'rent';
}
