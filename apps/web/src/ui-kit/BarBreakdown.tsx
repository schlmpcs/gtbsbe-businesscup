import type { Source } from '@lifeguessr/types';
import type { ReactNode } from 'react';
import { common } from '@/copy';
import { cx } from './cx';
import { EstimateTag } from './EstimateTag';
import { formatMoney } from './format';
import { SourceNote } from './SourceNote';

export type BarBreakdownItem = {
  id: string;
  label: ReactNode;
  /** Unrounded dollars (or any non-negative amount; see formatValue). */
  amount: number;
  /** Visibly tagged and drawn hatched: the amount was defaulted, not given. */
  isEstimate?: boolean;
  source?: Source;
};

export type BarBreakdownProps = {
  /** Accessible name of the list (e.g. "Monthly costs by category"). */
  label: string;
  /** Shown in the order given; sort before passing if you want largest first. */
  items: readonly BarBreakdownItem[];
  /** Bar length scale: the amount that fills a whole row (default: the largest amount). */
  scaleMax?: number;
  /** Formats each amount (default formatMoney). */
  formatValue?: (amount: number) => string;
  /** A total line under the bars, already computed by the caller (e.g. CostBreakdown.total.mid). */
  total?: number;
  /** Highlight one item (e.g. the biggest surprise in the reveal). */
  highlightId?: string;
  className?: string;
};

// Diagonal stripes for estimate bars, so "estimate" is visible without color alone.
const HATCH =
  'bg-[repeating-linear-gradient(135deg,var(--color-chart-1)_0_var(--spacing-xs),var(--color-chart-band)_var(--spacing-xs)_var(--spacing-sm))]';

/** Horizontal bars of category amounts; estimated items are tagged and hatched; sources shown per row. */
export function BarBreakdown({
  label,
  items,
  scaleMax,
  formatValue = (n) => formatMoney(n),
  total,
  highlightId,
  className,
}: BarBreakdownProps) {
  const largest = Math.max(0, ...items.map((i) => (Number.isFinite(i.amount) ? i.amount : 0)));
  const fullScale = scaleMax && scaleMax > 0 ? scaleMax : largest;
  const width = (amount: number) =>
    fullScale > 0 && Number.isFinite(amount) ? `${Math.min(100, Math.max(0, (amount / fullScale) * 100))}%` : '0%';

  return (
    <div className={cx('flex flex-col gap-md', className)}>
      <ul aria-label={label} className="flex flex-col gap-md">
        {items.map((item) => (
          <li key={item.id} className="flex flex-col gap-xs">
            <div className="flex items-baseline justify-between gap-md text-sm">
              <span className="flex min-w-0 flex-wrap items-center gap-sm">
                <span className={cx(item.id === highlightId && 'font-semibold')}>{item.label}</span>
                {item.isEstimate && <EstimateTag />}
              </span>
              <span className="shrink-0 font-semibold tabular-nums">{formatValue(item.amount)}</span>
            </div>
            <div aria-hidden="true" className="h-sm w-full overflow-hidden rounded-full bg-surface-strong">
              <div
                className={cx(
                  'h-full rounded-full transition-[width] duration-500',
                  item.isEstimate ? HATCH : item.id === highlightId ? 'bg-chart-2' : 'bg-chart-1',
                )}
                style={{ width: width(item.amount) }}
              />
            </div>
            {item.source && <SourceNote source={item.source} />}
          </li>
        ))}
      </ul>
      {total !== undefined && (
        <div className="flex items-baseline justify-between gap-md border-t border-border pt-md">
          <span className="text-sm font-medium">{common.kit.breakdown.total}</span>
          <span className="text-lg font-semibold tabular-nums">{formatValue(total)}</span>
        </div>
      )}
    </div>
  );
}
