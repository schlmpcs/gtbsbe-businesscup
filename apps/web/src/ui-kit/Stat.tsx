import type { Source } from '@lifeguessr/types';
import type { ReactNode } from 'react';
import { cx } from './cx';
import { EstimateTag } from './EstimateTag';
import { SourceNote } from './SourceNote';

export type StatTone = 'default' | 'positive' | 'warning' | 'negative';

const TONE: Record<StatTone, string> = {
  default: 'text-text',
  positive: 'text-positive',
  warning: 'text-warning',
  negative: 'text-negative',
};

const SIZE = {
  md: 'text-3xl',
  lg: 'text-4xl',
  display: 'text-display leading-display',
} as const;

export type StatProps = {
  label: ReactNode;
  /** The already formatted value, e.g. formatMoney(x) or <Money value={x} />. */
  value: ReactNode;
  /** Shows an "estimate" tag: the value (or an input behind it) was defaulted, not given. */
  isEstimate?: boolean;
  /** Where the number comes from; shown as a footnote (or a tap-to-show toggle). */
  source?: Source;
  sourceVariant?: 'footnote' | 'toggle';
  /** Small print under the value (e.g. "per month", "in today's dollars"). */
  hint?: ReactNode;
  tone?: StatTone;
  size?: keyof typeof SIZE;
  className?: string;
};

/** One headline number with its label, estimate tag and source. */
export function Stat({
  label,
  value,
  isEstimate = false,
  source,
  sourceVariant = 'footnote',
  hint,
  tone = 'default',
  size = 'md',
  className,
}: StatProps) {
  return (
    <div className={cx('flex min-w-0 flex-col gap-xs', className)}>
      <div className="flex flex-wrap items-center gap-sm text-sm text-text-muted">
        <span>{label}</span>
        {isEstimate && <EstimateTag />}
      </div>
      <div className={cx('font-display font-extrabold leading-tight tabular-nums', SIZE[size], TONE[tone])}>{value}</div>
      {hint && <p className="text-sm text-text-muted">{hint}</p>}
      {source && <SourceNote source={source} variant={sourceVariant} />}
    </div>
  );
}
