// The dashboard's small charts: inline SVG, no axes library. Presentational: every value comes from the
// view-model; only the drawing scale (value → pixel) is worked out here. Motion is CSS only (see
// ./DashboardMotion.tsx): lines are revealed left to right, bars grow, rings fill; all of it is off
// under prefers-reduced-motion, where the final state shows at once.
import type { CSSProperties, ReactNode } from 'react';
import { cx } from '@/ui-kit';

export type LinePoint = { x: number; y: number | null };

export type LineSeries = {
  id: string;
  points: readonly LinePoint[];
  /** A text-* color class; the line and area use currentColor. */
  colorClass: string;
  dashed?: boolean;
  /** Fill under the line (light). */
  area?: boolean;
  /** A dot on the last non-null point. */
  endDot?: boolean;
};

export type LineChartProps = {
  series: readonly LineSeries[];
  /** Accessible summary of what the chart shows. */
  label: string;
  /** x range; defaults to the points' own. */
  xDomain?: [number, number];
  /** Extra values the y range must include (e.g. 0). */
  yInclude?: readonly number[];
  /** A dashed vertical guide at this x (e.g. the retirement age), with a short label. */
  guide?: { x: number; label: string };
  /** Under the chart: left, middle and right labels. */
  xLabels?: readonly ReactNode[];
  /** Top and bottom value labels, shown at the left edge. */
  yLabels?: { top: ReactNode; bottom: ReactNode };
  heightClass?: string;
  className?: string;
};

const W = 320;
const H = 120;
const PAD_Y = 8;

