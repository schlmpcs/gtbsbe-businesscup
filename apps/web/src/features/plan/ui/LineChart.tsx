'use client';

// A small line chart for /plan (net worth, Compare, the Monte Carlo fan). Lines are drawn in an SVG that
// stretches to the box (non-scaling strokes); tick labels, markers, the crosshair and the tooltip are HTML
// placed by percent, so text stays readable at any width (390px phones included). Geometry only: every
// value it plots arrives from a view-model; it only maps values to positions and formats axis ticks.
import { useId, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { cx, formatMoney } from '@/ui-kit';

export type ChartPoint = { x: number; y: number; /** Tooltip text; defaults to compact dollars. */ label?: string };
export type ChartSeries = {
  id: string;
  label: string;
  /** A CSS color, e.g. 'var(--color-chart-1)'. */
  color: string;
  dashed?: boolean;
  points: readonly ChartPoint[];
};
export type ChartBand = { label: string; points: readonly { x: number; lo: number; hi: number }[] };
export type ChartMarker = {
  id: string;
  x: number;
  label: string;
  icon: ReactNode;
  dim?: boolean;
  onSelect?: () => void;
  /** Keyboard nudge: −1 / +1 along x. */
  onNudge?: (delta: number) => void;
};
export type ChartTick = { x: number; label: string };

export type LineChartProps = {
  /** Accessible name of the figure. */
  title: string;
  series: readonly ChartSeries[];
  band?: ChartBand;
  markers?: readonly ChartMarker[];
  xTicks: readonly ChartTick[];
  /** Axis caption under the x ticks ("Age"). */
  xCaption?: string;
  /** Tooltip header for an x value. */
  xLabel: (x: number) => string;
  /** A vertical reference line (e.g. retirement). */
  reference?: { x: number; label: string };
  /** Tailwind height class of the plot area. */
  heightClass?: string;
  footnote?: ReactNode;
  className?: string;
};

const VB = 1000;
const compact = (n: number) => formatMoney(n, { compact: true });

/** 1, 2 or 5 × 10^k: a round step that gives about `count` ticks over `span`. */
function niceStep(span: number, count: number): number {
  const raw = span / Math.max(1, count);
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  const m = raw / pow;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * pow;
}

function yScale(values: number[]) {
  let lo = Math.min(0, ...values);
  let hi = Math.max(0, ...values);
  if (hi === lo) hi = lo + 1;
  const step = niceStep(hi - lo, 4);
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.abs(v) < step / 1e6 ? 0 : v);
  return { lo, hi, ticks };
}

