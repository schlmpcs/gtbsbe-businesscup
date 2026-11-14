'use client';

// The only file that touches the chart library. Restyling or swapping Recharts stays local to it.
import { useId, useSyncExternalStore, type ReactNode } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import { common } from '@/copy';
import { cx } from './cx';
import { formatMoney } from './format';

/** One month of a projection. Matches ForecastPoint from @lifeguessr/types (month 0 = now). */
export type ForecastChartPoint = { month: number; low: number; mid: number; high: number };

export type ForecastChartSeries = {
  /** Legend and table name, e.g. "Your plan" / "With the car". */
  label: string;
  points: readonly ForecastChartPoint[];
};

export type ForecastChartProps = {
  /** Chart title; also the figure's accessible name. */
  title: ReactNode;
  /** Visually hide the title (it still names the chart for screen readers). */
  hideTitle?: boolean;
  /** The main projection: a mid line with a low–high band. */
  series: ForecastChartSeries;
  /** Optional second projection for comparisons (dashed, own band). */
  compare?: ForecastChartSeries;
  /** Draw the low–high bands (default true). */
  showBand?: boolean;
  /** What the band means, as the legend names it (default: the range from the numbers we estimated). */
  bandLabel?: string;
  /** Formats y values, tooltip and table cells (default compact dollars: $48K). */
  formatValue?: (value: number) => string;
  /** Small print under the chart (e.g. "In today's dollars"). */
  footnote?: ReactNode;
  className?: string;
};

type Row = {
  year: number;
  month: number;
  mid?: number;
  band?: [number, number];
  cMid?: number;
  cBand?: [number, number];
};

const MAIN = 'var(--color-chart-1)';
const COMPARE = 'var(--color-chart-2)';
const MUTED = 'var(--color-text-muted)';
const GRID = 'var(--color-chart-grid)';

const defaultFormat = (n: number) => formatMoney(n, { compact: true });

// Months → years is a unit change for the x axis, not finance math.
const yearsOf = (month: number) => month / 12;

function mergeRows(series: ForecastChartSeries, compare?: ForecastChartSeries): Row[] {
  const rows = new Map<number, Row>();
  const row = (month: number) => {
    let r = rows.get(month);
    if (!r) {
      r = { month, year: yearsOf(month) };
      rows.set(month, r);
    }
    return r;
  };
  for (const p of series.points) Object.assign(row(p.month), { mid: p.mid, band: [p.low, p.high] });
  for (const p of compare?.points ?? []) Object.assign(row(p.month), { cMid: p.mid, cBand: [p.low, p.high] });
  return [...rows.values()].sort((a, b) => a.month - b.month);
}

function yearTicks(maxYear: number): number[] {
  const step = maxYear <= 5 ? 1 : maxYear <= 12 ? 2 : 5;
  const ticks: number[] = [];
  for (let y = 0; y <= maxYear; y += step) ticks.push(y);
  return ticks;
}

const subscribeNothing = () => () => {};
const subscribeReducedMotion = (cb: () => void) => {
  const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  mq?.addEventListener('change', cb);
  return () => mq?.removeEventListener('change', cb);
};

function Swatch({ color, dashed = false, band = false }: { color: string; dashed?: boolean; band?: boolean }) {
  if (band) return <span aria-hidden="true" className="inline-block h-md w-xl rounded-sm bg-chart-band" />;
  return (
    <svg aria-hidden="true" viewBox="0 0 24 4" className="w-xl" preserveAspectRatio="none">
      <line x1="0" y1="2" x2="24" y2="2" stroke={color} strokeWidth="3" strokeDasharray={dashed ? '5 3' : undefined} />
    </svg>
  );
}

