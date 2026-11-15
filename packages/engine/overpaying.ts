import type {
  AreaData,
  BenchmarkLine,
  CostCategory,
  KidAge,
  Money,
  OverpayingResult,
  Profile,
  Source,
} from '@lifeguessr/types';
import {
  CHILDCARE_TOLERANCE,
  GROCERY_TOLERANCE,
  INSURANCE_TOLERANCE,
  RENT_RANGE_FALLBACK,
  kidGroceryFactor,
} from './assumptions';
import { applyPatch, forecast } from './forecast';
import { inflationAnnualOf } from './simulate';

export type OverpayingInput = {
  bedrooms: 0 | 1 | 2 | 3 | 4;
  adults: 1 | 2 | 3 | 4;
  kids: KidAge[];
  rent?: Money;
  carInsurance?: Money;
  groceries?: Money;
  childcare?: Money;
};
const LINES = ['rent', 'carInsurance', 'groceries', 'childcare'] as const;
const CATEGORIES: Record<BenchmarkLine, CostCategory> = {
  rent: 'rentUtilities',
  carInsurance: 'car',
  groceries: 'groceries',
  childcare: 'childcare',
};
type Typical = {
  low: Money;
  mid: Money;
  high: Money;
  source: Source;
  isEstimate: boolean;
};
function spread(mid: Money, tolerance: number, source: Source): Typical {
  return {
    low: mid * (1 - tolerance),
    mid,
    high: mid * (1 + tolerance),
    source,
    isEstimate: true,
  };
}
function benchmark(
  line: BenchmarkLine,
  input: OverpayingInput,
  area: AreaData,
): Typical | null {
  if (line === 'rent') {
    const rent = area.rentByBedrooms[input.bedrooms];
    if (!rent) return null;
    const ratio = area.rentRangeRatio;
    return ratio
      ? {
          low: rent.value * ratio.low,
          mid: rent.value,
          high: rent.value * ratio.high,
          source: {
            ...rent.source,
            name: `${rent.source.name}; range: ${ratio.source.name}`,
          },
          isEstimate: rent.isEstimate ?? false,
        }
      : spread(rent.value, RENT_RANGE_FALLBACK, rent.source);
  }
  if (line === 'carInsurance')
    return spread(
      area.carInsuranceMonthly.value,
      INSURANCE_TOLERANCE,
      area.carInsuranceMonthly.source,
    );
  if (line === 'groceries')
    return spread(
      area.groceriesPerAdult.value *
        (input.adults + input.kids.length * kidGroceryFactor.value),
      GROCERY_TOLERANCE,
      area.groceriesPerAdult.source,
    );
  const childcare = area.childcareMonthly;
  return input.kids.length && childcare
    ? spread(
        input.kids.reduce((sum, kid) => sum + childcare[kid], 0),
        CHILDCARE_TOLERANCE,
        childcare.source,
      )
    : null;
}
/** The profile spending line each benchmark line belongs to (car insurance is part of `car`). */
export const OVERPAYING_CATEGORIES: Readonly<Record<BenchmarkLine, CostCategory>> = CATEGORIES;

/**
 * "Pay the typical middle" on one line as a profile patch: the line's category lowered by what you pay
 * above the middle of the range (yours − mid). Only for a line above the range, and only when the
 * profile's category holds at least that much (car insurance is one part of `car`, so the category
 * keeps fuel and upkeep); null otherwise. The same patch the 10-year effect of overpayingCheck measures.
 */
export function overpayingPatch(
  b: { line: BenchmarkLine; yours: Money; typical: { mid: Money }; position: 'below' | 'inRange' | 'above' },
  profile: Pick<Profile, 'spending'>,
): { spending: Partial<Record<CostCategory, Money>> } | null {
  if (b.position !== 'above') return null;
  const category = CATEGORIES[b.line];
  const spending = profile.spending[category];
  const delta = b.yours - b.typical.mid;
  if (!spending || !(delta > 0) || spending.value < delta) return null;
  return { spending: { [category]: spending.value - delta } };
}

/** Compare entered monthly costs with sourced area ranges; no coverage is substituted silently.
 * Assumed range spreads mark the entire benchmark estimated, even with a sourced midpoint. */
export function overpayingCheck(
  input: OverpayingInput,
  area: AreaData | null,
  profile?: Profile,
  opts: { coverage?: 'exact' | 'metro' } = {},
): OverpayingResult {
  if (
    !Number.isInteger(input.bedrooms) ||
    input.bedrooms < 0 ||
    input.bedrooms > 4 ||
    !Number.isInteger(input.adults) ||
    input.adults < 1 ||
    input.adults > 4 ||
    !Array.isArray(input.kids) ||
    input.kids.some(
      (k) => !['infant', 'toddler', 'preschool', 'schoolAge'].includes(k),
    )
  )
    throw new RangeError('Invalid household inputs');
  for (const line of LINES) {
    const value = input[line];
    if (value !== undefined && (!Number.isFinite(value) || value <= 0))
      throw new RangeError(`Invalid ${line}`);
  }
  const result: OverpayingResult = {
    coverage: area ? (opts.coverage ?? 'exact') : 'none',
    ...(area && { metro: area.metro }),
    lines: [],
    skipped: [],
  };
  const forecastOpts = {
    todaysDollars: true,
    rates: { inflationAnnual: inflationAnnualOf(area) },
  };
  let base: Money | undefined;
  for (const line of LINES) {
    const yours = input[line];
    const typical = area ? benchmark(line, input, area) : null;
    if (yours === undefined || !typical) {
      result.skipped.push({
        line,
        reason: yours === undefined ? 'notEntered' : 'noData',
      });
      continue;
    }
    const position =
      yours < typical.low
        ? 'below'
        : yours > typical.high
          ? 'above'
          : 'inRange';
    const gapPerMonth = position === 'above' ? yours - typical.high : 0;
    let effect10y = 0;
    const category = CATEGORIES[line],
      spending = profile?.spending[category];
    // Insurance is only one component of `car`. Preserve fuel and upkeep by subtracting the
    // insurance delta rather than replacing the whole car category with an insurance premium.
    const patch = profile
      ? overpayingPatch({ line, yours, typical, position }, profile)
      : null;
    if (profile && spending && patch) {
      base ??= forecast(profile, 10, forecastOpts).in10y.mid;
      effect10y =
        forecast(applyPatch(profile, patch), 10, forecastOpts).in10y.mid - base;
    }
    result.lines.push({
      line,
      yours,
      typical: { low: typical.low, mid: typical.mid, high: typical.high },
      source: typical.source,
      isEstimate: typical.isEstimate || opts.coverage === 'metro',
      position,
      gapPerMonth,
      gapPerYear: gapPerMonth * 12,
      effect10y,
    });
  }
  return result;
}
