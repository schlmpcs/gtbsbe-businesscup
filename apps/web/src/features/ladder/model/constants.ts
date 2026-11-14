// Slider bounds for the ladder screens (UI ranges, not finance assumptions).
import type { CostCategory, Money } from '@lifeguessr/types';

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
