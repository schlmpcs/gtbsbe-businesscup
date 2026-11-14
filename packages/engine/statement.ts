// Statement lines → CategoryTotals per month (T7). The categorizer (AI or keyword rules) only
// sorts labels into classes; every dollar here is summed in code, in whole cents so the totals are
// exact. Spec: docs/ENGINEERING.md → Statements; docs/ARCHITECTURE.md → Privacy design.
//
// Per month:
// - money out in a cost category → that category's total, unless it is a one-off (then it is
//   listed in `oneOffs` and left out of `totals`, so it can't inflate the averages);
// - money in sorted as a cost category is a refund: it comes off that category (never below 0);
// - money in sorted as 'pay' → `detectedPay` (take-home pay that month);
// - 'transfer' lines (between the user's own accounts, or money received from a person) are left
//   out; money out sorted as 'pay' makes no sense and counts as 'other';
// - `lastDay` = the day of the month's latest line of any kind (how far the statement goes), so
//   month-end can project the month in progress from the days that have data; `firstDay` = the
//   earliest, so a statement that starts mid-month isn't averaged as if it covered the whole month.
//
// `statementAverages` turns the months into the monthly values that replace the profile's
// estimates: the mean of the months the statement covers in full.
import {
  COST_CATEGORIES, type CategoryTotals, type CostCategory, type Money, type StatementClass, type StatementItem,
} from '@lifeguessr/types';
import {
  oneOffHintMinAmount, oneOffOutlierMinAmount, oneOffOutlierMultiple, statementEssentialCategories,
  statementFullMonthSlackDays,
} from './assumptions';
import { daysInMonth } from './month';

export type ClassifiedStatementItem = StatementItem & {
  cls: StatementClass;
  /** The categorizer thinks this merchant is typically a one-off or yearly charge. */
  oneOffHint: boolean;
};

/** Categories that recur by nature: never one-offs, however large or rare. */
const NEVER_ONE_OFF: ReadonlySet<CostCategory> = new Set(['rentUtilities', 'childcare', 'debtPayments']);

const isCostCategory = (c: StatementClass): c is CostCategory => (COST_CATEGORIES as readonly string[]).includes(c);

const toCents = (dollars: Money) => Math.round(dollars * 100);
const toDollars = (cents: number): Money => cents / 100;

/**
 * The merchant behind a (masked) label, for "does this merchant recur?": upper case, without the
 * masks, digits and punctuation that change from line to line (store numbers, reference ids).
 */
