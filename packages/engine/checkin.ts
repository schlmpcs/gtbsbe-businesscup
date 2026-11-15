// S14 Monthly check-in: monthEnd() with its per-category rows, so the screen can draw "usual vs this
// month" bars for every category. Same rules and validation as ./month.ts (it calls monthEnd and
// usualMonthSpend and only adds the rows): Σ rows.projected = projectedSpend, the flagged rows are
// exactly monthEnd's drifts.
//
//   usual      = usualMonthSpend (3-month mean, or the profile's monthly value with less history)
//   soFar      = what the month under review holds so far (0 without a month)
//   projected  = month-end projection (bills: max(soFar, usual); others: soFar / day × days)
//   delta      = projected − usual when the usual month comes from history, else null
//   drift      = the category is one of monthEnd's drifts
import { COST_CATEGORIES, type CategoryTotals, type CostCategory, type MonthEnd, type Money, type Profile } from '@lifeguessr/types';
import { monthEndBillCategories } from './assumptions';
import { daysInMonth, monthEnd, usualMonthSpend, type CurrentMonth } from './month';

export type MonthEndRow = {
  category: CostCategory;
  usual: Money;
  soFar: Money;
  projected: Money;
  /** projected − usual; null until there are 3 full months of history. */
  delta: Money | null;
  drift: boolean;
};

export type MonthEndDetail = MonthEnd & {
  /** Every spend category (debtPayments left out, as in monthEnd), largest drift first, then largest projection. */
  rows: MonthEndRow[];
  /** Σ usual. */
  usualSpend: Money;
  /** The usual month is the 3-month average (true) or the profile's values (false). */
  usualFromHistory: boolean;
  /** Σ soFar (0 without a month). */
  spentSoFar: Money;
  /** Day of the month reviewed and its length; null without a month. */
  day: number | null;
  daysInMonth: number | null;
};

const SPEND: readonly CostCategory[] = COST_CATEGORIES.filter((c) => c !== 'debtPayments');

export function monthEndDetail(p: Profile, history: CategoryTotals[], current?: CurrentMonth): MonthEndDetail {
  const base = monthEnd(p, history, current); // validates everything
  const drifted = new Set(base.drifts.map((d) => d.category));
  const bills = new Set<CostCategory>(monthEndBillCategories.value);

  if (!current) {
    const rows = SPEND.map((c) => {
      const v = Math.max(0, p.spending[c].value);
      return { category: c, usual: v, soFar: 0, projected: v, delta: null, drift: false };
    });
    return {
      ...base,
      rows: sortRows(rows),
      usualSpend: rows.reduce((s, r) => s + r.usual, 0),
      usualFromHistory: false,
      spentSoFar: 0,
      day: null,
      daysInMonth: null,
    };
  }

  const days = daysInMonth(current.month);
  const usual = usualMonthSpend(p, history, current.month);
  const rows: MonthEndRow[] = SPEND.map((c) => {
    const raw = current.totals[c] ?? 0;
    const soFar = Math.max(0, raw);
    const u = usual.byCategory[c];
    const projected = bills.has(c) ? Math.max(soFar, u) : (soFar / current.day) * days;
    return { category: c, usual: u, soFar, projected, delta: usual.fromHistory ? projected - u : null, drift: drifted.has(c) };
  });
  return {
    ...base,
    rows: sortRows(rows),
    usualSpend: usual.total,
    usualFromHistory: usual.fromHistory,
    spentSoFar: rows.reduce((s, r) => s + r.soFar, 0),
    day: current.day,
    daysInMonth: days,
  };
}

function sortRows(rows: MonthEndRow[]): MonthEndRow[] {
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) =>
      Number(b.r.drift) - Number(a.r.drift)
      || (b.r.drift ? Math.abs(b.r.delta ?? 0) - Math.abs(a.r.delta ?? 0) : 0)
      || Math.max(b.r.projected, b.r.usual) - Math.max(a.r.projected, a.r.usual)
      || a.i - b.i)
    .map((x) => x.r);
}
