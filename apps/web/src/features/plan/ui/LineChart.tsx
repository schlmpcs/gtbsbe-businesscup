'use client';

// The SVG chart of /plan: the net worth line (with its area, red below $0 and a hatched below-zero zone),
// Compare's two lines, the Monte Carlo fan (faint sampled paths or the p10–p90 band, the median, and a
// sideways histogram of end values) and the event editor's preview. Lines are drawn in an SVG that
// stretches to the box (non-scaling strokes); tick labels, event badges, the crosshair and the tooltip
// are HTML placed by percent, so text stays readable at any width (390px phones included).
// Geometry only: every value it plots arrives from a view-model; it maps values to positions, picks
// round axis ticks and formats them. The lines draw in from the left (CSS; none with reduced motion).
import { useId, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { cx, formatMoney } from '@/ui-kit';
import { MOTION, useEntered } from './motion';

export type ChartPoint = { x: number; y: number; /** Tooltip text; defaults to compact dollars. */ label?: string };
export type ChartSeries = {
  id: string;
  label: string;
  /** A CSS color, e.g. 'var(--color-chart-1)'. */
  color: string;
  /** Stroke color below $0 (the line turns this color where it dips under zero). */
  negativeColor?: string;
  /** Fill the area between the line and $0 (soft color above, red tint below). */
  area?: boolean;
  dashed?: boolean;
  /** Thicker stroke for the hero line. */
  strong?: boolean;
  points: readonly ChartPoint[];
};
export type ChartBand = { label: string; points: readonly { x: number; lo: number; hi: number }[] };
/** Many faint lines (Monte Carlo sample paths): drawn, never in the tooltip. */
export type ChartPaths = { label: string; lines: readonly { bad?: boolean; points: readonly { x: number; y: number }[] }[] };
export type ChartMarker = {
  id: string;
  x: number;
  label: string;
  /** The badge content (a glyph). */
  icon: ReactNode;
  /** Inline style of the badge (its color). */
  badgeStyle?: CSSProperties;
  dim?: boolean;
  onSelect?: () => void;
  /** Keyboard nudge: −1 / +1 along x. */
  onNudge?: (delta: number) => void;
};
export type ChartTick = { x: number; label: string };
/** A sideways histogram at the right edge, on the chart's own y scale. */
export type ChartSideHistogram = { label: string; bins: readonly { from: number; to: number; count: number; label: string }[] };

export type LineChartProps = {
  /** Accessible name of the figure. */
  title: string;
  series: readonly ChartSeries[];
  band?: ChartBand;
  paths?: ChartPaths;
  markers?: readonly ChartMarker[];
  xTicks: readonly ChartTick[];
  /** Axis caption under the x ticks ("Year"). */
  xCaption?: string;
  /** Tooltip header for an x value. */
  xLabel: (x: number) => string;
  /** A vertical reference line (e.g. retirement). */
  reference?: { x: number; label: string };
  /** Hatch the zone below $0 and say what it means (legend text). */
  belowZeroLabel?: string;
  /** Fix the y range (values outside are clipped); defaults to the data with $0 included. */
  yDomain?: readonly [number, number];
  side?: ChartSideHistogram;
  /** Show a legend (default: when there is more than one series, a band or paths). */
  legend?: boolean;
  /** A new key replays the draw-in. */
  animateKey?: string | number;
  /** Tailwind height class of the plot area. */
  heightClass?: string;
  footnote?: ReactNode;
  className?: string;
};

const VB = 1000;
const compact = (n: number) => formatMoney(n, { compact: true });
const HATCH =
  'bg-[repeating-linear-gradient(135deg,color-mix(in_srgb,var(--color-negative)_14%,transparent)_0_2px,transparent_2px_9px)]';

/** 1, 2 or 5 × 10^k: a round step that gives about `count` ticks over `span`. */
function niceStep(span: number, count: number): number {
  const raw = span / Math.max(1, count);
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  const m = raw / pow;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * pow;
}

function yScale(lo0: number, hi0: number) {
  let lo = Math.min(0, lo0);
  let hi = Math.max(0, hi0);
  if (hi === lo) hi = lo + 1;
  const step = niceStep(hi - lo, 4);
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.abs(v) < step / 1e6 ? 0 : v);
  return { lo, hi, ticks };
}

