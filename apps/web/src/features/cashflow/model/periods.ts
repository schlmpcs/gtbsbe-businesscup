// The periods Cash Flow draws: calendar months, quarters and years ending with the one that holds today.
import { addMonths } from '@lifeguessr/engine';
import type { CashFlowPeriod, YearMonth } from '@lifeguessr/types';
import type { CashFlowPeriodKind } from './types';

/** How many bars each period kind draws. */
export const BAR_COUNT: Record<CashFlowPeriodKind, number> = { monthly: 6, quarterly: 4, yearly: 3 };

/** The periods of `kind`, oldest first; the last one contains `month`. */
export function periodsFor(kind: CashFlowPeriodKind, month: YearMonth): CashFlowPeriod[] {
  const count = BAR_COUNT[kind];
  const year = month.slice(0, 4);
  const first =
    kind === 'monthly'
      ? month
      : kind === 'quarterly'
        ? `${year}-${String(Math.floor((Number(month.slice(5, 7)) - 1) / 3) * 3 + 1).padStart(2, '0')}`
        : `${year}-01`;
  const length = kind === 'monthly' ? 1 : kind === 'quarterly' ? 3 : 12;
  return Array.from({ length: count }, (_, i) => {
    const from = addMonths(first, -length * (count - 1 - i));
    return { from, to: addMonths(from, length - 1) };
  });
}

/** The quarter (1..4) a quarterly period is. */
export const quarterOf = (p: CashFlowPeriod): 1 | 2 | 3 | 4 => (Math.floor((Number(p.from.slice(5, 7)) - 1) / 3) + 1) as 1 | 2 | 3 | 4;
