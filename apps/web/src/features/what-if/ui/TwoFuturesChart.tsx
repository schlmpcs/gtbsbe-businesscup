'use client';

// The two-futures chart: two net-worth lines leaving "today" together and drifting apart, each with
// its range band, a dashed goal line, ticks where a later change starts, end labels and a year
// scrubber. Hand-drawn SVG from the view-model's points: the only math here is scaling to pixels.
import { useEffect, useId, useRef, useState } from 'react';
import { whatIf as t } from '@/copy';
import { cx, formatMoney } from '@/ui-kit';
import type { ChartPointVM, ChartSideVM, ChartVM, Letter } from '../model/types';

export type TwoFuturesChartProps = {
  chart: ChartVM;
  /** Show the year scrubber (default true; the hero hides it). */
  scrubber?: boolean;
  /** Visual size: 'lg' on the page, 'md' in the hero. */
  size?: 'md' | 'lg';
  className?: string;
};

export const SIDE_COLOR: Record<Letter, string> = { A: 'var(--color-ink)', B: 'var(--color-primary)' };
const MUTED = 'var(--color-text-muted)';
const GRID = 'var(--color-chart-grid)';

const compact = (n: number) => formatMoney(n, { compact: true });

/** Width of the element, kept up to date (the SVG is drawn in real pixels so text stays legible). */
function useWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth || fallback);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry!.contentRect.width) || fallback));
    ro.observe(el);
    return () => ro.disconnect();
  }, [fallback]);
  return [ref, width] as const;
}

const linePath = (pts: readonly ChartPointVM[], x: (m: number) => number, y: (v: number) => number) =>
  pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.month).toFixed(1)},${y(p.mid).toFixed(1)}`).join('');

const bandPath = (pts: readonly ChartPointVM[], x: (m: number) => number, y: (v: number) => number) => {
  const top = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.month).toFixed(1)},${y(p.high).toFixed(1)}`).join('');
  const bottom = [...pts].reverse().map((p) => `L${x(p.month).toFixed(1)},${y(p.low).toFixed(1)}`).join('');
  return `${top}${bottom}Z`;
};

const STYLE = `
@keyframes wf-draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
@keyframes wf-fade { from { opacity: 0; } to { opacity: 1; } }
.wf-line { stroke-dasharray: 1; stroke-dashoffset: 0; animation: wf-draw 1.1s cubic-bezier(.22,.8,.3,1) both; }
.wf-line-b { animation-delay: .12s; }
.wf-band { animation: wf-fade .9s ease-out both; }
.wf-late { animation: wf-fade .5s ease-out 1s both; }
.wf-scrub { transition: transform .18s ease-out; }
@media (prefers-reduced-motion: reduce) { .wf-line, .wf-band, .wf-late { animation: none; } .wf-scrub { transition: none; } }
`;

