import { common, duel as t } from '@/copy';
import { EstimateTag, Money, cx } from '@/ui-kit';
import type { CostCategory, DuelCategoryVM } from '../model/types';

/** Category colors (Figma): rent blue, childcare pink, car yellow, food green, everything else gray. */
export const CATEGORY_COLOR: Record<CostCategory, string> = {
  rentUtilities: 'bg-chart-1',
  childcare: 'bg-chart-2',
  car: 'bg-chart-3',
  groceries: 'bg-chart-4',
  eatingOut: 'bg-chart-4/60',
  subscriptions: 'bg-chart-6',
  debtPayments: 'bg-chart-6',
  other: 'bg-chart-6',
};

export type CategoryBarProps = {
  /** Accessible name of the legend list. */
  label: string;
  categories: readonly DuelCategoryVM[];
  className?: string;
};

/**
 * One stacked bar of a life's monthly costs (segment width = the view-model's `scale`, shared by
 * both cards so the costlier life fills the track), and a legend with each amount.
 */
export function CategoryBar({ label, categories, className }: CategoryBarProps) {
  return (
    <div className={cx('flex flex-col gap-sm', className)}>
      <div aria-hidden="true" className="flex h-md w-full overflow-hidden rounded-full bg-surface-strong">
        {categories.map((c) => (
          <span key={c.category} className={cx('h-full', CATEGORY_COLOR[c.category])} style={{ width: `${c.scale * 100}%` }} />
        ))}
      </div>
      <ul aria-label={label} className="flex flex-col gap-xs text-sm">
        {categories.map((c) => (
          <li key={c.category} className="flex items-center justify-between gap-sm">
            <span className="flex min-w-0 items-center gap-xs">
              <span aria-hidden="true" className={cx('size-sm shrink-0 rounded-full', CATEGORY_COLOR[c.category])} />
              <span className="truncate">{common.categories[c.category]}</span>
              {c.isEstimate && <EstimateTag />}
            </span>
            <span className="shrink-0 font-semibold tabular-nums">
              <Money value={c.amount} />
              <span className="text-text-muted">{t.card.perMonth}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
