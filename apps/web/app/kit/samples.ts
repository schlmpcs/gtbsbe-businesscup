// Sample props for the /kit showcase, all from the canonical fixtures and the engine (no hand-typed numbers).
import { applyPatch, forecast, rankMoves, sceneOf } from '@lifeguessr/engine';
import type { CostCategory } from '@lifeguessr/types';
import { areaByZip, cardsSample, loanOffersSample, profileDemo } from '@/fixtures';
import { common, kitShowcase } from '@/copy';
import type { BarBreakdownItem } from '@/ui-kit';

export const demoProfile = profileDemo;
export const demoArea = areaByZip(profileDemo.zip ?? '75206');
export const demoLoanOffers = loanOffersSample;

/** The house scene of the richest fixture card (car loan, kids), straight from the engine. */
const sceneCard = cardsSample.find((c) => c.car && c.kids.length > 0) ?? cardsSample[0]!;
export const demoScene = sceneOf(sceneCard, areaByZip(sceneCard.zip));

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

/** The demo profile's 10-year forecast, and the same profile after its top-ranked move (if any). */
export const sampleForecast = forecast(profileDemo, 10, { todaysDollars: true }).points;
const topMove = rankMoves(profileDemo)[0];
export const sampleForecastCompare = topMove
  ? forecast(applyPatch(profileDemo, topMove.patch), 10, { todaysDollars: true }).points
  : undefined;