/** Net-worth style projection over months, drawn with a mid line and a low–high band; x axis in years. */
export function ForecastChart({
  title,
  hideTitle = false,
  series,
  compare,
  showBand = true,
  bandLabel,
  formatValue = defaultFormat,
  footnote,
  className,
}: ForecastChartProps) {
  // Render the SVG only in the browser: it needs a measured width, and SSR would only warn.
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    () => true,
  );

  const rows = mergeRows(series, compare);
  const maxMonth = rows.at(-1)?.month ?? 0;
  const maxYear = Math.max(1, Math.ceil(yearsOf(maxMonth)));
  const yearRows = rows.filter((r) => r.month % 12 === 0);
  const t = common.kit.chart;
  const titleId = useId();

  const renderTooltip = ({ active, payload }: TooltipContentProps) => {
    const r = payload?.[0]?.payload as Row | undefined;
    if (!active || !r) return null;
    const line = (label: string, mid?: number, band?: [number, number]) =>
      mid === undefined ? null : (
        <div className="flex flex-col">
          <span className="text-text-muted">{label}</span>
          <span className="font-semibold tabular-nums">{formatValue(mid)}</span>
          {band && (
            <span className="text-text-muted tabular-nums">{t.range(formatValue(band[0]), formatValue(band[1]))}</span>
          )}
        </div>
      );
    return (
      <div className="flex flex-col gap-xs rounded-md border border-border bg-bg p-sm text-xs shadow-md">
        <span className="font-semibold">{t.yearLabel(Math.round(r.year * 10) / 10)}</span>
        {line(series.label, r.mid, showBand ? r.band : undefined)}
        {compare && line(compare.label, r.cMid, showBand ? r.cBand : undefined)}
      </div>
    );
  };

  return (
    <figure aria-labelledby={titleId} className={cx('flex flex-col gap-sm', className)}>
      <figcaption id={titleId} className={cx('text-base font-semibold', hideTitle && 'sr-only')}>{title}</figcaption>

      <div aria-hidden="true" className="aspect-[4/3] w-full sm:aspect-[16/9]">
        {mounted && (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis
                dataKey="year"
                type="number"
                domain={[0, maxYear]}
                ticks={yearTicks(maxYear)}
                tickFormatter={(y: number) => t.yearTick(y)}
                tick={{ fill: MUTED, fontSize: 'var(--text-xs)' }}
                tickLine={false}
                axisLine={{ stroke: GRID }}
              />
              <YAxis
                width="auto"
                tickFormatter={(v: number) => formatValue(v)}
                tick={{ fill: MUTED, fontSize: 'var(--text-xs)' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={renderTooltip} cursor={{ stroke: GRID }} isAnimationActive={false} />
              {showBand && (
                <Area
                  dataKey="band"
                  stroke="none"
                  fill="var(--color-chart-band)"
                  isAnimationActive={!reducedMotion}
                  activeDot={false}
                  connectNulls
                />
              )}
              {showBand && compare && (
                <Area
                  dataKey="cBand"
                  stroke="none"
                  fill={COMPARE}
                  fillOpacity={0.15}
                  isAnimationActive={!reducedMotion}
                  activeDot={false}
                  connectNulls
                />
              )}
              <Line
                dataKey="mid"
                stroke={MAIN}
                strokeWidth={2.5}
                dot={false}
                isAnimationActive={!reducedMotion}
                connectNulls
              />
              {compare && (
                <Line
                  dataKey="cMid"
                  stroke={COMPARE}
                  strokeWidth={2.5}
                  strokeDasharray="6 4"
                  dot={false}
                  isAnimationActive={!reducedMotion}
                  connectNulls
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <ul aria-hidden="true" className="flex flex-wrap items-center gap-x-lg gap-y-xs text-xs text-text-muted">
        <li className="flex items-center gap-xs">
          <Swatch color={MAIN} />
          {series.label}
        </li>
        {compare && (
          <li className="flex items-center gap-xs">
            <Swatch color={COMPARE} dashed />
            {compare.label}
          </li>
        )}
        {showBand && (
          <li className="flex items-center gap-xs">
            <Swatch color={MAIN} band />
            {bandLabel ?? t.rangeLegend}
          </li>
        )}
      </ul>

      {footnote && <p className="text-xs text-text-muted">{footnote}</p>}

      {/* The same numbers as a table, for screen readers (the SVG above is hidden from them). The wrapper
          carries sr-only because a <table> ignores width/overflow and would widen the page on phones. */}
      <div className="sr-only">
        <table>
          <caption>{t.tableCaption}</caption>
          <thead>
            <tr>
              <th scope="col">{t.tableYear}</th>
              <th scope="col">{`${series.label}: ${t.tableMid}`}</th>
              {showBand && <th scope="col">{`${series.label}: ${t.tableRange}`}</th>}
              {compare && <th scope="col">{`${compare.label}: ${t.tableMid}`}</th>}
              {compare && showBand && <th scope="col">{`${compare.label}: ${t.tableRange}`}</th>}
            </tr>
          </thead>
          <tbody>
            {yearRows.map((r) => (
              <tr key={r.month}>
                <th scope="row">{t.yearLabel(r.year)}</th>
                <td>{r.mid === undefined ? '' : formatValue(r.mid)}</td>
                {showBand && <td>{r.band ? t.range(formatValue(r.band[0]), formatValue(r.band[1])) : ''}</td>}
                {compare && <td>{r.cMid === undefined ? '' : formatValue(r.cMid)}</td>}
                {compare && showBand && (
                  <td>{r.cBand ? t.range(formatValue(r.cBand[0]), formatValue(r.cBand[1])) : ''}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
