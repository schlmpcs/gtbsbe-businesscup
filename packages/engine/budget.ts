// Budget table: planned vs actual per category (MP9, #169).
//
// `planned` is monthly per category: profile.spending by default ("Create my budget": our sliders and
// area data), each cell editable by the user. `actual` is the month's CategoryTotals: the statement
// month, or the daily log (dailyMonthToDate wrapped as a CategoryTotals); the caller picks, the
// statement first. Without either, actual is 0 everywhere. One-offs have no category and stay out
// of the rows, as they stay out of `totals`.
//
// Per category:
//   remaining       = planned − actual
//   expectedByToday = flexible: planned × day / daysInMonth (spending accrues evenly)
//                     fixed (budgetFixedCategories: rent, childcare, debt payments, subscriptions):
//                     the full planned amount once anything was paid this month, else 0 (paid in one
//                     lump, so neither pro rata nor "behind" before the bill goes out)
//   status          = 'over'   when actual > planned (in cents)
//                     'onPace' when |actual − expectedByToday| ≤ budgetOnPaceBand × expectedByToday
//                     'under'  otherwise
// Rows come in table order: the Fixed group (budgetFixedCategories, importable from
// '@lifeguessr/engine/assumptions' to draw the groups), then the Flexible one (groceries, eating out,
// car, other). `totals` sum the category rows.
//
// Income row: the function has no planned income, so planned = expectedByToday = actual (the month's
// detectedPay, 0 without), remaining 0, status 'onPace'. A view-model that knows the planned take-home
// pay shows it next to this actual.
//
// Year view (budgetRowsForYear): the months of `year` present in `months` are summed; planned is the
// monthly plan × that count; each month's expected-by-today is taken as of its last statement day
// (`lastDay`, the whole month when absent), so a month in progress isn't expected in full.
//
// Invalid input (a day outside the month, a month outside YYYY-MM, a month listed twice, a negative
// or non-finite amount) throws a RangeError.
import {
  COST_CATEGORIES, type BudgetDay, type BudgetIncomeRow, type BudgetRow, type BudgetTable, type CategoryTotals,
  type CostCategory, type Money,
} from '@lifeguessr/types';
import { budgetFixedCategories, budgetOnPaceBand } from './assumptions';
import { daysInMonth } from './month';

const FIXED: readonly CostCategory[] = budgetFixedCategories.value;
const FLEXIBLE: readonly CostCategory[] = (['groceries', 'eatingOut', 'car', 'other'] as const)
  .filter((c) => !FIXED.includes(c));
/** Table order: Fixed, then Flexible; any category in neither list goes last. */
const ROW_ORDER: readonly CostCategory[] = [...FIXED, ...FLEXIBLE, ...COST_CATEGORIES.filter((c) => !FIXED.includes(c) && !FLEXIBLE.includes(c))];

const toCents = (dollars: Money) => Math.round(dollars * 100);

function amount(value: Money | undefined, what: string): Money {
  const v = value ?? 0;
  if (!Number.isFinite(v) || v < 0) throw new RangeError(`Invalid ${what}: ${v} (expected a finite amount ≥ 0)`);
  return v;
}

function checkDay(today: BudgetDay): void {
  const { day, daysInMonth: days } = today;
  if (!Number.isInteger(days) || days < 28 || days > 31) throw new RangeError(`Invalid daysInMonth: ${days} (28..31)`);
  if (!Number.isInteger(day) || day < 1 || day > days) throw new RangeError(`Invalid day ${day} (1..${days})`);
}

/** Expected spend by `day` in one month for one category (see the rules at the top). */
function expectedInMonth(category: CostCategory, planned: Money, actual: Money, day: number, days: number): Money {
  if (FIXED.includes(category)) return toCents(actual) > 0 ? planned : 0;
  return (planned * day) / days;
}

function status(planned: Money, actual: Money, expected: Money): BudgetRow['status'] {
  const [p, a, e] = [toCents(planned), toCents(actual), toCents(expected)];
  if (a > p) return 'over';
  return Math.abs(a - e) <= budgetOnPaceBand.value * e ? 'onPace' : 'under';
}

function table(
  plannedOf: (c: CostCategory) => Money, actualOf: (c: CostCategory) => Money, expectedOf: (c: CostCategory) => Money,
  pay: Money,
): BudgetTable {
  const rows: BudgetRow[] = ROW_ORDER.map((category) => {
    const planned = plannedOf(category);
    const actual = actualOf(category);
    const expectedByToday = expectedOf(category);
    return { category, planned, actual, remaining: planned - actual, expectedByToday, status: status(planned, actual, expectedByToday) };
  });
  const sum = (key: 'planned' | 'actual' | 'expectedByToday') => rows.reduce((s, r) => s + r[key], 0);
  const totals = { planned: sum('planned'), actual: sum('actual'), remaining: 0, expectedByToday: sum('expectedByToday') };
  totals.remaining = totals.planned - totals.actual;
  const income: BudgetIncomeRow = { planned: pay, actual: pay, remaining: 0, expectedByToday: pay, status: 'onPace' };
  return { income, rows, totals };
}

/** One month: `planned` monthly (default profile.spending), `actual` from the month's statement or daily log. */
export function budgetRows(
  planned: Record<CostCategory, Money>, actual: CategoryTotals | null, today: BudgetDay,
): BudgetTable {
  checkDay(today);
  if (actual) daysInMonth(actual.month);
  const plannedOf = (c: CostCategory) => amount(planned[c], `planned ${c}`);
  const actualOf = (c: CostCategory) => amount(actual?.totals[c], `actual ${c}`);
  return table(
    plannedOf,
    actualOf,
    (c) => expectedInMonth(c, plannedOf(c), actualOf(c), today.day, today.daysInMonth),
    amount(actual?.detectedPay, 'detectedPay'),
  );
}

/** The year view: sums the months of `year` that have data (`planned` is monthly). */
export function budgetRowsForYear(
  planned: Record<CostCategory, Money>, months: readonly CategoryTotals[], year: number,
): BudgetTable {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) throw new RangeError(`Invalid year: ${year}`);
  const seen = new Set<string>();
  const inYear = months.filter((m) => {
    daysInMonth(m.month);
    if (!m.month.startsWith(`${year}-`)) return false;
    if (seen.has(m.month)) throw new RangeError(`Month ${m.month} is listed twice`);
    seen.add(m.month);
    return true;
  });
  const plannedOf = (c: CostCategory) => amount(planned[c], `planned ${c}`) * inYear.length;
  // Summed in whole cents (statement totals are exact cents), so twelve months add up without float drift.
  const actualOf = (c: CostCategory) => inYear.reduce((s, m) => s + toCents(amount(m.totals[c], `${c} total for ${m.month}`)), 0) / 100;
  const expectedOf = (c: CostCategory) => inYear.reduce((s, m) => {
    const days = daysInMonth(m.month);
    const day = Math.min(days, Math.max(1, m.lastDay ?? days));
    return s + expectedInMonth(c, amount(planned[c], `planned ${c}`), amount(m.totals[c], `${c} total for ${m.month}`), day, days);
  }, 0);
  const pay = inYear.reduce((s, m) => s + toCents(amount(m.detectedPay, `detectedPay for ${m.month}`)), 0) / 100;
  return table(plannedOf, actualOf, expectedOf, pay);
}
