// T9: month-end projection and drift flags for S1. Spec: docs/ENGINEERING.md → Month-end.
//
//   usual (per category)     = mean of the last 3 full months before the current one, or the
//                              profile's monthly value when there are fewer than 3
//   projection (per category):
//     bill categories        = max(spent so far, usual)        (monthEndBillCategories: rent and
//                              utilities, childcare, subscriptions, car; paid in a lump, so the
//                              days elapsed say nothing about the rest of the month)
//     every other category   = spent so far / day × days in the month
//   projectedSpend           = Σ projections
//   average                  = mean of the last 3 full months per category
//   spread                   = max(sample std dev, 10% of average, monthEndDriftMinSpread)
//   drift                    = projection − average; flagged if |drift| > spread
//   vsAverage                = projectedSpend − Σ averages
//
// - With fewer than 3 full months of history: vsAverage = null and drifts = [].
// - Without the current month (no upload covers it): projectedSpend is the monthly spend implied by
//   the profile, vsAverage = null, drifts = [] (there is nothing of this month to compare).
// - `debtPayments` is informational (loan and card payments come from Profile.debts, and a card
//   payment repeats purchases already counted in other categories), so it is left out everywhere.
// - One-off charges are not in `totals`: the statement categorizer lists them in `oneOffs`
//   instead, so they never count toward a projection or an average.
// - Only months strictly before the current month count as history (later or equal months are
//   not full months yet). A negative category total (refunds above spending) counts as 0.
// - Invalid input (a malformed month, a day outside the month, a non-finite total, the same month
//   twice in the history) throws a RangeError.
import { COST_CATEGORIES, type CategoryTotals, type CostCategory, type MonthEnd, type Money, type Profile } from '@lifeguessr/types';
import {
  monthEndBillCategories,
  monthEndDriftMinSpread,
  monthEndDriftSpreadShare,
  monthEndHistoryMonths,
} from './assumptions';

export type CurrentMonth = { month: string; day: number; totals: Record<CostCategory, Money> };

/** The categories month-end projects and compares (all but the informational debtPayments). */
const SPEND_CATEGORIES: readonly CostCategory[] = COST_CATEGORIES.filter((c) => c !== 'debtPayments');

/** Days in a 'YYYY-MM' month; throws a RangeError for anything else. */
function daysInMonth(month: string): number {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!m) throw new RangeError(`Invalid month: ${month} (expected YYYY-MM)`);
  const year = Number(m[1]);
  const mon = Number(m[2]);
  if (mon !== 2) return [4, 6, 9, 11].includes(mon) ? 30 : 31;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return leap ? 29 : 28;
}

/** Per-category totals with missing categories as 0 and refunds floored at 0; throws on non-finite. */
function spendOf(totals: Partial<Record<CostCategory, Money>>, month: string): Record<CostCategory, Money> {
  const out = {} as Record<CostCategory, Money>;
  for (const c of COST_CATEGORIES) {
    const v = totals[c] ?? 0;
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new RangeError(`Invalid ${c} total for ${month}: ${v}`);
    out[c] = Math.max(0, v);
  }
  return out;
}

function profileSpend(p: Profile): Money {
  return SPEND_CATEGORIES.reduce((sum, c) => sum + p.spending[c].value, 0);
}

/** Sample standard deviation (n − 1): with 3 months it is the cautious choice, so fewer false flags. */
function sampleStdDev(values: readonly number[], mean: number): number {
  if (values.length < 2) return 0;
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1));
}

/** Month-end projection vs the 3-month average, with drift flags per category. */
export function monthEnd(p: Profile, history: CategoryTotals[], current?: CurrentMonth): MonthEnd {
  // Validate every history month up front, so bad data fails the same way with or without `current`.
  const seen = new Set<string>();
  const months = history.map((h) => {
    daysInMonth(h.month);
    if (seen.has(h.month)) throw new RangeError(`Duplicate history month: ${h.month}`);
    seen.add(h.month);
    return { month: h.month, spend: spendOf(h.totals, h.month) };
  });

  if (!current) return { projectedSpend: profileSpend(p), vsAverage: null, drifts: [] };

  const days = daysInMonth(current.month);
  if (!Number.isInteger(current.day) || current.day < 1 || current.day > days) {
    throw new RangeError(`Invalid day ${current.day} for ${current.month} (1..${days})`);
  }
  const soFar = spendOf(current.totals, current.month);

  const n = monthEndHistoryMonths.value;
  const recent = months
    .filter((h) => h.month < current.month) // 'YYYY-MM' sorts chronologically
    .sort((a, b) => (a.month < b.month ? 1 : -1))
    .slice(0, n);
  const hasAverage = recent.length >= n;
  const average = (c: CostCategory) => recent.reduce((s, h) => s + h.spend[c], 0) / recent.length;

  const bills = new Set<CostCategory>(monthEndBillCategories.value);
  const projection = {} as Record<CostCategory, Money>;
  for (const c of SPEND_CATEGORIES) {
    const usual = hasAverage ? average(c) : Math.max(0, p.spending[c].value);
    projection[c] = bills.has(c) ? Math.max(soFar[c], usual) : (soFar[c] / current.day) * days;
  }
  const projectedSpend = SPEND_CATEGORIES.reduce((s, c) => s + projection[c], 0);
  if (!hasAverage) return { projectedSpend, vsAverage: null, drifts: [] };

  let averageSpend = 0;
  const drifts: MonthEnd['drifts'] = [];
  for (const c of SPEND_CATEGORIES) {
    const avg = average(c);
    averageSpend += avg;
    const spread = Math.max(
      sampleStdDev(recent.map((h) => h.spend[c]), avg),
      monthEndDriftSpreadShare.value * avg,
      monthEndDriftMinSpread.value,
    );
    const delta = projection[c] - avg;
    if (Math.abs(delta) > spread * (1 + 1e-12)) drifts.push({ category: c, delta });
  }
  // Largest drift first; ties keep the category order.
  drifts.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return { projectedSpend, vsAverage: projectedSpend - averageSpend, drifts };
}
