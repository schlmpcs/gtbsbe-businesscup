// "Write your what-if" (/plan): the AI parses a sentence into WhatIfItems (types, years, labels, a metro,
// amounts only when written); this module turns them into PlanEvents. Every number is code's: the
// one-tap defaults of `defaultEvent`, the amount the person typed, or, for a move, the change in the
// household's monthly cost of living computed from area data.
//
// Move: delta = costOfLife(household in the new area).mid − costOfLife(household in the current area).mid,
// the same cost-of-a-life-card math the game and "About you" use (gross rent for the household's
// bedrooms, groceries, car insurance + fuel, childcare for the kids). The household is
// `profile.householdFacts`, else the S6 default (1 adult, no kids, 1 bedroom, a car). The new area is
// the metro's area of the same tier as the current one (else its 'mid' tier). Without a current area
// (no ZIP, or one we don't cover), the baseline is the 'mid'-tier area of the median metro, ranked by
// that household's cost: a national middle, from data rather than a guess. A costlier city becomes a
// monthly Expense of the delta; a cheaper one a monthly Income of −delta (cash it frees). Owners are
// treated like renters here (rent for the same bedrooms): a simulation, not a relocation quote.
//
// The engine does not import @lifeguessr/data: the caller passes the areas (`areaData`).
import type { AreaData, HouseholdFacts, Money, PlanEvent, PlanEventContext, WhatIfItem } from '@lifeguessr/types';
import { costOfLife, lifeCardFromFacts } from './cost';
import { defaultEvent } from './planEvents';

/** The household a move is costed for when "About you" (S6) has not been answered: its defaults. */
export const WHAT_IF_DEFAULT_HOUSEHOLD: HouseholdFacts = { adults: 1, kids: [], bedrooms: 1, hasCar: true };

const norm = (s: string) => s.trim().toLowerCase();
const cityOf = (metro: string) => norm(metro.split(',')[0] ?? metro);

/** The covered areas of a metro: exact name ("Denver, CO") first, else the city part ("Denver"). */
function areasOfMetro(metro: string, areas: readonly AreaData[]): AreaData[] {
  const exact = areas.filter((a) => norm(a.metro) === norm(metro));
  return exact.length > 0 ? exact : areas.filter((a) => cityOf(a.metro) === cityOf(metro));
}

/** Monthly cost of the household in an area (mid), or null when the area lacks data it needs. */
function householdCost(facts: HouseholdFacts, area: AreaData): Money | null {
  try {
    return costOfLife(lifeCardFromFacts(facts, area), area).total.mid;
  } catch {
    return null; // e.g. kids in an area with no childcare data
  }
}

/** The 'mid'-tier area of the median metro by this household's cost (lower median for an even count). */
function baselineArea(facts: HouseholdFacts, areas: readonly AreaData[]): AreaData | null {
  const ranked = areas
    .filter((a) => a.tier === 'mid')
    .map((area) => ({ area, cost: householdCost(facts, area) }))
    .filter((x): x is { area: AreaData; cost: Money } => x.cost !== null)
    .sort((a, b) => a.cost - b.cost || a.area.zip.localeCompare(b.area.zip));
  return ranked.length > 0 ? ranked[Math.floor((ranked.length - 1) / 2)]!.area : null;
}

/**
 * Monthly change in the household's cost of living from moving to `metro` (> 0: costlier), with the two
 * areas compared; null when the metro is not covered or a cost can't be computed.
 */
export function moveCostDelta(
  metro: string,
  ctx: Pick<PlanEventContext, 'profile' | 'area'>,
  areas: readonly AreaData[],
): { delta: Money; from: AreaData; to: AreaData } | null {
  const facts = ctx.profile.householdFacts ?? WHAT_IF_DEFAULT_HOUSEHOLD;
  const candidates = areasOfMetro(metro, areas);
  if (candidates.length === 0) return null;
  const from = ctx.area ?? baselineArea(facts, areas);
  if (!from) return null;
  const tier = ctx.area?.tier ?? 'mid';
  const to = candidates.find((a) => a.tier === tier) ?? candidates.find((a) => a.tier === 'mid') ?? candidates[0]!;
  const fromCost = householdCost(facts, from);
  const toCost = householdCost(facts, to);
  if (fromCost === null || toCost === null) return null;
  return { delta: toCost - fromCost, from, to };
}

/**
 * One parsed item as a PlanEvent, or null when it can't be one (a move to a metro we don't cover, or to
 * a place that costs the same). Id: `whatif-${type}-${year}-${index}` (the caller may re-id it).
 */
export function whatIfEvent(
  item: WhatIfItem,
  index: number,
  ctx: PlanEventContext,
  areas: readonly AreaData[],
): PlanEvent | null {
  const asOfYear = Number(ctx.asOf.slice(0, 4));
  const ids = (year: number) => ({ id: `whatif-${item.type}-${year}-${index}`, year, enabled: true, name: item.label });

  if (item.type === 'move') {
    if (!item.metro) return null;
    const move = moveCostDelta(item.metro, ctx, areas);
    if (!move || move.delta === 0) return null;
    const common = ids(item.year ?? asOfYear + 1);
    return move.delta > 0
      ? { ...common, type: 'expense', amount: move.delta, cadence: 'monthly' }
      : { ...common, type: 'income', monthly: -move.delta };
  }

  // The one-tap default (next year; Retire at the retirement age), then what the sentence states.
  const d = defaultEvent(item.type, ctx);
  const year = item.year ?? d.year;
  const common = ids(year);
  const amount = item.amount;
  /** An end year only when it is after the start (an end at or before the start would void the event). */
  const endAfter = item.endYear !== null && item.endYear > year ? item.endYear : undefined;

  switch (d.type) {
    case 'income':
      return { ...d, ...common, monthly: amount ?? d.monthly, ...(endAfter !== undefined && { endYear: endAfter }) };
    case 'expense': {
      // The default amount is a one-time one: a cadence without an amount keeps the default's 'once'.
      const cadence = amount !== null ? (item.cadence ?? 'once') : d.cadence;
      return {
        ...d, ...common, amount: amount ?? d.amount, cadence,
        ...(cadence === 'monthly' && endAfter !== undefined && { endYear: endAfter }),
      };
    }
    case 'buyHome': {
      if (amount === null || amount <= 0) return { ...d, ...common };
      const share = d.homeValue > 0 ? d.downPayment / d.homeValue : 0; // keep the default down-payment share
      return { ...d, ...common, homeValue: amount, downPayment: amount * share };
    }
    case 'newJob':
      return { ...d, ...common, takeHomePay: amount ?? d.takeHomePay };
    case 'windfall':
      return { ...d, ...common, amount: amount ?? d.amount };
    case 'careerBreak':
      return { ...d, ...common, endYear: endAfter ?? year + (d.endYear - d.year) };
    default:
      return { ...d, ...common }; // haveKid, retire: no amounts in the contract
  }
}

/** Every parsed item as a PlanEvent, in order, skipping those that can't be one (see `whatIfEvent`). */
export function whatIfEvents(items: readonly WhatIfItem[], ctx: PlanEventContext, areas: readonly AreaData[]): PlanEvent[] {
  return items.flatMap((item, i) => {
    const e = whatIfEvent(item, i, ctx, areas);
    return e ? [e] : [];
  });
}
