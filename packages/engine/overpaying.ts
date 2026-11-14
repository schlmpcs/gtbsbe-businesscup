import type { AreaData, BenchmarkLine, CostCategory, KidAge, Money, OverpayingResult, Profile, Source } from '@lifeguessr/types';
import { CHILDCARE_TOLERANCE, GROCERY_TOLERANCE, INSURANCE_TOLERANCE, RENT_RANGE_FALLBACK, kidGroceryFactor } from './assumptions';
import { applyPatch, forecast } from './forecast';
import { inflationAnnualOf } from './simulate';

export type OverpayingInput = {bedrooms: 0|1|2|3|4; adults: 1|2|3|4; kids: KidAge[];
  rent?: Money; carInsurance?: Money; groceries?: Money; childcare?: Money};
const LINES = ['rent','carInsurance','groceries','childcare'] as const;
const CATEGORIES: Record<BenchmarkLine, CostCategory> = {rent:'rentUtilities',carInsurance:'car',groceries:'groceries',childcare:'childcare'};
type Typical = {low: Money; mid: Money; high: Money; source: Source; isEstimate: boolean};
function spread(mid: Money, tolerance: number, source: Source): Typical {
  return {low:mid*(1-tolerance),mid,high:mid*(1+tolerance),source,isEstimate:true};
}
function benchmark(line: BenchmarkLine, input: OverpayingInput, area: AreaData): Typical | null {
  if (line === 'rent') {
    const rent = area.rentByBedrooms[input.bedrooms];
    if (!rent) return null;
    const ratio = area.rentRangeRatio;
    return ratio ? {low:rent.value*ratio.low,mid:rent.value,high:rent.value*ratio.high,
      source: { ...rent.source, name: `${rent.source.name}; range: ${ratio.source.name}` }, isEstimate:rent.isEstimate ?? false}
      : spread(rent.value,RENT_RANGE_FALLBACK,rent.source);
  }
  if (line === 'carInsurance') return spread(area.carInsuranceMonthly.value,INSURANCE_TOLERANCE,area.carInsuranceMonthly.source);
  if (line === 'groceries') return spread(area.groceriesPerAdult.value*(input.adults+input.kids.length*kidGroceryFactor.value),GROCERY_TOLERANCE,area.groceriesPerAdult.source);
  const childcare = area.childcareMonthly;
  return input.kids.length && childcare ? spread(input.kids.reduce((sum,kid)=>sum+childcare[kid],0),CHILDCARE_TOLERANCE,childcare.source) : null;
}
/** Compare entered monthly costs with sourced area ranges; no coverage is substituted silently.
 * Assumed range spreads mark the entire benchmark estimated, even with a sourced midpoint. */
export function overpayingCheck(input: OverpayingInput, area: AreaData | null, profile?: Profile,
  opts: {coverage?: 'exact'|'metro'} = {}): OverpayingResult {
  if (!Number.isInteger(input.bedrooms) || input.bedrooms<0 || input.bedrooms>4 ||
      !Number.isInteger(input.adults) || input.adults<1 || input.adults>4 ||
      !Array.isArray(input.kids) || input.kids.some(k=>!['infant','toddler','preschool','schoolAge'].includes(k))) throw new RangeError('Invalid household inputs');
  for (const line of LINES) {
    const value = input[line];
    if (value !== undefined && (!Number.isFinite(value) || value<=0)) throw new RangeError(`Invalid ${line}`);
  }
  const result: OverpayingResult = {coverage:area ? (opts.coverage ?? 'exact') : 'none',
    ...(area && {metro:area.metro}),lines:[],skipped:[]};
  const forecastOpts = {todaysDollars:true,rates:{inflationAnnual:inflationAnnualOf(area)}};
  let base: Money | undefined;
  for (const line of LINES) {
    const yours = input[line];
    const typical = area ? benchmark(line,input,area) : null;
    if (yours === undefined || !typical) {
      result.skipped.push({line,reason:yours===undefined ? 'notEntered':'noData'});
      continue;
    }
    const position = yours<typical.low ? 'below' : yours>typical.high ? 'above' : 'inRange';
    const gapPerMonth = position==='above' ? yours-typical.high : 0;
    let effect10y = 0;
    const category = CATEGORIES[line], spending = profile?.spending[category];
    // Insurance is only one component of `car`. Preserve fuel and upkeep by subtracting the
    // insurance delta rather than replacing the whole car category with an insurance premium.
    if (profile && spending && position==='above' && spending.value >= yours-typical.mid) {
      base ??= forecast(profile,10,forecastOpts).in10y.mid;
      const patch = {spending:{[category]:spending.value-(yours-typical.mid)}};
      effect10y = forecast(applyPatch(profile,patch),10,forecastOpts).in10y.mid-base;
    }
    result.lines.push({line,yours,typical:{low:typical.low,mid:typical.mid,high:typical.high},
      source:typical.source,isEstimate:typical.isEstimate || opts.coverage==='metro',position,gapPerMonth,gapPerYear:gapPerMonth*12,effect10y});
  }
  return result;
}
