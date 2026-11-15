'use client';

// A small line chart for the What if? tools (with vs without, a loan's balance, debt payoff): inline SVG
// laid out in real pixels (labels stay 12px on a phone), lines drawn in with CSS (stroke-dashoffset,
// off under prefers-reduced-motion), a zero line when values go negative, and a legend under it.
// Presentational: the caller passes points and formatters; the SVG is hidden from screen readers, so
// the caller puts the numbers that matter in text next to it (`summary` is read instead).
import { useId } from 'react';
import { cx } from './cx';
import { MOTION, TONE_BG, TONE_FILL, TONE_STROKE, type ChartTone } from './reports/tones';
import { useWidth } from './reports/useWidth';

export type ToolLineSeries = {
  id: string;
  label: string;
  tone: ChartTone;
  points: readonly { x: number; y: number }[];
  dashed?: boolean;
  /** Fill the area under the line, lightly. */
  area?: boolean;
};

export type ToolLineChartProps = {
  series: readonly ToolLineSeries[];
  /** x values with a tick label. */
  xTicks: readonly number[];
  formatX: (x: number) => string;
  formatY: (y: number) => string;
  /** Read by screen readers in place of the drawing. */
  summary: string;
  /** Shown above the chart; names the figure. */
  title?: string;
  height?: number;
  className?: string;
  'data-testid'?: string;
};

const PAD = { top: 12, right: 12, bottom: 26, left: 56 };

/** 4–5 round tick values covering [min, max]. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0];
  if (max === min) max = min + 1;
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.999; v += step) ticks.push(Math.round(v / step) * step);
  return ticks;
}

export function ToolLineChart({ series, xTicks, formatX, formatY, summary, title, height = 220, className, ...rest }: ToolLineChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>(600);
  const clipId = useId();
  const titleId = useId();
  const all = series.flatMap((s) => s.points);
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
  const xMin = Math.min(...xs, ...xTicks);
  const xMax = Math.max(...xs, ...xTicks);
  const yTicks = niceTicks(Math.min(0, ...ys), Math.max(0, ...ys));
  const yMin = yTicks[0]!;
  const yMax = yTicks[yTicks.length - 1]!;
  const w = Math.max(width, 200);
  const innerW = w - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const sx = (x: number) => PAD.left + (xMax === xMin ? 0 : ((x - xMin) / (xMax - xMin)) * innerW);
  const sy = (y: number) => PAD.top + (yMax === yMin ? innerH : (1 - (y - yMin) / (yMax - yMin)) * innerH);
  const path = (pts: ToolLineSeries['points']) => pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join('');

  return (
    <figure aria-labelledby={title ? titleId : undefined} className={cx('flex min-w-0 flex-col gap-sm', className)} {...rest}>
      {title && (
        <p id={titleId} className="text-base font-semibold">
          {title}
        </p>
      )}
      <div ref={ref} className="w-full">
        <svg role="img" aria-label={summary} width={w} height={height} viewBox={`0 0 ${w} ${height}`} className="block max-w-full overflow-visible">
          <defs>
            <clipPath id={clipId}>
              <rect x={PAD.left} y={PAD.top - 2} width={innerW} height={innerH + 4} />
            </clipPath>
          </defs>
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={w - PAD.right} y1={sy(t)} y2={sy(t)} className={t === 0 && yMin < 0 ? 'stroke-ink/60' : 'stroke-border'} strokeWidth={1} />
              <text x={PAD.left - 8} y={sy(t)} dy="0.32em" textAnchor="end" className="fill-text-muted text-xs tabular-nums">
                {formatY(t)}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text key={t} x={sx(t)} y={height - 6} textAnchor={t === xMin ? 'start' : t === xMax ? 'end' : 'middle'} className="fill-text-muted text-xs">
              {formatX(t)}
            </text>
          ))}
          <g clipPath={`url(#${clipId})`}>
            {series.map((s) =>
              s.area && s.points.length > 1 ? (
                <path
                  key={`${s.id}-area`}
                  d={`${path(s.points)}L${sx(s.points[s.points.length - 1]!.x).toFixed(1)},${sy(Math.max(yMin, 0)).toFixed(1)}L${sx(s.points[0]!.x).toFixed(1)},${sy(Math.max(yMin, 0)).toFixed(1)}Z`}
                  className={cx(TONE_FILL[s.tone], 'opacity-10', MOTION.fade)}
                />
              ) : null,
            )}
            {series.map((s) => (
              <path
                key={s.id}
                d={path(s.points)}
                pathLength={1}
                fill="none"
                strokeWidth={s.dashed ? 2 : 3}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={cx(TONE_STROKE[s.tone], s.dashed ? 'opacity-80' : MOTION.draw)}
                strokeDasharray={s.dashed ? '0.012 0.012' : undefined}
              />
            ))}
          </g>
          {series.map((s) => {
            const last = s.points[s.points.length - 1];
            return last ? (
              <circle key={`${s.id}-end`} cx={sx(last.x)} cy={sy(last.y)} r={4} className={cx(TONE_FILL[s.tone], 'stroke-surface', MOTION.fade)} strokeWidth={2} />
            ) : null;
          })}
        </svg>
      </div>
      <div className="flex flex-wrap gap-x-lg gap-y-xs text-xs text-text-muted">
        {series.map((s) => (
          <span key={s.id} className="flex items-center gap-xs">
            <span aria-hidden="true" className={cx('h-1 w-lg rounded-full', TONE_BG[s.tone], s.dashed && 'opacity-60')} />
            {s.label}
          </span>
        ))}
      </div>
    </figure>
  );
}