export function merchantKey(label: string): string {
  return label
    .toUpperCase()
    .replace(/\[[A-Z#]*\]/g, ' ')
    .replace(/[^A-Z]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** The cost category a line's money-out counts toward, or null when it is not spending. */
function spendCategory(item: ClassifiedStatementItem): CostCategory | null {
  if (item.amount <= 0) return null;
  if (item.cls === 'transfer') return null;
  return isCostCategory(item.cls) ? item.cls : 'other';
}

type MonthAcc = {
  spend: Map<CostCategory, number>;
  refunds: Map<CostCategory, number>;
  payCents: number;
  oneOffs: { label: string; cents: number }[];
  firstDay: number;
  lastDay: number;
};

/**
 * Which lines are one-offs (see the rules at the top), in the order given. Only money out in a cost
 * category can be one; everything else is false.
 */
export function oneOffFlags(items: readonly ClassifiedStatementItem[]): boolean[] {
  const months = new Set(items.map((i) => i.month));

  // Which merchants recur across months, and the typical charge per category (for the outlier rule).
  const monthsByMerchant = new Map<string, Set<string>>();
  const chargesByCategory = new Map<CostCategory, number[]>();
  for (const item of items) {
    const category = spendCategory(item);
    if (category === null) continue;
    const key = merchantKey(item.label);
    const seen = monthsByMerchant.get(key) ?? new Set<string>();
    seen.add(item.month);
    monthsByMerchant.set(key, seen);
    const charges = chargesByCategory.get(category) ?? [];
    charges.push(item.amount);
    chargesByCategory.set(category, charges);
  }
  const medianByCategory = new Map([...chargesByCategory].map(([c, v]) => [c, median(v)]));

  return items.map((item) => {
    const category = spendCategory(item);
    if (category === null || toCents(item.amount) <= 0) return false;
    if (months.size < 2 || NEVER_ONE_OFF.has(category)) return false;
    if ((monthsByMerchant.get(merchantKey(item.label))?.size ?? 0) !== 1) return false;
    if (item.oneOffHint && item.amount >= oneOffHintMinAmount.value) return true;
    return item.amount >= oneOffOutlierMinAmount.value
      && item.amount >= oneOffOutlierMultiple.value * (medianByCategory.get(category) ?? 0);
  });
}

/**
 * Sums classified statement lines into one CategoryTotals per month, oldest first. Every category
 * is present in `totals` (0 when the statement shows none); `detectedPay` only when pay was found.
 */
export function statementTotals(items: readonly ClassifiedStatementItem[]): CategoryTotals[] {
  const months = [...new Set(items.map((i) => i.month))].sort();
  const oneOff = oneOffFlags(items);

  const acc = new Map<string, MonthAcc>(
    months.map((m) => [m, { spend: new Map(), refunds: new Map(), payCents: 0, oneOffs: [], firstDay: 31, lastDay: 0 }]),
  );
  const add = (map: Map<CostCategory, number>, c: CostCategory, cents: number) => map.set(c, (map.get(c) ?? 0) + cents);

  items.forEach((item, i) => {
    const m = acc.get(item.month)!;
    // Every dated line counts toward how far the statement goes, even one left out below.
    m.firstDay = Math.min(m.firstDay, item.day);
    m.lastDay = Math.max(m.lastDay, item.day);
    const cents = toCents(item.amount);
    if (cents === 0) return;
    if (cents > 0) {
      const category = spendCategory(item);
      if (category === null) return;
      if (oneOff[i]) m.oneOffs.push({ label: item.label, cents });
      else add(m.spend, category, cents);
    } else if (item.cls === 'pay') {
      m.payCents += -cents;
    } else if (isCostCategory(item.cls)) {
      add(m.refunds, item.cls, -cents);
    }
    // money in sorted as 'transfer': left out
  });

  return months.map((month): CategoryTotals => {
    const m = acc.get(month)!;
    const totals = Object.fromEntries(
      COST_CATEGORIES.map((c) => [c, toDollars(Math.max(0, (m.spend.get(c) ?? 0) - (m.refunds.get(c) ?? 0)))]),
    ) as Record<CostCategory, Money>;
    const oneOffs = m.oneOffs
      .sort((a, b) => b.cents - a.cents)
      .map((o) => ({ label: o.label, amount: toDollars(o.cents) }));
    return {
      month, totals, oneOffs, ...(m.payCents > 0 ? { detectedPay: toDollars(m.payCents) } : {}),
      firstDay: m.firstDay, lastDay: m.lastDay,
    };
  });
}

/**
 * The statement covers this month (nearly) in full: its first line is within the slack of the 1st
 * and its last within the slack of the month's end. Months saved before `firstDay`/`lastDay`
 * existed count as full, as they always did.
 */
export function isFullStatementMonth(m: Pick<CategoryTotals, 'month' | 'firstDay' | 'lastDay'>): boolean {
  const slack = statementFullMonthSlackDays.value;
  return (m.firstDay ?? 1) <= 1 + slack && (m.lastDay ?? daysInMonth(m.month)) >= daysInMonth(m.month) - slack;
}

/** The months the averages are taken over: the full ones, or every month when none is full (a two-week export). */
export function averagedStatementMonths<T extends Pick<CategoryTotals, 'month' | 'firstDay' | 'lastDay'>>(months: readonly T[]): T[] {
  const full = months.filter(isFullStatementMonth);
  return full.length > 0 ? full : [...months];
}

export type StatementAverages = {
  /**
   * Monthly spending per category: the mean over the averaged months. An essential category
   * (`statementEssentialCategories`) the statement shows none of is left out: a statement without
   * rent says the rent is paid elsewhere, not that it is $0.
   */
  spending: Partial<Record<CostCategory, Money>>;
  /** Mean take-home pay over the averaged months that had pay; null when none had. */
  takeHomePay: Money | null;
  /** The months the means were taken over ('YYYY-MM', oldest first). */
  months: string[];
};

/** Statement months → the monthly values that replace the profile's estimates (measured). */
export function statementAverages(months: readonly CategoryTotals[]): StatementAverages {
  const used = averagedStatementMonths(months);
  if (used.length === 0) return { spending: {}, takeHomePay: null, months: [] };
  const essential: readonly CostCategory[] = statementEssentialCategories.value;
  const spending: Partial<Record<CostCategory, Money>> = {};
  for (const c of COST_CATEGORIES) {
    const values = used.map((m) => m.totals[c]).filter((v): v is Money => typeof v === 'number' && Number.isFinite(v));
    if (values.length === 0) continue;
    const mean = Math.max(0, values.reduce((s, v) => s + v, 0) / values.length);
    if (mean === 0 && essential.includes(c)) continue;
    spending[c] = mean;
  }
  const pays = used.map((m) => m.detectedPay).filter((v): v is Money => typeof v === 'number' && v > 0);
  return {
    spending,
    takeHomePay: pays.length > 0 ? pays.reduce((s, v) => s + v, 0) / pays.length : null,
    months: used.map((m) => m.month).sort(),
  };
}