/** A line chart scaled to its box (no text inside the SVG, so it reads the same at any width). */
export function LineChart({ series, label, xDomain, yInclude = [], guide, xLabels, yLabels, heightClass = 'h-32', className }: LineChartProps) {
  const xs = series.flatMap((s) => s.points.map((p) => p.x));
  const ys = [...series.flatMap((s) => s.points.flatMap((p) => (p.y === null ? [] : [p.y]))), ...yInclude];
  const [x0, x1] = xDomain ?? [Math.min(...xs), Math.max(...xs)];
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const xSpan = x1 - x0 || 1;
  const ySpan = y1 - y0 || 1;
  const px = (x: number) => ((x - x0) * W) / xSpan;
  const py = (y: number) => PAD_Y + ((y1 - y) * (H - 2 * PAD_Y)) / ySpan;
  const zeroY = y0 < 0 && y1 > 0 ? py(0) : null;

  const paths = series.map((s) => {
    const pts = s.points.filter((p): p is { x: number; y: number } => p.y !== null);
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`).join(' ');
    const first = pts[0];
    const last = pts.at(-1);
    const area = first && last ? `${line} L${px(last.x).toFixed(1)},${H} L${px(first.x).toFixed(1)},${H} Z` : '';
    return { s, line, area, last };
  });

  return (
    <figure className={cx('flex min-w-0 flex-col gap-xs', className)}>
      <div className="relative">
        {yLabels && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 flex flex-col justify-between text-xs tabular-nums text-text-muted">
            <span className="rounded-sm bg-surface/80 px-xs">{yLabels.top}</span>
            <span className="rounded-sm bg-surface/80 px-xs">{yLabels.bottom}</span>
          </div>
        )}
        <div className="dash-reveal relative">
          <svg role="img" aria-label={label} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={cx('block w-full overflow-visible', heightClass)}>
            {zeroY !== null && (
              <line x1={0} x2={W} y1={zeroY} y2={zeroY} className="stroke-chart-grid" strokeWidth={1.5} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
            )}
            {guide && guide.x >= x0 && guide.x <= x1 && (
              <line x1={px(guide.x)} x2={px(guide.x)} y1={0} y2={H} className="stroke-text-muted" strokeWidth={1} strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
            )}
            {paths.map(({ s, area }) => s.area && area && <path key={`${s.id}-area`} d={area} className={cx('fill-current opacity-10', s.colorClass)} />)}
            {paths.map(({ s, line }) => (
              <path
                key={s.id}
                d={line}
                fill="none"
                className={cx('stroke-current', s.colorClass)}
                strokeWidth={s.dashed ? 2 : 2.5}
                strokeDasharray={s.dashed ? '5 5' : undefined}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
          {/* End dots in HTML so they stay round on a stretched SVG. */}
          {paths.map(({ s, last }) =>
            s.endDot && last ? (
              <span
                key={`${s.id}-dot`}
                aria-hidden="true"
                className={cx('absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current ring-2 ring-surface', s.colorClass)}
                style={{ left: `${(px(last.x) / W) * 100}%`, top: `${(py(last.y) / H) * 100}%` }}
              />
            ) : null,
          )}
        </div>
        {guide && guide.x >= x0 && guide.x <= x1 && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-sm bg-surface px-xs text-xs font-medium text-text-muted"
            style={{ left: `${(px(guide.x) / W) * 100}%` }}
          >
            {guide.label}
          </span>
        )}
      </div>
      {xLabels && xLabels.length > 0 && (
        <figcaption className="flex justify-between gap-sm text-xs tabular-nums text-text-muted" aria-hidden="true">
          {xLabels.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </figcaption>
      )}
    </figure>
  );
}

export type RingProps = {
  /** 0..1 (clamped). */
  value: number;
  /** In the middle (e.g. "3/6"). */
  children?: ReactNode;
  size?: number;
  colorClass?: string;
  className?: string;
};

/** A progress ring; the fill grows in. Decorative: give the text next to it the meaning. */
export function Ring({ value, children, size = 64, colorClass = 'text-primary', className }: RingProps) {
  const share = Math.min(1, Math.max(0, value));
  return (
    <div className={cx('relative inline-grid shrink-0 place-items-center', className)} style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 40 40" className="absolute inset-0 size-full -rotate-90">
        <circle cx={20} cy={20} r={16} fill="none" className="stroke-surface-strong" strokeWidth={5} />
        <circle
          cx={20}
          cy={20}
          r={16}
          fill="none"
          pathLength={100}
          strokeDasharray="100 100"
          strokeDashoffset={100 - share * 100}
          strokeLinecap="round"
          strokeWidth={5}
          className={cx('dash-ring stroke-current', colorClass)}
        />
      </svg>
      <span className="relative font-display text-sm font-bold tabular-nums">{children}</span>
    </div>
  );
}

export type ArcGaugeProps = {
  /** 0..1 (clamped). */
  value: number;
  colorClass: string;
  /** Big text under the arc's middle. */
  children?: ReactNode;
  className?: string;
};

/** A half-circle meter that fills from the left (the Chance of success dial). Decorative: the caller labels it. */
export function ArcGauge({ value, colorClass, children, className }: ArcGaugeProps) {
  const share = Math.min(1, Math.max(0, value));
  const d = 'M 6 46 A 40 40 0 0 1 86 46';
  return (
    <div className={cx('relative w-full max-w-48', className)}>
      <svg viewBox="0 0 92 50" className="block w-full" aria-hidden="true">
        <path d={d} fill="none" className="stroke-surface-strong" strokeWidth={9} strokeLinecap="round" />
        <path
          d={d}
          fill="none"
          pathLength={100}
          strokeDasharray="100 100"
          strokeDashoffset={100 - share * 100}
          strokeWidth={9}
          strokeLinecap="round"
          className={cx('dash-ring stroke-current', colorClass)}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">{children}</div>
    </div>
  );
}

export type MeterBarProps = {
  /** 0 or more; the fill is clamped to the track, more than 1 reads as over. */
  value: number;
  /** A bg-* class for the fill. */
  fillClass: string;
  /** 0..1: a thin marker across the track (e.g. how far into the month today is). */
  marker?: number;
  className?: string;
  /** Delay the grow animation (ms), so a list grows one bar after another. */
  delayMs?: number;
};

/** A horizontal bar that grows in from the left. Decorative: the text next to it carries the numbers. */
export function MeterBar({ value, fillClass, marker, className, delayMs = 0 }: MeterBarProps) {
  const share = Math.min(1, Math.max(0, value));
  const style: CSSProperties = { width: `${share * 100}%`, animationDelay: `${delayMs}ms` };
  return (
    <div className={cx('relative h-2.5 w-full overflow-hidden rounded-full bg-surface-strong', className)} aria-hidden="true">
      <div className={cx('dash-grow h-full rounded-full', fillClass)} style={style} />
      {marker !== undefined && (
        <div className="absolute inset-y-0 w-0.5 bg-text" style={{ left: `${Math.min(1, Math.max(0, marker)) * 100}%` }} />
      )}
    </div>
  );
}
