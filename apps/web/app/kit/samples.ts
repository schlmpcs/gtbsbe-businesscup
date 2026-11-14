// Sample props for the /kit showcase. Real numbers come from the canonical fixtures; the forecast curves
// are illustrative shapes (the engine's forecast() is not wired here) and the page labels them so.
import type { CostCategory } from '@lifeguessr/types';
import { areaByZip, loanOffersSample, profileDemo } from '@/fixtures';
import { common, kitShowcase } from '@/copy';
import type { BarBreakdownItem, ForecastChartPoint } from '@/ui-kit';

export const demoProfile = profileDemo;
export const demoArea = areaByZip(profileDemo.zip ?? '75206');
export const demoLoanOffers = loanOffersSample;

/** The demo profile's monthly spending as breakdown rows; defaulted fields keep their estimate flag. */
export const profileSpendingItems: BarBreakdownItem[] = (
  Object.entries(profileDemo.spending) as [CostCategory, { value: number; isEstimate: boolean }][]
)
  .filter(([, v]) => v.value > 0)
  .map(([category, v]) => ({
    id: category,
    label: common.categories[category],
    amount: v.value,
    isEstimate: v.isEstimate,
  }));

/** Sourced area costs for the demo ZIP (HUD rent, USDA groceries, state car insurance). */
export const areaItems: BarBreakdownItem[] = [
  {
    id: 'rent',
    label: kitShowcase.breakdown.rent,
    amount: demoArea.rentByBedrooms[2].value,
    source: demoArea.rentByBedrooms[2].source,
    isEstimate: demoArea.rentByBedrooms[2].isEstimate,
  },
  {
    id: 'groceries',
    label: kitShowcase.breakdown.groceries,
    amount: demoArea.groceriesPerAdult.value,
    source: demoArea.groceriesPerAdult.source,
    isEstimate: demoArea.groceriesPerAdult.isEstimate,
  },
  {
    id: 'insurance',
    label: kitShowcase.breakdown.insurance,
    amount: demoArea.carInsuranceMonthly.value,
    source: demoArea.carInsuranceMonthly.source,
    isEstimate: demoArea.carInsuranceMonthly.isEstimate,
  },
];

/** An illustrative 10-year curve: a straight mid line with a band that widens with time. */
function illustrativeCurve(start: number, perMonth: number, spreadPerMonth: number): ForecastChartPoint[] {
  return Array.from({ length: 121 }, (_, month) => {
    const mid = start + perMonth * month;
    const spread = spreadPerMonth * month;
    return { month, mid, low: mid - spread, high: mid + spread };
  });
}

export const sampleForecast = illustrativeCurve(-6000, 520, 160);
export const sampleForecastCompare = illustrativeCurve(-6000, 330, 140);
