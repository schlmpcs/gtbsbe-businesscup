// A progress ring (a goal's saved share). `value` is a ratio; over 1 draws a full ring. It fills in on
// first paint. The center holds what the screen passes (the percent, an icon).
import type { ReactNode } from 'react';
import { cx } from '../cx';
import { TONE_STROKE, type ChartTone } from './tones';

export type RingProps = { value: number; tone?: ChartTone; children?: ReactNode; className?: string; thickness?: number };

export function Ring({ value, tone = 'primary', children, className, thickness = 9 }: RingProps) {
  const r = 50 - thickness / 2 - 1;
  const len = Math.min(100, Math.max(0, value * 100));
  return (
    <div className={cx('relative aspect-square shrink-0', className)}>
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden="true">
        <circle cx={50} cy={50} r={r} pathLength={100} fill="none" className="stroke-surface-strong" strokeWidth={thickness} />
        {len > 0 && (
          <circle
            cx={50}
            cy={50}
            r={r}
            pathLength={100}
            fill="none"
            strokeWidth={thickness}
            strokeLinecap="round"
            className={cx(TONE_STROKE[tone], 'transition-[stroke-dasharray] duration-1000 ease-out starting:[stroke-dasharray:0_100] motion-reduce:transition-none')}
            style={{ strokeDasharray: `${len} ${100 - len}` }}
          />
        )}
      </svg>
      {children && <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>}
    </div>
  );
}
