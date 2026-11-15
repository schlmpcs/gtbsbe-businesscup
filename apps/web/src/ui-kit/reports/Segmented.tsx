'use client';

// A compact segmented selector for a card's title row (period, chart type, grouping): native radios, so
// arrow keys move and each option is found by its label. An option can carry a tiny preview (an icon or
// a thumbnail of the chart it picks). The legend is visually hidden unless `showLegend`.
import type { ReactNode } from 'react';
import { cx } from '../cx';

export type SegmentedOption<T extends string> = { value: T; label: string; preview?: ReactNode };

export type SegmentedProps<T extends string> = {
  legend: string;
  name: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  showLegend?: boolean;
  className?: string;
};

export function Segmented<T extends string>({ legend, name, value, options, onChange, showLegend = false, className }: SegmentedProps<T>) {
  return (
    <fieldset className={cx('min-w-0', className)}>
      <legend className={showLegend ? 'mb-xs text-xs font-medium text-text-muted' : 'sr-only'}>{legend}</legend>
      <div className="inline-flex max-w-full flex-wrap gap-xs rounded-lg bg-surface-strong p-xs">
        {options.map((o) => (
          <label
            key={o.value}
            className={cx(
              'flex min-h-11 cursor-pointer items-center gap-sm rounded-md px-md text-sm font-semibold leading-tight text-text-muted transition-colors sm:min-h-9',
              'hover:text-text has-checked:bg-surface has-checked:text-text has-checked:shadow-sm',
              'has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-focus',
            )}
          >
            <input type="radio" className="sr-only" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
            {o.preview && <span aria-hidden="true" className="flex shrink-0 items-center">{o.preview}</span>}
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
