// Emergency cushion: how many months cash on hand would last with zero income.
//
//   essential monthly = rentUtilities + groceries + childcare + car (running costs)
//                       + minimum payments on every debt with a balance
//   full monthly      = every spending category except the informational `debtPayments`
//                       + the same minimum payments (extra payments are optional, so not counted)
//   months            = max(cash, 0) / monthly
//
// Essentials are what keeps a roof, food, childcare, a working car and debts in good standing;
// eating out, subscriptions and "other" can be paused. Debt payments come from `Profile.debts`
// (minimum only), never from `spending.debtPayments`, as in simulate(). A card's estimated minimum
// is stored as today's output of the card formula, so `minPayment.value` is today's payment.
//
// Band (cushionBandMonths, an educational rule of thumb): under 1 month, 1–3, 3–6, 6+. `next` is
// the next band up and the extra cash it takes to reach it (null at 6+). With no essential spending
// there is nothing to cover: months are null and the band is '6plus'.
import type { CostCategory, Money, Profile } from '@lifeguessr/types';
import { cushionBandMonths } from './assumptions';

/** The spending categories that count as essential (debt minimum payments are added on top). */
export const CUSHION_ESSENTIAL_CATEGORIES = ['rentUtilities', 'groceries', 'childcare', 'car'] as const satisfies readonly CostCategory[];

export type CushionBand = 'under1' | '1to3' | '3to6' | '6plus';

export type Cushion = {
  /** Cash on hand (balance), floored at 0. */
  cash: Money;
  /** Essential spending per month, debt minimum payments included. */
  essentialMonthly: Money;
  /** All spending per month (debtPayments category excluded), debt minimum payments included. */
  fullMonthly: Money;
  /** Debt minimum payments per month (part of both totals). */
  debtMinimums: Money;
  /** Months cash covers essentials; null when there is no essential spending. Unrounded. */
  monthsEssential: number | null;
  /** Months cash covers all spending; null when there is no spending. Unrounded. */
  monthsFull: number | null;
  band: CushionBand;
  /** The next band up: its lower edge in months and the extra cash to reach it. Null at 6+. */
  next: { band: Exclude<CushionBand, 'under1'>; months: number; extraCash: Money } | null;
  /** True when cash or any input to the essential total is an estimate. */
  isEstimate: boolean;
};

const BANDS: { band: Exclude<CushionBand, 'under1'>; key: keyof typeof cushionBandMonths.value }[] = [
  { band: '1to3', key: 'thin' },
  { band: '3to6', key: 'okay' },
  { band: '6plus', key: 'solid' },
];

/** The band a number of months falls in (thresholds from cushionBandMonths; a lower edge is in its band). */
export function cushionBand(months: number): CushionBand {
  const t = cushionBandMonths.value;
  if (months >= t.solid) return '6plus';
  if (months >= t.okay) return '3to6';
  if (months >= t.thin) return '1to3';
  return 'under1';
}

/** Months of cash with zero income, for essentials and for full spending, with the band and the next step. */
export function emergencyCushion(p: Pick<Profile, 'cash' | 'spending' | 'debts'>): Cushion {
  const debtMinimums = p.debts
    .filter((d) => d.balance > 0)
    .reduce((sum, d) => sum + Math.max(0, Math.min(d.minPayment.value, d.balance)), 0);
  const essentialSpend = CUSHION_ESSENTIAL_CATEGORIES.reduce((s, c) => s + Math.max(0, p.spending[c].value), 0);
  const allSpend = (Object.keys(p.spending) as CostCategory[])
    .filter((c) => c !== 'debtPayments')
    .reduce((s, c) => s + Math.max(0, p.spending[c].value), 0);
  const essentialMonthly = essentialSpend + debtMinimums;
  const fullMonthly = allSpend + debtMinimums;
  const cash = Math.max(0, p.cash.value);

  const monthsEssential = essentialMonthly > 0 ? cash / essentialMonthly : null;
  const monthsFull = fullMonthly > 0 ? cash / fullMonthly : null;
  const band = monthsEssential === null ? '6plus' : cushionBand(monthsEssential);

  let next: Cushion['next'] = null;
  if (monthsEssential !== null) {
    const up = BANDS.find((b) => monthsEssential < cushionBandMonths.value[b.key]);
    if (up) {
      const months = cushionBandMonths.value[up.key];
      next = { band: up.band, months, extraCash: Math.max(0, months * essentialMonthly - cash) };
    }
  }

  const isEstimate =
    p.cash.isEstimate ||
    CUSHION_ESSENTIAL_CATEGORIES.some((c) => p.spending[c].isEstimate) ||
    p.debts.some((d) => d.balance > 0 && d.minPayment.isEstimate);

  return { cash, essentialMonthly, fullMonthly, debtMinimums, monthsEssential, monthsFull, band, next, isEstimate };
}
