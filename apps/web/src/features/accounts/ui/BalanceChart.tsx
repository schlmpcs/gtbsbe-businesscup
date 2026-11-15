'use client';

// A smooth area chart of month-end balances (net worth on Accounts, one balance on Account detail).
// Inline SVG laid out in real pixels at the card's width: a soft gradient area, the line drawn in on
// first paint, a zero line when the series crosses it, the low and high on the left and the first and
// last month under it. Presentational: the points come from the view-model; only the drawing scale
// (and the curve's control points) is worked out here.
import { useId } from 'react';
import { cx, formatMoney, formatMonthYear } from '@/ui-kit';
import { MOTION, useWidth } from '@/ui-kit/reports';
import type { BalancePointVM } from '../model/types';

export type BalanceChartProps = {
  points: BalancePointVM[];
  /** Accessible name of the chart. */
  label: string;
  /** Shown instead of the line when there are fewer than two points. */
  tooFew: string;
  /** Drawing height in px (default 200). */
  height?: number;
  className?: string;
};

const PAD_Y = 14;
const LEFT = 56;

/** A smooth path through the points (monotone in x, so it never overshoots between months). */
function smooth(xy: readonly [number, number][]): string {
  if (xy.length < 2) return '';
  let d = `M${xy[0]![0].toFixed(1)},${xy[0]![1].toFixed(1)}`;
  for (let i = 0; i < xy.length - 1; i++) {
    const [x0, y0] = xy[i]!;
    const [x1, y1] = xy[i + 1]!;
    const dx = (x1 - x0) / 3;
    const prev = xy[i - 1] ?? xy[i]!;
    const next = xy[i + 2] ?? xy[i + 1]!;
    const s0 = (y1 - prev[1]) / (x1 - prev[0] || 1);
    const s1 = (next[1] - y0) / (next[0] - x0 || 1);
    const lo = Math.min(y0, y1);
    const hi = Math.max(y0, y1);
    const c0 = Math.min(hi, Math.max(lo, y0 + s0 * dx));
    const c1 = Math.min(hi, Math.max(lo, y1 - s1 * dx));
    d += ` C${(x0 + dx).toFixed(1)},${c0.toFixed(1)} ${(x1 - dx).toFixed(1)},${c1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
  }
  return d;
}

export function BalanceChart({ points, label, tooFew, height = 200, className }: BalanceChartProps) {
  const [ref, width] = useWidth<HTMLElement>(640);
  const gradient = useId().replace(/:/g, '');
  if (points.length < 2) {
    return (
      <p className={cx('rounded-lg bg-surface-strong p-md text-sm text-text-muted', className)} data-testid="balance-chart-empty">
        {tooFew}
      </p>
    );
  }
  const W = Math.max(280, width);
  const H = height;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || Math.abs(max) || 1;
  const lo = min - span * 0.08;
  const hi = max + span * 0.08;
  const x = (i: number) => LEFT + (i * (W - LEFT - 4)) / (points.length - 1);
  const y = (v: number) => PAD_Y + ((hi - v) * (H - 2 * PAD_Y)) / (hi - lo);
  const xy = points.map((p, i) => [x(i), y(p.value)] as [number, number]);
  const line = smooth(xy);
  const base = min < 0 && max > 0 ? y(0) : H - PAD_Y;
  const area = `${line} L${x(points.length - 1).toFixed(1)},${base.toFixed(1)} L${x(0).toFixed(1)},${base.toFixed(1)} Z`;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const rising = last.value >= first.value;
  const [lx, ly] = xy[xy.length - 1]!;

  return (
    <figure ref={ref} className={cx('m-0 flex min-w-0 flex-col gap-xs', className)} data-testid="balance-chart">
      <svg
        role="img"
        aria-label={`${label}: ${formatMonthYear(first.month)} ${formatMoney(first.value)}, ${formatMonthYear(last.month)} ${formatMoney(last.value)}`}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        className={cx('block h-auto w-full text-xs', rising ? 'text-positive' : 'text-negative')}
      >
        <defs>
          <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity={0.28} />
            <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
          </linearGradient>
        </defs>
        {[max, min].map((v, i) => (
          <g key={i}>
            <line x1={LEFT} x2={W} y1={y(v)} y2={y(v)} className="stroke-chart-grid" strokeDasharray="3 4" />
            <text x={LEFT - 8} y={y(v) + 4} textAnchor="end" className="fill-text-muted tabular-nums">
              {formatMoney(v, { compact: true })}
            </text>
          </g>
        ))}
        {min < 0 && max > 0 && <line x1={LEFT} x2={W} y1={y(0)} y2={y(0)} className="stroke-text-muted" />}
        <path d={area} fill={`url(#${gradient})`} className={MOTION.fade} />
        <path d={line} pathLength={1} fill="none" className={cx('stroke-current', MOTION.draw)} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={lx} cy={ly} r={5} className={cx('fill-surface stroke-current', MOTION.fade)} strokeWidth={3} />
      </svg>
      <figcaption className="flex justify-between text-xs text-text-muted" style={{ paddingLeft: LEFT }}>
        <span>{formatMonthYear(first.month)}</span>
        <span>{formatMonthYear(last.month)}</span>
      </figcaption>
    </figure>
  );
}