/** Badges closer than this share of the width sit side by side instead of on top of each other. */
const NEAR = 0.04;

export function LineChart({
  title, series, band, paths, markers = [], xTicks, xCaption, xLabel, reference, belowZeroLabel, yDomain, side, legend,
  animateKey = 0, heightClass = 'h-56 sm:h-72', footnote, className,
}: LineChartProps) {
  const titleId = useId();
  const clipId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [hoverX, setHoverX] = useState<number | null>(null);
  const entered = useEntered(animateKey);

  const allX = [
    ...series.flatMap((s) => s.points.map((p) => p.x)),
    ...(band?.points.map((p) => p.x) ?? []),
    ...(paths?.lines[0]?.points.map((p) => p.x) ?? []),
  ];
  if (allX.length === 0) return null;
  const xMin = Math.min(...allX);
  const xMax = Math.max(...allX) === xMin ? xMin + 1 : Math.max(...allX);
  const yValues = [...series.flatMap((s) => s.points.map((p) => p.y)), ...(band?.points.flatMap((p) => [p.lo, p.hi]) ?? [])];
  const y = yDomain ? yScale(yDomain[0], yDomain[1]) : yScale(Math.min(...yValues), Math.max(...yValues));

  const fx = (x: number) => (x - xMin) / (xMax - xMin); // 0–1
  const fy = (v: number) => 1 - (v - y.lo) / (y.hi - y.lo); // 0–1 from the top
  const X = (x: number) => (fx(x) * VB).toFixed(1);
  const Y = (v: number) => (fy(v) * VB).toFixed(1);
  const path = (pts: readonly { x: number; y: number }[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x)},${Y(p.y)}`).join('');
  const areaPath = (pts: readonly { x: number; y: number }[]) =>
    pts.length ? `M${X(pts[0]!.x)},${Y(0)}${pts.map((p) => `L${X(p.x)},${Y(p.y)}`).join('')}L${X(pts[pts.length - 1]!.x)},${Y(0)}Z` : '';
  const bandPath = band
    ? `${path(band.points.map((p) => ({ x: p.x, y: p.hi })))}${[...band.points].reverse().map((p) => `L${X(p.x)},${Y(p.lo)}`).join('')}Z`
    : null;
  const zeroY = fy(0) * VB;
  const hasNegative = y.lo < 0;

  const xs = [...new Set(allX)].sort((a, b) => a - b);
  const nearest = (x: number) => xs.reduce((best, v) => (Math.abs(v - x) < Math.abs(best - x) ? v : best), xs[0]!);
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (r.width <= 0) return;
    setHoverX(nearest(xMin + ((e.clientX - r.left) / r.width) * (xMax - xMin)));
  };
  const hoverRows =
    hoverX === null
      ? []
      : series
          .map((s) => ({ s, p: s.points.find((p) => p.x === hoverX) }))
          .filter((r): r is { s: ChartSeries; p: ChartPoint } => r.p !== undefined);
  const hoverBand = hoverX === null ? undefined : band?.points.find((p) => p.x === hoverX);

  // Badges that share (about) a year sit side by side, centered on it.
  const sorted = [...markers].sort((a, b) => a.x - b.x);
  const offsets = new Map<string, number>();
  for (let i = 0; i < sorted.length; ) {
    let j = i + 1;
    while (j < sorted.length && fx(sorted[j]!.x) - fx(sorted[i]!.x) < NEAR) j++;
    const n = j - i;
    for (let k = i; k < j; k++) offsets.set(sorted[k]!.id, k - i - (n - 1) / 2);
    i = j;
  }

  const showLegend = legend ?? (series.length > 1 || !!band || !!paths);
  const sideMax = side ? Math.max(1, ...side.bins.map((b) => b.count)) : 1;
  const reveal = { clipPath: entered ? 'inset(0 0 0 0)' : 'inset(0 100% 0 0)' };

  return (
    <figure aria-labelledby={titleId} className={cx('flex min-w-0 flex-col gap-sm', className)}>
      <figcaption id={titleId} className="sr-only">{title}</figcaption>

      {(showLegend || belowZeroLabel) && (
        <ul className="flex flex-wrap gap-x-lg gap-y-xs text-xs text-text-muted" aria-label={title}>
          {showLegend &&
            series.map((s) => (
              <li key={s.id} className="flex items-center gap-xs">
                <svg aria-hidden="true" viewBox="0 0 24 4" className="w-xl" preserveAspectRatio="none">
                  <line x1="0" y1="2" x2="24" y2="2" stroke={s.color} strokeWidth="3" strokeDasharray={s.dashed ? '5 3' : undefined} />
                </svg>
                <span className="text-text">{s.label}</span>
              </li>
            ))}
          {showLegend && band && (
            <li className="flex items-center gap-xs">
              <span aria-hidden="true" className="inline-block h-md w-xl rounded-sm bg-chart-band" />
              <span className="text-text">{band.label}</span>
            </li>
          )}
          {showLegend && paths && (
            <li className="flex items-center gap-xs">
              <svg aria-hidden="true" viewBox="0 0 24 8" className="w-xl">
                <path d="M0 6 L8 3 L16 5 L24 1" stroke="var(--color-chart-6)" strokeWidth="1.5" fill="none" />
                <path d="M0 6 L8 5 L16 7 L24 6" stroke="var(--color-chart-6)" strokeWidth="1.5" fill="none" />
              </svg>
              <span className="text-text">{paths.label}</span>
            </li>
          )}
          {belowZeroLabel && hasNegative && (
            <li className="flex items-center gap-xs">
              <span aria-hidden="true" className={cx('inline-block h-md w-xl rounded-sm border border-negative/30', HATCH)} />
              <span className="text-text">{belowZeroLabel}</span>
            </li>
          )}
        </ul>
      )}

      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-sm">
        {/* y tick labels */}
        <div aria-hidden="true" className={cx('relative w-12 text-right text-xs tabular-nums text-text-muted', heightClass, markers.length > 0 && 'mt-3xl')}>
          {y.ticks.map((v) => (
            <span key={v} className="absolute right-0 -translate-y-1/2 whitespace-nowrap" style={{ top: `${fy(v) * 100}%` }}>
              {compact(v)}
            </span>
          ))}
        </div>

        <div className="relative min-w-0">
          {markers.length > 0 && (
            <div className="relative h-3xl">
              {markers.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={m.onSelect}
                  onKeyDown={(e: KeyboardEvent<HTMLButtonElement>) => {
                    if (!m.onNudge) return;
                    if (e.key === 'ArrowRight') { e.preventDefault(); m.onNudge(1); }
                    if (e.key === 'ArrowLeft') { e.preventDefault(); m.onNudge(-1); }
                  }}
                  aria-label={m.label}
                  title={m.label}
                  data-marker={m.id}
                  className={cx(
                    // 32px badge with a 44px hit area.
                    'absolute top-xs flex size-2xl -translate-x-1/2 items-center justify-center rounded-full text-text shadow-sm',
                    'before:absolute before:-inset-1.5 before:content-[""]',
                    'transition-transform hover:-translate-y-0.5 hover:scale-110 motion-reduce:transition-none',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                    m.dim && 'opacity-40',
                  )}
                  style={{ left: `calc(${fx(m.x) * 100}% + ${(offsets.get(m.id) ?? 0) * 34}px)`, ...m.badgeStyle }}
                >
                  {m.icon}
                </button>
              ))}
            </div>
          )}

          <div
            className={cx('relative touch-pan-y overflow-hidden', heightClass)}
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setHoverX(null)}
          >
            {belowZeroLabel && hasNegative && (
              <div aria-hidden="true" className={cx('pointer-events-none absolute inset-x-0 bottom-0', HATCH)} style={{ top: `${fy(0) * 100}%` }} />
            )}

            {/* Grid, $0 line and event / retirement lines: static. */}
            <svg aria-hidden="true" viewBox={`0 0 ${VB} ${VB}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
              {y.ticks.map((v) => (
                <line
                  key={v}
                  x1={0} x2={VB} y1={fy(v) * VB} y2={fy(v) * VB}
                  stroke={v === 0 ? 'var(--color-text-muted)' : 'var(--color-chart-grid)'}
                  strokeWidth={v === 0 ? 1.25 : 1}
                  strokeDasharray={v === 0 ? undefined : '3 4'}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {markers.map((m) => (
                <line key={m.id} x1={fx(m.x) * VB} x2={fx(m.x) * VB} y1={0} y2={VB} stroke="var(--color-text-muted)" strokeOpacity={0.35} strokeWidth={1} vectorEffect="non-scaling-stroke" />
              ))}
              {reference && (
                <line x1={fx(reference.x) * VB} x2={fx(reference.x) * VB} y1={0} y2={VB} stroke="var(--color-text)" strokeWidth={1} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
              )}
            </svg>

            {/* Data: draws in from the left. */}
            <div aria-hidden="true" className={cx('absolute inset-0 duration-1000', MOTION)} style={reveal}>
              <svg viewBox={`0 0 ${VB} ${VB}`} preserveAspectRatio="none" className="size-full overflow-visible">
                <defs>
                  <clipPath id={`${clipId}-up`}><rect x={-10} y={-10} width={VB + 20} height={Math.max(0, zeroY + 10)} /></clipPath>
                  <clipPath id={`${clipId}-down`}><rect x={-10} y={zeroY} width={VB + 20} height={Math.max(0, VB - zeroY + 10)} /></clipPath>
                </defs>
                {paths?.lines.map((l, i) => (
                  <path
                    key={i}
                    d={path(l.points)}
                    fill="none"
                    stroke={l.bad ? 'var(--color-negative)' : 'var(--color-chart-6)'}
                    strokeOpacity={l.bad ? 0.35 : 0.45}
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                {bandPath && <path d={bandPath} fill="var(--color-chart-band)" stroke="none" />}
                {series.map((s) =>
                  s.area ? (
                    <g key={`${s.id}-area`}>
                      <path d={areaPath(s.points)} fill={s.color} fillOpacity={0.12} clipPath={`url(#${clipId}-up)`} />
                      <path d={areaPath(s.points)} fill={s.negativeColor ?? s.color} fillOpacity={0.18} clipPath={`url(#${clipId}-down)`} />
                    </g>
                  ) : null,
                )}
                {series.map((s) => {
                  const common = {
                    d: path(s.points),
                    fill: 'none',
                    strokeWidth: s.strong ? 3 : 2,
                    strokeDasharray: s.dashed ? '6 4' : undefined,
                    strokeLinejoin: 'round' as const,
                    strokeLinecap: 'round' as const,
                    vectorEffect: 'non-scaling-stroke' as const,
                  };
                  return s.negativeColor ? (
                    <g key={s.id}>
                      <path {...common} stroke={s.color} clipPath={`url(#${clipId}-up)`} />
                      <path {...common} stroke={s.negativeColor} clipPath={`url(#${clipId}-down)`} />
                    </g>
                  ) : (
                    <path key={s.id} {...common} stroke={s.color} />
                  );
                })}
              </svg>
            </div>

            {reference && (
              <span
                className="pointer-events-none absolute top-xs ml-xs whitespace-nowrap rounded-sm bg-surface px-xs text-xs font-semibold text-text shadow-sm"
                style={{ left: `${fx(reference.x) * 100}%`, transform: fx(reference.x) > 0.7 ? 'translateX(calc(-100% - 8px))' : undefined }}
              >
                {reference.label}
              </span>
            )}

            {hoverX !== null && (hoverRows.length > 0 || hoverBand) && (
              <>
                <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-px bg-text-muted" style={{ left: `${fx(hoverX) * 100}%` }} />
                {hoverRows.map(({ s, p }) => (
                  <span
                    key={s.id}
                    aria-hidden="true"
                    className="pointer-events-none absolute size-sm -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface"
                    style={{ left: `${fx(p.x) * 100}%`, top: `${fy(p.y) * 100}%`, background: p.y < 0 && s.negativeColor ? s.negativeColor : s.color }}
                  />
                ))}
                <div
                  className="pointer-events-none absolute top-sm z-10 flex w-max min-w-36 max-w-[calc(100%-16px)] flex-col gap-xs rounded-md border border-border bg-surface p-sm text-xs shadow-md"
                  // Pinned to the corner away from the crosshair, so it never runs off a phone screen.
                  style={fx(hoverX) > 0.5 ? { left: 8 } : { right: 8 }}
                >
                  <span className="font-semibold">{xLabel(hoverX)}</span>
                  {hoverRows.map(({ s, p }) => (
                    <span key={s.id} className="flex items-center justify-between gap-md">
                      <span className="flex items-center gap-xs text-text-muted">
                        <span aria-hidden="true" className="inline-block size-sm rounded-full" style={{ background: s.color }} />
                        {s.label}
                      </span>
                      <span className={cx('font-semibold tabular-nums', p.y < 0 && 'text-negative')}>{p.label ?? compact(p.y)}</span>
                    </span>
                  ))}
                  {hoverBand && band && (
                    <span className="flex items-center justify-between gap-md text-text-muted">
                      <span>{band.label}</span>
                      <span className="tabular-nums">{compact(hoverBand.lo)} to {compact(hoverBand.hi)}</span>
                    </span>
                  )}
                </div>
              </>
            )}
          </div>

          {/* x tick labels: every other one hidden on phones */}
          <div aria-hidden="true" className="relative mt-xs h-md text-xs tabular-nums text-text-muted">
            {xTicks.map((t, i) => (
              <span
                key={t.x}
                className={cx('absolute top-0 -translate-x-1/2 whitespace-nowrap', i % 2 === 1 && 'hidden sm:inline')}
                style={{ left: `${fx(t.x) * 100}%` }}
              >
                {t.label}
              </span>
            ))}
          </div>
          {xCaption && <p aria-hidden="true" className="mt-sm text-center text-xs text-text-muted">{xCaption}</p>}
        </div>

        {/* Sideways histogram of end values, on the same y scale. */}
        {side ? (
          <div className={cx('relative w-10 overflow-hidden border-l border-border sm:w-16', heightClass, markers.length > 0 && 'mt-3xl')} role="list" aria-label={side.label}>
            {side.bins.map((b, i) => (
              <div
                key={`${b.from}-${b.to}`}
                role="listitem"
                aria-label={`${b.label}: ${b.count}`}
                title={`${b.label}: ${b.count}`}
                className={cx('absolute left-0 origin-left rounded-r-sm bg-primary/60', MOTION)}
                style={{
                  top: `${fy(b.to) * 100}%`,
                  height: `max(1px, calc(${(fy(b.from) - fy(b.to)) * 100}% - 1px))`,
                  width: `${(b.count / sideMax) * 100}%`,
                  transform: entered ? 'scaleX(1)' : 'scaleX(0)',
                  transitionDelay: `${300 + i * 20}ms`,
                }}
              />
            ))}
          </div>
        ) : (
          <span />
        )}
      </div>
      {footnote && <p className="text-xs text-text-muted">{footnote}</p>}
    </figure>
  );
}
