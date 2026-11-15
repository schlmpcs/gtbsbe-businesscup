// A KPI strip: 2–4 headline numbers in one white card, label above, big display number, small hint
// under it. Two columns on a phone, one row from `sm` up, hairlines between. Presentational.
import type { ReactNode } from 'react';
import { cx } from '../cx';
import { MOTION, TONE_BG, type ChartTone } from './tones';

export type KpiItem = {
  id: string;
  label: ReactNode;
  /** The formatted value (often a <CountUp>). */
  value: ReactNode;
  hint?: ReactNode;
  /** A dot of this tone before the label (ties the number to a chart color). */
  dot?: ChartTone;
  /** Text color of the value. */
  tone?: 'default' | 'positive' | 'negative' | 'warning';
  /** Extra tag after the label (an estimate tag). */
  tag?: ReactNode;
};

const VALUE_TONE = { default: 'text-text', positive: 'text-positive', negative: 'text-negative', warning: 'text-warning' } as const;

export function KpiStrip({ items, className, ...rest }: { items: readonly KpiItem[]; className?: string; 'data-testid'?: string; 'aria-label'?: string }) {
  const cols = items.length >= 4 ? 'sm:grid-cols-4' : items.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2';
  return (
    <dl
      className={cx(
        'grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border shadow-md',
        cols,
        items.length % 2 === 1 && 'max-sm:[&>div:first-child]:col-span-2',
        MOTION.rise,
        className,
      )}
      {...rest}
    >
      {items.map((k) => (
        <div key={k.id} data-kpi={k.id} className="flex min-w-0 flex-col gap-xs bg-surface p-lg sm:p-xl">
          <dt className="flex min-w-0 flex-wrap items-center gap-xs text-sm text-text-muted">
            {k.dot && <span aria-hidden="true" className={cx('size-2 shrink-0 rounded-full', TONE_BG[k.dot])} />}
            <span className="min-w-0">{k.label}</span>
            {k.tag}
          </dt>
          <dd className={cx('min-w-0 truncate font-display text-2xl font-extrabold leading-tight tabular-nums lg:text-3xl', VALUE_TONE[k.tone ?? 'default'])}>
            {k.value}
          </dd>
          {k.hint && <dd className="text-xs text-text-muted">{k.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}