export function LineChart({
  title, series, band, markers = [], xTicks, xCaption, xLabel, reference, heightClass = 'h-56 sm:h-72', footnote, className,
}: LineChartProps) {
  const titleId = useId();
  const [hoverX, setHoverX] = useState<number | null>(null);

  const allX = [...series.flatMap((s) => s.points.map((p) => p.x)), ...(band?.points.map((p) => p.x) ?? [])];
  const allY = [...series.flatMap((s) => s.points.map((p) => p.y)), ...(band?.points.flatMap((p) => [p.lo, p.hi]) ?? [])];
  if (allX.length === 0) return null;
  const xMin = Math.min(...allX);
  const xMax = Math.max(...allX) === xMin ? xMin + 1 : Math.max(...allX);
  const y = yScale(allY);

  const fx = (x: number) => (x - xMin) / (xMax - xMin); // 0–1
  const fy = (v: number) => 1 - (v - y.lo) / (y.hi - y.lo); // 0–1 from the top
  const path = (pts: readonly { x: number; y: number }[]) =>
    pts.map((p, i) => `${i ? 'L' : 'M'}${(fx(p.x) * VB).toFixed(1)},${(fy(p.y) * VB).toFixed(1)}`).join('');
  const bandPath = band
    ? `${path(band.points.map((p) => ({ x: p.x, y: p.hi })))}${[...band.points].reverse().map((p) => `L${(fx(p.x) * VB).toFixed(1)},${(fy(p.lo) * VB).toFixed(1)}`).join('')}Z`
    : null;

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

  return (
    <figure aria-labelledby={titleId} className={cx('flex min-w-0 flex-col gap-sm', className)}>
      <figcaption id={titleId} className="sr-only">{title}</figcaption>

      {(series.length > 1 || band) && (
        <ul className="flex flex-wrap gap-x-lg gap-y-xs text-xs text-text-muted" aria-label={title}>
          {series.map((s) => (
            <li key={s.id} className="flex items-center gap-xs">
              <svg aria-hidden="true" viewBox="0 0 24 4" className="w-xl" preserveAspectRatio="none">
                <line x1="0" y1="2" x2="24" y2="2" stroke={s.color} strokeWidth="3" strokeDasharray={s.dashed ? '5 3' : undefined} />
              </svg>
              <span className="text-text">{s.label}</span>
            </li>
          ))}
          {band && (
            <li className="flex items-center gap-xs">
              <span aria-hidden="true" className="inline-block h-md w-xl rounded-sm bg-chart-band" />
              <span className="text-text">{band.label}</span>
            </li>
          )}
        </ul>
      )}

      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-sm">
        {/* y tick labels */}
        <div aria-hidden="true" className={cx('relative w-12 text-right text-xs tabular-nums text-text-muted', heightClass, markers.length > 0 && 'mt-2xl')}>
          {y.ticks.map((v) => (
            <span key={v} className="absolute right-0 -translate-y-1/2 whitespace-nowrap" style={{ top: `${fy(v) * 100}%` }}>
              {compact(v)}
            </span>
          ))}
        </div>

        <div className="relative min-w-0">
          {markers.length > 0 && (
            <div className="relative h-2xl">
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
                  className={cx(
                    'absolute top-0 flex size-2xl -translate-x-1/2 items-center justify-center rounded-full border-2 border-surface bg-ink text-on-primary shadow-sm',
                    'hover:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                    m.dim && 'opacity-40',
                  )}
                  style={{ left: `${fx(m.x) * 100}%` }}
                >
                  {m.icon}
                </button>
              ))}
            </div>
          )}

          <div
            className={cx('relative touch-pan-y', heightClass)}
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setHoverX(null)}
          >
            <svg aria-hidden="true" viewBox={`0 0 ${VB} ${VB}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
              {y.ticks.map((v) => (
                <line
                  key={v}
                  x1={0} x2={VB} y1={fy(v) * VB} y2={fy(v) * VB}
                  stroke={v === 0 ? 'var(--color-text-muted)' : 'var(--color-chart-grid)'}
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {markers.map((m) => (
                <line key={m.id} x1={fx(m.x) * VB} x2={fx(m.x) * VB} y1={0} y2={VB} stroke="var(--color-chart-grid)" strokeWidth={1} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
              ))}
              {reference && (
                <line x1={fx(reference.x) * VB} x2={fx(reference.x) * VB} y1={0} y2={VB} stroke="var(--color-text-muted)" strokeWidth={1} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
              )}
              {bandPath && <path d={bandPath} fill="var(--color-chart-band)" stroke="none" />}
              {series.map((s) => (
                <path
                  key={s.id}
                  d={path(s.points)}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeDasharray={s.dashed ? '6 4' : undefined}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>

            {reference && (
              <span
                className="pointer-events-none absolute top-0 ml-xs whitespace-nowrap rounded-sm bg-surface px-xs text-xs text-text-muted"
                style={{ left: `${fx(reference.x) * 100}%`, transform: fx(reference.x) > 0.7 ? 'translateX(calc(-100% - 8px))' : undefined }}
              >
                {reference.label}
              </span>
            )}

            {hoverX !== null && hoverRows.length > 0 && (
              <>
                <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-px bg-text-muted" style={{ left: `${fx(hoverX) * 100}%` }} />
                {hoverRows.map(({ s, p }) => (
                  <span
                    key={s.id}
                    aria-hidden="true"
                    className="pointer-events-none absolute size-sm -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface"
                    style={{ left: `${fx(p.x) * 100}%`, top: `${fy(p.y) * 100}%`, background: s.color }}
                  />
                ))}
                <div
                  role="status"
                  className="pointer-events-none absolute top-sm z-10 flex min-w-36 flex-col gap-xs rounded-md border border-border bg-surface p-sm text-xs shadow-md"
                  style={fx(hoverX) > 0.55 ? { right: `${(1 - fx(hoverX)) * 100}%`, marginRight: 8 } : { left: `${fx(hoverX) * 100}%`, marginLeft: 8 }}
                >
                  <span className="font-semibold">{xLabel(hoverX)}</span>
                  {hoverRows.map(({ s, p }) => (
                    <span key={s.id} className="flex items-center justify-between gap-md">
                      <span className="flex items-center gap-xs text-text-muted">
                        <span aria-hidden="true" className="inline-block size-sm rounded-full" style={{ background: s.color }} />
                        {s.label}
                      </span>
                      <span className="font-semibold tabular-nums">{p.label ?? compact(p.y)}</span>
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
      </div>
      {footnote && <p className="text-xs text-text-muted">{footnote}</p>}
    </figure>
  );
}
