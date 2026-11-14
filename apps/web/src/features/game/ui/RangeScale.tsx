import type { CSSProperties } from 'react';
import { game as t } from '@/copy';
import { cx, formatMoney } from '@/ui-kit';
import type { RevealVM } from '../model/types';

/**
 * The guess against the typical range on one log track. Positions (0–1) come from the view-model;
 * CSS turns them into offsets through custom properties.
 */
export function RangeScale({ reveal }: { reveal: RevealVM }) {
  const { scale, total, guess, direction } = reveal;
  const vars = { '--lo': scale.low, '--hi': scale.high, '--mid': scale.mid, '--guess': scale.guess } as CSSProperties;
  // A miss is marked in ink, not red (Design v3: a miss is neutral, never an alarm).
  const pin = direction === 'in' ? 'bg-positive' : 'bg-ink';
  return (
    <figure
      aria-label={t.reveal.scaleLabel(formatMoney(guess), formatMoney(total.low), formatMoney(total.high))}
      className="flex flex-col gap-sm"
    >
      <div aria-hidden="true" className="px-sm">
        <div className="relative h-2xl" style={vars}>
          <div className="absolute inset-x-0 top-1/2 h-sm -translate-y-1/2 rounded-full bg-surface-strong" />
          <div className="absolute top-1/2 left-[calc(var(--lo)*100%)] h-lg w-[calc((var(--hi)_-_var(--lo))*100%)] -translate-y-1/2 rounded-sm bg-chart-band" />
          <div className="absolute top-1/2 left-[calc(var(--mid)*100%)] h-lg w-xs -translate-x-1/2 -translate-y-1/2 rounded-full bg-chart-1" />
          <div
            className={cx(
              'absolute top-0 left-[calc(var(--guess)*100%)] h-full w-xs -translate-x-1/2 rounded-full',
              pin,
            )}
          />
        </div>
        <div className="flex justify-between text-xs text-text-muted tabular-nums">
          <span>{formatMoney(scale.min)}</span>
          <span>{formatMoney(scale.max)}</span>
        </div>
      </div>
      <figcaption className="flex flex-wrap gap-x-lg gap-y-xs text-sm">
        <span className="flex items-center gap-xs">
          <span aria-hidden="true" className="inline-block h-sm w-lg rounded-sm bg-chart-band" />
          {t.reveal.scaleRange}
        </span>
        <span className="flex items-center gap-xs">
          <span aria-hidden="true" className="inline-block h-sm w-xs rounded-full bg-chart-1" />
          {t.reveal.scaleMid}
        </span>
        <span className="flex items-center gap-xs">
          <span aria-hidden="true" className={cx('inline-block h-sm w-xs rounded-full', pin)} />
          {t.reveal.yourGuess}
        </span>
      </figcaption>
    </figure>
  );
}
