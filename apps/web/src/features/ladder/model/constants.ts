// Slider bounds for the ladder screens (UI ranges, not finance assumptions).
import type { CostCategory, Money } from '@lifeguessr/types';
import type { BalanceFieldKey, InputBounds } from './types';

/** S7 sliders in display order, with their default upper bound and step (monthly dollars). */
export const SPENDING_SLIDERS: readonly { category: CostCategory; max: Money; step: Money }[] = [
  { category: 'rentUtilities', max: 6_000, step: 25 },
  { category: 'car', max: 2_000, step: 10 },
  { category: 'childcare', max: 4_000, step: 25 },
  { category: 'groceries', max: 2_000, step: 10 },
  { category: 'eatingOut', max: 1_500, step: 10 },
  { category: 'subscriptions', max: 500, step: 5 },
  { category: 'other', max: 3_000, step: 10 },
];

/** A slider's max grows to fit a larger current value (×1.5), so the thumb is never pinned. */
export const SLIDER_HEADROOM = 1.5;

/** Retirement savings share slider: 0–50% of the surplus, 1% steps (decimals). */
export const SAVINGS_SHARE_MAX = 0.5;
export const SAVINGS_SHARE_STEP = 0.01;

/**
 * S8 input bounds: what ProfileSchema accepts (packages/types/schemas.ts), so a value typed
 * mid-edit can never make the saved profile invalid. A money `max` is a sanity cap only.
 */
export const BALANCE_FIELD_BOUNDS = {
  age: { min: 16, max: 110, step: 1 },
  takeHomePay: { min: 0, max: 1_000_000, step: 1 },
  cash: { min: -10_000_000, max: 100_000_000, step: 1 },
  retirement: { min: 0, max: 100_000_000, step: 1 },
} as const satisfies Record<BalanceFieldKey, InputBounds>;

/** S8 debt row bounds: APR is a decimal 0–1 (AprSchema); balances and payments are ≥ 0. */
export const DEBT_BOUNDS = {
  balance: { min: 0, max: 100_000_000, step: 1 },
  apr: { min: 0, max: 1, step: 0.0001 },
  minPayment: { min: 0, max: 1_000_000, step: 1 },
} as const satisfies Record<string, InputBounds>;

/** End of the S8 debt-load gauge's dial (a display scale past the red threshold, not a rule). */
export const DEBT_LOAD_GAUGE_MAX = 0.6;
