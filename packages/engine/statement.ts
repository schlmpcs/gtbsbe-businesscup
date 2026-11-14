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
//   out; money out sorted as 'pay' makes no sense and counts as 'other'.
import {
  COST_CATEGORIES, type CategoryTotals, type CostCategory, type Money, type StatementClass, type StatementItem,
} from '@lifeguessr/types';
import { oneOffHintMinAmount, oneOffOutlierMinAmount, oneOffOutlierMultiple } from './assumptions';

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
};

/**
 * Sums classified statement lines into one CategoryTotals per month, oldest first. Every category
 * is present in `totals` (0 when the statement shows none); `detectedPay` only when pay was found.
 */
export function statementTotals(items: readonly ClassifiedStatementItem[]): CategoryTotals[] {
  const months = [...new Set(items.map((i) => i.month))].sort();

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

  const isOneOff = (item: ClassifiedStatementItem, category: CostCategory): boolean => {
    if (months.length < 2 || NEVER_ONE_OFF.has(category)) return false;
    if ((monthsByMerchant.get(merchantKey(item.label))?.size ?? 0) !== 1) return false;
    if (item.oneOffHint && item.amount >= oneOffHintMinAmount.value) return true;
    return item.amount >= oneOffOutlierMinAmount.value
      && item.amount >= oneOffOutlierMultiple.value * (medianByCategory.get(category) ?? 0);
  };

  const acc = new Map<string, MonthAcc>(
    months.map((m) => [m, { spend: new Map(), refunds: new Map(), payCents: 0, oneOffs: [] }]),
  );
  const add = (map: Map<CostCategory, number>, c: CostCategory, cents: number) => map.set(c, (map.get(c) ?? 0) + cents);

  for (const item of items) {
    const m = acc.get(item.month)!;
    const cents = toCents(item.amount);
    if (cents === 0) continue;
    if (cents > 0) {
      const category = spendCategory(item);
      if (category === null) continue;
      if (isOneOff(item, category)) m.oneOffs.push({ label: item.label, cents });
      else add(m.spend, category, cents);
    } else if (item.cls === 'pay') {
      m.payCents += -cents;
    } else if (isCostCategory(item.cls)) {
      add(m.refunds, item.cls, -cents);
    }
    // money in sorted as 'transfer': left out
  }

  return months.map((month): CategoryTotals => {
    const m = acc.get(month)!;
    const totals = Object.fromEntries(
      COST_CATEGORIES.map((c) => [c, toDollars(Math.max(0, (m.spend.get(c) ?? 0) - (m.refunds.get(c) ?? 0)))]),
    ) as Record<CostCategory, Money>;
    const oneOffs = m.oneOffs
      .sort((a, b) => b.cents - a.cents)
      .map((o) => ({ label: o.label, amount: toDollars(o.cents) }));
    return { month, totals, oneOffs, ...(m.payCents > 0 ? { detectedPay: toDollars(m.payCents) } : {}) };
  });
}
