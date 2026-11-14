// A small line chart of month-end balances (net worth on Accounts, one balance on Account detail).
// Inline SVG, no axes: the first and last month sit under the line. Presentational: the points come
// from the view-model; only the drawing scale is worked out here.
import { cx, formatMoney, formatMonthYear } from '@/ui-kit';
import type { BalancePointVM } from '../model/types';

export type BalanceChartProps = {
  points: BalancePointVM[];
  /** Accessible name of the chart. */
  label: string;
  /** Shown instead of the line when there are fewer than two points. */
  tooFew: string;
  className?: string;
};

const W = 320;
const H = 96;
const PAD = 6;

export function BalanceChart({ points, label, tooFew, className }: BalanceChartProps) {
  if (points.length < 2) {
    return (
      <p className={cx('rounded-lg bg-surface-strong p-md text-sm text-text-muted', className)} data-testid="balance-chart-empty">
        {tooFew}
      </p>
    );
  }
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => PAD + (i * (W - 2 * PAD)) / (points.length - 1);
  const y = (v: number) => PAD + ((max - v) * (H - 2 * PAD)) / span;
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`;
  const zeroY = min < 0 && max > 0 ? y(0) : null;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const rising = last.value >= first.value;

  return (
    <figure className={cx('flex min-w-0 flex-col gap-xs', className)} data-testid="balance-chart">
      <svg
        role="img"
        aria-label={`${label}: ${formatMonthYear(first.month)} ${formatMoney(first.value)}, ${formatMonthYear(last.month)} ${formatMoney(last.value)}`}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className={cx('h-24 w-full', rising ? 'text-positive' : 'text-negative')}
      >
        <path d={area} className="fill-current opacity-10" />
        {zeroY !== null && <line x1={0} x2={W} y1={zeroY} y2={zeroY} className="stroke-chart-grid" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />}
        <path d={line} fill="none" className="stroke-current" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <circle cx={x(points.length - 1)} cy={y(last.value)} r={3.5} className="fill-current" />
      </svg>
      <figcaption className="flex justify-between text-xs text-text-muted">
        <span>{formatMonthYear(first.month)}</span>
        <span>{formatMonthYear(last.month)}</span>
      </figcaption>
    </figure>
  );
}
