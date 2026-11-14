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
          <li key={c.category} className="grid grid-cols-1 items-start gap-x-sm sm:grid-cols-[minmax(0,1fr)_auto]">
            <span className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-xs">
              <span aria-hidden="true" className={cx('size-sm rounded-full', CATEGORY_COLOR[c.category])} />
              <span className="flex min-w-0 flex-col items-start gap-xs">
                <span className="break-words">{common.categories[c.category]}</span>
                {c.isEstimate && <EstimateTag />}
              </span>
            </span>
            <span className="flex shrink-0 items-baseline gap-xs justify-self-end font-semibold tabular-nums">
              <Money value={c.amount} />
              <span className="text-text-muted">{t.card.perMonth}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
