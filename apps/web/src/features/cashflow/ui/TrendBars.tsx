'use client';

// Cash Flow trend: income and expenses per period as paired columns on one scale, with the net (income -
// expenses, the view-model's `savings`) as a line across them. Laid out in real pixels at the card's
// width. Only drawing geometry here: every amount is the view-model's. Bars grow up and the net line
// draws itself on first paint (CSS, off with prefers-reduced-motion).
import { cashflow as t } from '@/copy';
import { cx, formatMoney, formatMonth } from '@/ui-kit';
import { MOTION, TONE_BG, useWidth } from '@/ui-kit/reports';
import type { CashFlowBarVM } from '../model/types';

const H = 260;
const TOP = 12;
const BOTTOM = 28; // x labels
const LEFT = 52; // y labels

export function periodLabel(bar: CashFlowBarVM, short = false): string {
  if (bar.quarter !== null) return short ? t.quarterShort(bar.quarter) : t.quarter(bar.quarter, bar.period.from.slice(0, 4));
  if (bar.period.from === bar.period.to) return short ? formatMonth(bar.period.from).slice(0, 3) : formatMonth(bar.period.from);
  return bar.period.from.slice(0, 4);
}

/** Up to five round tick values covering [min, max] (drawing only). */
function ticks(min: number, max: number): number[] {
  const span = max - min || 1;
  const raw = span / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => span / s <= 4.5) ?? 10 * pow;
  const out: number[] = [];
  const top = Math.ceil(max / step) * step;
  for (let v = Math.floor(min / step) * step; v <= top + step * 0.001; v += step) out.push(Math.round(v));
  return out;
}

export function TrendBars({ bars }: { bars: readonly CashFlowBarVM[] }) {
  const [ref, width] = useWidth<HTMLDivElement>(720);
  const W = Math.max(300, width);
  const values = bars.flatMap((b) => [b.income, b.expenses, b.savings]);
  const tickValues = ticks(Math.min(0, ...values), Math.max(1, ...values));
  const lo = tickValues[0]!;
  const hi = tickValues[tickValues.length - 1]!;
  const plotH = H - TOP - BOTTOM;
  const y = (v: number) => TOP + ((hi - v) / (hi - lo || 1)) * plotH;
  const slot = (W - LEFT) / bars.length;
  const barW = Math.max(8, Math.min(36, slot * 0.28));
  const cx0 = (i: number) => LEFT + slot * i + slot / 2;
  const short = W < 560;
  const netPath = bars.map((b, i) => `${i === 0 ? 'M' : 'L'}${cx0(i).toFixed(1)},${y(b.savings).toFixed(1)}`).join(' ');

  return (
    <div ref={ref} className="flex w-full min-w-0 flex-col gap-md">
      <ul className="flex flex-wrap gap-x-lg gap-y-xs text-xs text-text-muted" aria-hidden="true">
        <li className="flex items-center gap-xs">
          <span className={cx('size-2.5 rounded-sm', TONE_BG.positive)} />
          {t.barsLegend.income}
        </li>
        <li className="flex items-center gap-xs">
          <span className={cx('size-2.5 rounded-sm', TONE_BG.c2)} />
          {t.barsLegend.expenses}
        </li>
        <li className="flex items-center gap-xs">
          <span className="h-0.5 w-4 rounded-full bg-ink" />
          {t.barsLegend.net}
        </li>
      </ul>
      <svg role="img" aria-label={t.barsLabel} viewBox={`0 0 ${W} ${H}`} width="100%" height={H} className="block h-auto w-full text-xs">
        {tickValues.map((v) => (
          <g key={v}>
            <line x1={LEFT} x2={W} y1={y(v)} y2={y(v)} className={v === 0 ? 'stroke-text-muted' : 'stroke-chart-grid'} strokeDasharray={v === 0 ? undefined : '3 4'} />
            <text x={LEFT - 8} y={y(v) + 4} textAnchor="end" className="fill-text-muted tabular-nums">
              {formatMoney(v, { compact: true })}
            </text>
          </g>
        ))}
        {bars.map((b, i) => {
          const c = cx0(i);
          const y0 = y(0);
          return (
            <g key={b.period.from} data-testid="cashflow-bar">
              <title>{t.barsRow(periodLabel(b), formatMoney(b.income), formatMoney(b.expenses), formatMoney(b.savings))}</title>
              {b.isCurrent && <rect x={c - slot / 2 + 4} y={TOP} width={slot - 8} height={plotH} rx={10} className="fill-surface-strong opacity-60" />}
              <rect
                x={c - barW - 2}
                y={y(b.income)}
                width={barW}
                height={Math.max(0, y0 - y(b.income))}
                rx={4}
                className={cx('fill-positive', MOTION.growY)}
                style={{ transitionDelay: `${i * 50}ms` }}
              />
              <rect
                x={c + 2}
                y={y(b.expenses)}
                width={barW}
                height={Math.max(0, y0 - y(b.expenses))}
                rx={4}
                className={cx('fill-chart-2', MOTION.growY)}
                style={{ transitionDelay: `${i * 50 + 25}ms` }}
              />
              <text x={c} y={H - 8} textAnchor="middle" className={cx(b.isCurrent ? 'fill-text font-bold' : 'fill-text-muted')}>
                {periodLabel(b, short)}
              </text>
            </g>
          );
        })}
        <path d={netPath} pathLength={1} fill="none" className={cx('stroke-ink', MOTION.draw)} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {bars.map((b, i) => (
          <circle key={`net-${b.period.from}`} cx={cx0(i)} cy={y(b.savings)} r={4} strokeWidth={2} className={cx('stroke-ink', b.savings < 0 ? 'fill-negative' : 'fill-surface', MOTION.fade)} />
        ))}
      </svg>
      <ul aria-label={t.barsLabel} className="sr-only">
        {bars.map((b) => (
          <li key={b.period.from}>{t.barsRow(periodLabel(b), formatMoney(b.income), formatMoney(b.expenses), formatMoney(b.savings))}</li>
        ))}
      </ul>
    </div>
  );
}

/** Tiny chart-type thumbnails for the picker. */
export function BarsThumb() {
  return (
    <svg viewBox="0 0 24 16" className="h-4 w-6" aria-hidden="true">
      <rect x={2} y={6} width={3} height={10} rx={1} className="fill-positive" />
      <rect x={6} y={9} width={3} height={7} rx={1} className="fill-chart-2" />
      <rect x={13} y={3} width={3} height={13} rx={1} className="fill-positive" />
      <rect x={17} y={7} width={3} height={9} rx={1} className="fill-chart-2" />
    </svg>
  );
}

export function SankeyThumb() {
  return (
    <svg viewBox="0 0 24 16" className="h-4 w-6" aria-hidden="true">
      <path d="M2 4 C8 4 8 3 12 3 L12 13 C8 13 8 12 2 12 Z" className="fill-positive opacity-60" />
      <path d="M12 3 C17 3 17 1 22 1 L22 7 C17 7 17 8 12 8 Z" className="fill-chart-1 opacity-60" />
      <path d="M12 8 C17 8 17 10 22 10 L22 15 C17 15 17 13 12 13 Z" className="fill-chart-2 opacity-60" />
    </svg>
  );
}