export function TwoFuturesChart({ chart, scrubber = true, size = 'lg', className }: TwoFuturesChartProps) {
  const [box, width] = useWidth<HTMLDivElement>(640);
  const [year, setYear] = useState(chart.years);
  const titleId = useId();
  const sliderId = useId();

  const narrow = width < 520;
  const height = Math.round(Math.min(size === 'lg' ? 380 : 300, Math.max(220, width * (narrow ? 0.72 : 0.5))));
  const pad = { top: 20, right: narrow ? 70 : 96, bottom: 30, left: 4 };
  const horizon = chart.years * 12;
  const plotW = Math.max(10, width - pad.left - pad.right);
  const plotH = height - pad.top - pad.bottom;
  const { min, max } = chart.domain;
  // Rounded to 0.1px: the same picture on the server and in the browser (no hydration drift).
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const x = (month: number) => r1(pad.left + (month / horizon) * plotW);
  const y = (v: number) => r1(pad.top + (1 - (v - min) / (max - min || 1)) * plotH);

  // End labels: keep them at least 34px apart so neither hides the other.
  const endA = y(chart.A.end.mid);
  const endB = y(chart.B.end.mid);
  const gap = 34;
  let labelA = endA;
  let labelB = endB;
  if (Math.abs(endA - endB) < gap) {
    const mid = (endA + endB) / 2;
    const aAbove = endA < endB || (endA === endB && chart.A.end.mid >= chart.B.end.mid);
    labelA = mid + (aAbove ? -gap / 2 : gap / 2);
    labelB = mid + (aAbove ? gap / 2 : -gap / 2);
  }
  const clampLabel = (v: number) => r1(Math.min(height - pad.bottom - 8, Math.max(pad.top + 8, v)));

  const scrubYear = Math.min(year, chart.years);
  const at = (s: ChartSideVM) => s.yearly[scrubYear] ?? s.end;
  const sx = x(scrubYear * 12);
  const showScrub = scrubber && scrubYear < chart.years;
  const yearsShown = Array.from({ length: chart.years + 1 }, (_, i) => i).filter((i) => !narrow || i % 2 === 0);

  const side = (s: ChartSideVM, labelY: number) => {
    const color = SIDE_COLOR[s.letter];
    const behind = s.verdict === 'behind';
    return (
      <g key={`end-${s.letter}`} className="wf-late">
        <circle cx={x(horizon)} cy={y(s.end.mid)} r={6} fill={color} stroke="var(--color-surface)" strokeWidth={2.5} />
        <text x={x(horizon) + 12} y={clampLabel(labelY)} dy="0.1em" className="font-display" fontSize={narrow ? 15 : 18} fontWeight={800} fill={s.end.mid < 0 ? MUTED : color}>
          {s.letter} {compact(s.end.mid)}
        </text>
        {s.verdict && (
          <text x={x(horizon) + 12} y={clampLabel(labelY) + (narrow ? 14 : 16)} fontSize={narrow ? 10.5 : 12} fontWeight={600} fill={behind ? MUTED : color}>
            {t.chart.verdict[s.verdict]}
          </text>
        )}
      </g>
    );
  };

  return (
    <figure aria-labelledby={titleId} className={cx('flex w-full min-w-0 flex-col gap-md', className)}>
      <figcaption id={titleId} className="sr-only">
        {t.chart.title}
      </figcaption>
      <style>{STYLE}</style>
      <div ref={box} className="w-full min-w-0">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`${t.chart.title}. ${t.choiceLabel('A')}: ${compact(chart.A.end.mid)}. ${t.choiceLabel('B')}: ${compact(chart.B.end.mid)}.`}
          className="block overflow-visible"
        >
          {/* grid + y ticks */}
          {chart.ticks.map((v) => (
            <g key={`tick-${v}`}>
              <line x1={pad.left} x2={pad.left + plotW} y1={y(v)} y2={y(v)} stroke={GRID} strokeWidth={v === 0 ? 1.5 : 1} />
              <text x={pad.left + 2} y={y(v) - 5} fontSize={11} fill={MUTED} className="tabular-nums">
                {compact(v)}
              </text>
            </g>
          ))}
          {/* x labels */}
          {yearsShown.map((i) => (
            <text
              key={`x-${i}`}
              x={x(i * 12)}
              y={height - 8}
              fontSize={11}
              fill={MUTED}
              textAnchor={i === 0 ? 'start' : i === chart.years ? 'end' : 'middle'}
            >
              {t.chart.yearTick(i)}
            </text>
          ))}

          <g key={chart.key}>
            <path className="wf-band" d={bandPath(chart.A.points, x, y)} fill={SIDE_COLOR.A} fillOpacity={0.07} />
            <path className="wf-band" d={bandPath(chart.B.points, x, y)} fill={SIDE_COLOR.B} fillOpacity={0.14} />

            {chart.goal && (
              <g className="wf-late">
                <line
                  x1={pad.left}
                  x2={x(chart.goal.years * 12)}
                  y1={y(chart.goal.target)}
                  y2={y(chart.goal.target)}
                  stroke={MUTED}
                  strokeWidth={1.5}
                  strokeDasharray="6 5"
                />
                <text x={x(chart.goal.years * 12) - 4} y={y(chart.goal.target) - 6} fontSize={11.5} fontWeight={700} fill={MUTED} textAnchor="end">
                  {t.chart.goal(compact(chart.goal.target))}
                </text>
              </g>
            )}

            {chart.markers.map((m) => (
              <g key={`m-${m.letter}-${m.month}`} className="wf-late">
                <line x1={x(m.month)} x2={x(m.month)} y1={pad.top} y2={height - pad.bottom} stroke={SIDE_COLOR[m.letter]} strokeOpacity={0.35} strokeWidth={1.5} strokeDasharray="2 4" />
                <rect x={x(m.month) - 30} y={height - pad.bottom - 22} width={60} height={18} rx={9} fill={SIDE_COLOR[m.letter]} />
                <text x={x(m.month)} y={height - pad.bottom - 9} fontSize={10.5} fontWeight={700} fill="var(--color-on-primary)" textAnchor="middle">
                  {t.chart.starts(m.letter)}
                </text>
              </g>
            ))}

            <path className="wf-line" pathLength={1} d={linePath(chart.A.points, x, y)} fill="none" stroke={SIDE_COLOR.A} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
            <path className="wf-line wf-line-b" pathLength={1} d={linePath(chart.B.points, x, y)} fill="none" stroke={SIDE_COLOR.B} strokeWidth={3.5} strokeLinejoin="round" strokeLinecap="round" />

            {/* today: where both futures start */}
            <circle cx={x(0)} cy={y(chart.A.points[0]!.mid)} r={5} fill="var(--color-surface)" stroke={SIDE_COLOR.A} strokeWidth={2.5} />

            {side(chart.A, labelA)}
            {side(chart.B, labelB)}
          </g>

          {showScrub && (
            <g className="wf-scrub" style={{ transform: `translateX(${sx}px)` }}>
              <line x1={0} x2={0} y1={pad.top} y2={height - pad.bottom} stroke="var(--color-text)" strokeOpacity={0.25} strokeWidth={1.5} />
              {(['A', 'B'] as const).map((l) => (
                <circle key={l} cx={0} cy={y(at(chart[l]).mid)} r={5} fill={SIDE_COLOR[l]} stroke="var(--color-surface)" strokeWidth={2} />
              ))}
            </g>
          )}
        </svg>
      </div>

      {scrubber && (
        <div className="flex flex-col gap-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-x-lg gap-y-xs">
            <label htmlFor={sliderId} className="text-sm font-semibold text-text">
              {t.chart.scrubYear(scrubYear)}
            </label>
            <p className="flex items-baseline gap-lg tabular-nums" aria-live="polite">
              {(['A', 'B'] as const).map((l) => (
                <span key={l} className="flex items-baseline gap-xs">
                  <span className="text-sm font-bold" style={{ color: SIDE_COLOR[l] }}>
                    {l}
                  </span>
                  <span className="font-display text-xl font-extrabold" style={{ color: SIDE_COLOR[l] }}>
                    {compact(at(chart[l]).mid)}
                  </span>
                </span>
              ))}
            </p>
          </div>
          <input
            id={sliderId}
            type="range"
            min={0}
            max={chart.years}
            step={1}
            value={scrubYear}
            onChange={(e) => setYear(Number(e.target.value))}
            aria-valuetext={t.chart.scrubYear(scrubYear)}
            className="w-full accent-[var(--color-primary)]"
          />
        </div>
      )}
    </figure>
  );
}
