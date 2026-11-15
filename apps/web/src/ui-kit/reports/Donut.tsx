// A donut of parts of a whole (spending by group). Geometry only: each arc's length is its value's share
// of the sum, drawn with stroke dashes on one circle; the arcs sweep in on first paint. The center holds
// whatever the screen passes (a label and a total). Pair it with a legend that lists the amounts as text.
import type { ReactNode } from 'react';
import { cx } from '../cx';
import { TONE_STROKE, type ChartTone } from './tones';

export type DonutSegment = { id: string; value: number; tone: ChartTone };

export type DonutProps = {
  segments: readonly DonutSegment[];
  /** Accessible name; the segments themselves are decorative. */
  label: string;
  children?: ReactNode;
  className?: string;
};

const R = 42;
const GAP = 1.2; // in percent of the circle, between arcs

export function Donut({ segments, label, children, className }: DonutProps) {
  const parts = segments.filter((s) => s.value > 0);
  const sum = parts.reduce((s, p) => s + p.value, 0);
  let offset = 0;
  return (
    <figure className={cx('relative aspect-square w-full', className)} aria-label={label} role="img">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden="true">
        <circle cx={50} cy={50} r={R} pathLength={100} fill="none" className="stroke-surface-strong" strokeWidth={10} />
        {sum > 0 &&
          parts.map((p) => {
            const len = (p.value / sum) * 100;
            const arc = Math.max(0, len - (parts.length > 1 ? GAP : 0));
            const el = (
              <circle
                key={p.id}
                cx={50}
                cy={50}
                r={R}
                pathLength={100}
                fill="none"
                strokeWidth={10}
                strokeLinecap="butt"
                className={cx(
                  TONE_STROKE[p.tone],
                  'transition-[stroke-dasharray] duration-1000 ease-out starting:[stroke-dasharray:0_100] motion-reduce:transition-none',
                )}
                style={{ strokeDasharray: `${arc} ${100 - arc}`, strokeDashoffset: -offset }}
              />
            );
            offset += len;
            return el;
          })}
      </svg>
      {children && <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>}
    </figure>
  );
}
