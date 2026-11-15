'use client';

// Two net worth lines over the years (keep vs the alternative), inline SVG in real pixels at the card's
// width: light gridlines with compact dollar ticks on the left, the years under it, both lines drawn in
// on first paint, a dot and a direct label at each line's end, and the gap at the end as a bracket.
// Presentational: the points come from the view-model; only the drawing scale is worked out here.
// A visually hidden table carries the same numbers for screen readers.
import { cx, formatMoney } from '@/ui-kit';
import { MOTION, TONE_FILL, TONE_STROKE, TONE_TEXT, useWidth, type ChartTone } from '@/ui-kit/reports';

export type TwoLineSeries = { id: string; label: string; tone: ChartTone; values: number[] };

type Props = {
  years: number[];
  series: [TwoLineSeries, TwoLineSeries];
  label: string;
  yearHeader: string;
  height?: number;
};

const TOP = 16;
const BOTTOM = 26;
const LEFT = 52;

/** 3–5 round tick values covering [lo, hi]. */
function ticks(lo: number, hi: number): number[] {
  const span = hi - lo || Math.abs(hi) || 1;
  const raw = span / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const out: number[] = [];
  for (let v = Math.floor(lo / step) * step; v <= hi + step * 0.001; v += step) out.push(v);
  return out;
}

export function TwoLineChart({ years, series, label, yearHeader, height = 240 }: Props) {
  const [ref, width] = useWidth<HTMLElement>(640);
  const W = Math.max(280, width);
  const H = height;
  const right = W < 480 ? 64 : 84; // room for the end labels
  const all = series.flatMap((s) => s.values);
  const t = ticks(Math.min(0, ...all), Math.max(...all));
  const lo = t[0]!;
  const hi = t[t.length - 1]!;
  const x = (i: number) => LEFT + (i * (W - LEFT - right)) / Math.max(1, years.length - 1);
  const y = (v: number) => TOP + ((hi - v) * (H - TOP - BOTTOM)) / (hi - lo || 1);
  const path = (values: number[]) => values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  const lastX = x(years.length - 1);
  const ends = series.map((s) => y(s.values[s.values.length - 1]!));
  // Keep the two end labels at least 16px apart.
  const [a, b] = ends as [number, number];
  const gap = 16;
  const labelY = Math.abs(a - b) >= gap ? [a, b] : a <= b ? [(a + b) / 2 - gap / 2, (a + b) / 2 + gap / 2] : [(a + b) / 2 + gap / 2, (a + b) / 2 - gap / 2];
  const yearLabels = years.length > 6 ? [0, Math.round((years.length - 1) / 2), years.length - 1] : years.map((_, i) => i);

  return (
    <figure ref={ref} className="m-0 min-w-0" data-testid="decide-chart">
      <svg role="img" aria-label={label} viewBox={`0 0 ${W} ${H}`} width="100%" height={H} className="block h-auto w-full text-xs">
        {t.map((v) => (
          <g key={v}>
            <line x1={LEFT} x2={W - right + 8} y1={y(v)} y2={y(v)} className={v === 0 ? 'stroke-text-muted' : 'stroke-chart-grid'} strokeDasharray={v === 0 ? undefined : '3 4'} />
            <text x={LEFT - 8} y={y(v) + 4} textAnchor="end" className="fill-text-muted tabular-nums">
              {formatMoney(v, { compact: true })}
            </text>
          </g>
        ))}
        {yearLabels.map((i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === years.length - 1 ? 'end' : 'middle'} className="fill-text-muted tabular-nums">
            {years[i]}
          </text>
        ))}
        {series.map((s, si) => (
          <g key={s.id} data-series={s.id}>
            <path
              d={path(s.values)}
              pathLength={1}
              fill="none"
              className={cx(TONE_STROKE[s.tone], MOTION.draw)}
              style={si === 1 ? { transitionDelay: '150ms' } : undefined}
              strokeWidth={3}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <circle cx={lastX} cy={ends[si]} r={5} className={cx('fill-surface', TONE_STROKE[s.tone], MOTION.fade)} strokeWidth={3} />
            <text x={lastX + 10} y={labelY[si]! + 4} className={cx('font-bold tabular-nums', TONE_FILL[s.tone], MOTION.fade)}>
              {formatMoney(s.values[s.values.length - 1]!, { compact: true })}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="mt-sm flex flex-wrap gap-x-lg gap-y-xs text-sm">
        {series.map((s) => (
          <span key={s.id} className="inline-flex items-center gap-xs">
            <span aria-hidden="true" className={cx('h-1 w-4 rounded-full', TONE_TEXT[s.tone], 'bg-current')} />
            {s.label}
          </span>
        ))}
      </figcaption>
      <table className="sr-only">
        <thead>
          <tr>
            <th scope="col">{yearHeader}</th>
            {series.map((s) => (
              <th key={s.id} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {years.map((yr, i) => (
            <tr key={yr}>
              <th scope="row">{yr}</th>
              {series.map((s) => (
                <td key={s.id}>{formatMoney(s.values[i]!)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
