// Home "Life line" hero (demo variant A): drag one decision, the plan to the end age redraws. Presentational:
// every number and label comes from LifeLineVM; this file only lays them out and scales the chart to pixels.
'use client';

import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { lifeline as t } from '@/copy';
import { Art, Button, cx, EstimateTag, Icon, type IconName, Sticker, useTweenText } from '@/ui-kit';
import type { LifeLineChartVM, LifeLineKpiVM, LifeLineTone, LifeLineVM } from '../model/types';

type Ready = Extract<LifeLineVM, { status: 'ready' }>;

export type LifeLineHeroProps = {
  vm: LifeLineVM;
  /** "Open the full plan" link (the route page passes its Link). */
  planLink?: ReactNode;
};

const TONE_TEXT: Record<LifeLineTone, string> = { good: 'text-positive', bad: 'text-negative', neutral: 'text-text-muted' };

export function LifeLineHero({ vm, planLink }: LifeLineHeroProps) {
  if (vm.status !== 'ready') {
    return (
      <section aria-busy="true" data-testid="lifeline" className="flex flex-col gap-xl">
        <div className="h-40 animate-pulse rounded-xl bg-surface-strong" />
        <div className="h-96 animate-pulse rounded-xl bg-surface" />
      </section>
    );
  }
  return (
    <section aria-labelledby={t.headingId} data-testid="lifeline" className="flex flex-col gap-xl">
      <div className="grid items-center gap-2xl lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex min-w-0 flex-col items-start gap-lg">
          <Sticker tone="ink" tilt={-2} className="text-sm">{t.sticker}</Sticker>
          <h1 id={t.headingId} className="font-display text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            <span>{vm.headline.lead}</span>
            {vm.headline.payoff && (
              <>
                <span>, </span>
                <span data-testid="lifeline-payoff" className={vm.headline.payoffTone === 'bad' ? 'text-negative' : 'text-primary'}>
                  {vm.headline.payoff}
                </span>
              </>
            )}
            {!/[?!.]$/.test(vm.headline.payoff ?? vm.headline.lead) && <span>.</span>}
          </h1>
          <p className="max-w-(--container-2xl) text-lg text-text-muted">{vm.sub}</p>
          <div className="grid w-full grid-cols-3 gap-sm sm:gap-md">
            {vm.kpis.map((k) => <Kpi key={k.id} kpi={k} />)}
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-(--container-sm)">
          <Art name={vm.house.art} className="w-full transition-opacity duration-500" />
          <span
            data-testid="lifeline-house"
            className={cx(
              'absolute bottom-md left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-lg py-sm text-sm font-bold text-on-primary shadow-md',
              vm.house.tone === 'good' ? 'bg-positive' : 'bg-ink',
            )}
          >
            {vm.house.tone === 'good' && <Icon name="check" size={14} strokeWidth={3} className="mr-xs inline-block align-[-2px]" />}
            {vm.house.label}
          </span>
        </div>
      </div>

      <div className="rounded-xl bg-surface p-lg shadow-md sm:p-xl">
        <div className="mb-sm flex flex-wrap items-center justify-between gap-md">
          <h2 className="font-display text-xl font-extrabold">{vm.chart.title}</h2>
          <Legend chart={vm.chart} />
        </div>
        <LifeLineChart chart={vm.chart} drag={{ min: vm.slider.min, max: vm.slider.max, onAge: vm.setAge, hint: t.chart.dragHint }} />
      </div>

      <div className="grid gap-xl lg:grid-cols-2">
        <DecisionCard vm={vm} />
        <div className="flex flex-col justify-between gap-lg rounded-xl bg-surface p-xl shadow-md">
          <p className="text-sm text-text-muted">{vm.disclaimer}</p>
          <div className="flex flex-wrap items-center gap-md">
            <Button
              size="lg"
              variant={vm.apply.done ? 'secondary' : 'primary'}
              disabled={vm.apply.done}
              onClick={vm.applyToPlan}
              data-testid="lifeline-apply"
            >
              {vm.apply.done && <Icon name="check" size={18} strokeWidth={3} />}
              {vm.apply.label}
            </Button>
            {planLink}
          </div>
        </div>
      </div>
    </section>
  );
}

function Kpi({ kpi }: { kpi: LifeLineKpiVM }) {
  return (
    <div data-testid={`lifeline-kpi-${kpi.id}`} className="flex min-w-0 flex-col gap-xs rounded-lg bg-surface p-md shadow-sm sm:p-lg">
      <span className="text-[10px] font-bold uppercase tracking-wide text-text-muted sm:text-xs">{kpi.label}</span>
      <div className="flex items-center gap-sm">
        {kpi.gaugePct !== undefined && kpi.gaugePct !== null && <Ring pct={kpi.gaugePct} tone={kpi.tone} />}
        <span className="font-display text-xl font-extrabold tabular-nums sm:text-3xl">{kpi.value ?? kpi.note}</span>
      </div>
      <span className="flex flex-wrap gap-x-sm text-xs font-semibold tabular-nums sm:text-sm">
        {kpi.was && <span className="font-medium text-text-muted line-through">{kpi.was}</span>}
        {kpi.delta && <span className={TONE_TEXT[kpi.tone]}>{kpi.delta}</span>}
        {!kpi.was && !kpi.delta && <span aria-hidden="true">&nbsp;</span>}
      </span>
    </div>
  );
}

function Ring({ pct, tone }: { pct: number; tone: LifeLineTone }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true" className="hidden shrink-0 sm:block">
      <circle cx="20" cy="20" r={r} fill="none" stroke="var(--color-surface-strong)" strokeWidth="6" />
      <circle
        cx="20" cy="20" r={r} fill="none" strokeWidth="6" strokeLinecap="round"
        stroke={tone === 'bad' ? 'var(--color-negative)' : 'var(--color-positive)'}
        strokeDasharray={`${(c * pct) / 100} ${c}`} transform="rotate(-90 20 20)"
        style={{ transition: 'stroke-dasharray 400ms ease' }}
      />
    </svg>
  );
}

function Legend({ chart }: { chart: LifeLineChartVM }) {
  return (
    <div className="flex flex-wrap items-center gap-md text-xs text-text-muted">
      <span className="flex items-center gap-xs"><i className="inline-block h-1 w-6 rounded-full bg-primary" />{chart.legend.selected}</span>
      {chart.legend.before && (
        <span className="flex items-center gap-xs"><i className="inline-block h-1 w-6 border-t-2 border-dashed border-text-muted" />{chart.legend.before}</span>
      )}
      {chart.band && <span className="flex items-center gap-xs"><i className="inline-block h-3 w-6 rounded-sm bg-chart-band" />{chart.legend.band}</span>}
    </div>
  );
}

// ----- Chart (pixel scaling only) -------------------------------------------------------------

const W = 1000;
const H = 360;
const PAD = { l: 64, r: 16, t: 56, b: 34 };
const MARKER_COLOR = { primary: 'var(--color-primary)', violet: 'var(--color-chart-5)', positive: 'var(--color-positive)' } as const;
const MARKER_ICON: Record<'home' | 'kid' | 'beach' | 'other', IconName> = { home: 'home', kid: 'kid', beach: 'beach', other: 'spark' };

/**
 * Drag the "Buy a home" pill along the ages (snaps to whole years, clamped to the slider's range).
 * `showHint: false` keeps the hint as the pill's tooltip only (a screen with its own drag affordance).
 */
export type LifeLineChartDrag = { min: number; max: number; onAge: (age: number) => void; hint: string; showHint?: boolean };
/** Below this many px between the plan's age and the picked one, the arrow would be only its head: draw the ring alone. */
const MIN_ARROW_PX = 28;

/** The Life line chart (also used by the onboarding's decision step). */
export function LifeLineChart({ chart, drag }: { chart: LifeLineChartVM; drag?: LifeLineChartDrag }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState(false);
  const [a0, a1] = chart.ageDomain;
  const [v0, v1] = chart.valueDomain;
  const x = (age: number) => PAD.l + ((age - a0) / Math.max(1, a1 - a0)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - v0) / Math.max(1, v1 - v0)) * (H - PAD.t - PAD.b);
  const path = (pts: { age: number; netWorth: number }[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.age).toFixed(1)},${y(p.netWorth).toFixed(1)}`).join(' ');
  const zero = y(0);
  /** The age under the pointer (inverse of x), in whole years, clamped to the drag range. */
  const ageAt = (clientX: number): number | null => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm || !drag) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    const sx = pt.matrixTransform(ctm.inverse()).x;
    const age = a0 + ((sx - PAD.l) / (W - PAD.l - PAD.r)) * Math.max(1, a1 - a0);
    return Math.min(drag.max, Math.max(drag.min, Math.round(age)));
  };
  const onDown = (e: ReactPointerEvent<SVGGElement>) => {
    if (!drag) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onMove = (e: ReactPointerEvent<SVGGElement>) => {
    if (!dragging) return;
    const age = ageAt(e.clientX);
    if (age !== null) drag?.onAge(age);
  };
  const onUp = (e: ReactPointerEvent<SVGGElement>) => {
    setDragging(false);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };
  const yAt = (pts: { age: number; netWorth: number }[], age: number) => y(pts.find((p) => p.age === age)?.netWorth ?? 0);

  const band = chart.band
    ? `M${chart.band.map((b) => `${x(b.age).toFixed(1)},${y(b.p90).toFixed(1)}`).join(' L')} L${[...chart.band].reverse().map((b) => `${x(b.age).toFixed(1)},${y(b.p10).toFixed(1)}`).join(' L')} Z`
    : null;
  const shortLine = chart.runsOut ? (chart.runsOut.line === 'before' ? chart.before : chart.selected) : null;
  const below = shortLine
    ? (() => {
        const pts = shortLine.filter((p) => p.age >= chart.runsOut!.age);
        if (pts.length < 2) return null;
        return `M${x(pts[0]!.age).toFixed(1)},${zero.toFixed(1)} ${pts.map((p) => `L${x(p.age).toFixed(1)},${y(Math.min(0, p.netWorth)).toFixed(1)}`).join(' ')} L${x(pts.at(-1)!.age).toFixed(1)},${zero.toFixed(1)} Z`;
      })()
    : null;

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={chart.ariaLabel} className={cx('h-auto w-full', dragging && 'cursor-grabbing select-none')} data-testid="lifeline-chart">
      <defs>
        <pattern id="ll-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" stroke="var(--color-negative)" strokeWidth="3" opacity="0.4" />
        </pattern>
        <marker id="ll-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--color-ink)" />
        </marker>
      </defs>
      {chart.yTicks.map((tk) => (
        <g key={tk.value}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(tk.value)} y2={y(tk.value)} stroke="var(--color-chart-grid)"
            strokeDasharray={tk.value === 0 ? undefined : '3 5'} strokeWidth={tk.value === 0 ? 1.5 : 1} />
          <text x={PAD.l - 8} y={y(tk.value) + 4} textAnchor="end" className="fill-text-muted text-[12px] tabular-nums">{tk.label}</text>
        </g>
      ))}
      {chart.xTicks.map((tk) => (
        <text key={tk.age} x={x(tk.age)} y={H - 10} textAnchor="middle" className="fill-text-muted text-[12px]">{tk.label}</text>
      ))}
      {band && <path d={band} fill="var(--color-chart-band)" opacity="0.6" className="ll-tween" />}
      {below && <path d={below} fill="url(#ll-hatch)" />}
      {chart.before && (
        <path d={path(chart.before)} fill="none" stroke="var(--color-chart-6)" strokeWidth="3" strokeDasharray="7 7" strokeLinecap="round" />
      )}
      <path d={path(chart.selected)} fill="none" stroke="var(--color-primary)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" className="ll-tween" />

      {chart.markers.map((m) => {
        const mx = x(m.age);
        const my = yAt(chart.selected, m.age);
        const top = 22;
        const draggable = Boolean(drag) && m.icon === 'home';
        // The marker slides to its new age (CSS transform on the group, eased by .ll-tween); inside it x = 0.
        return (
          <g key={m.id} className="ll-tween" style={{ transform: `translate(${mx.toFixed(1)}px, 0px)` }}>
            <path d={`M0,${my.toFixed(1)} V${top + 14}`} className="ll-tween" fill="none" stroke={MARKER_COLOR[m.tone]} strokeDasharray="2 4" strokeWidth="1.5" />
            <g
              transform={`translate(0,${top})`}
              {...(draggable ? {
                onPointerDown: onDown, onPointerMove: onMove, onPointerUp: onUp, onPointerCancel: onUp,
                className: cx('touch-none', dragging ? 'cursor-grabbing' : 'cursor-grab'),
                'data-testid': 'lifeline-drag-home',
              } : {})}
            >
              {draggable && <title>{drag!.hint}</title>}
              {draggable && <rect x={-64} y={-22} width={128} height={44} fill="transparent" />}
              <rect x={-54} y={-15} width={108} height={30} rx={15} fill={draggable && dragging ? 'var(--color-primary-soft)' : 'var(--color-surface)'} stroke={MARKER_COLOR[m.tone]} strokeWidth={draggable ? 2.5 : 2} />
              <Icon name={MARKER_ICON[m.icon]} x={-44} y={-8} size={16} stroke={MARKER_COLOR[m.tone]} strokeWidth={2.2} />
              <text x={8} y={5} textAnchor="middle" className="pointer-events-none fill-text text-[13px] font-bold">{m.label}</text>
              {draggable && !dragging && drag!.showHint !== false && <text x={0} y={30} textAnchor="middle" className="pointer-events-none fill-primary text-[11px] font-bold">{'⟷ '}{drag!.hint}</text>}
            </g>
            <circle cx={0} cy={0} r={5.5} fill="var(--color-surface)" stroke={MARKER_COLOR[m.tone]} strokeWidth="3" className="ll-tween" style={{ transform: `translate(0px, ${my.toFixed(1)}px)` }} />
          </g>
        );
      })}

      {chart.retireCallout && (() => {
        // The picked line's callout goes on the side away from the before line, the before one opposite.
        const selY = y(chart.retireCallout.netWorth);
        const beforeY = chart.beforeCallout ? y(chart.beforeCallout.netWorth) : null;
        const selAbove = beforeY === null || selY <= beforeY;
        return (
          <>
            <Callout x={x(chart.retireCallout.age) + 12} y={selY + (selAbove ? -24 : 24)} label={chart.retireCallout.label} dark W={W} />
            {chart.beforeCallout && beforeY !== null && (
              <Callout x={x(chart.beforeCallout.age) + 12} y={beforeY + (selAbove ? 24 : -24)} label={chart.beforeCallout.label} W={W} />
            )}
          </>
        );
      })()}
      {chart.runsOut && (
        <text x={Math.min(x(chart.runsOut.age) + 8, W - PAD.r - 150)} y={Math.min(zero + 20, H - PAD.b - 30)} className="fill-negative text-[13px] font-bold">
          {chart.runsOut.label}
        </text>
      )}
      {chart.dragged && (() => {
        // The plan's age: a ring on the axis, labelled ("your plan: 38"), and an arrow to the picked age
        // when there is room for more than its head (a short one used to show as a stray ▶).
        const fx = x(chart.dragged.fromAge);
        const tx = x(chart.dragged.toAge);
        const cy = H - PAD.b - 8;
        const right = tx > fx;
        const labelW = chart.dragged.label.length * 6.6;
        // The label sits on the side away from the arrow, inside the plot.
        const lx = right ? Math.max(PAD.l + labelW, fx - 10) : Math.min(W - PAD.r - labelW, fx + 10);
        return (
          <g>
            {Math.abs(tx - fx) >= MIN_ARROW_PX && (
              <line x1={fx + (right ? 8 : -8)} x2={tx - (right ? 8 : -8)} y1={cy} y2={cy} stroke="var(--color-ink)" strokeWidth="2" markerEnd="url(#ll-arrow)" />
            )}
            <circle cx={fx} cy={cy} r={6} fill="var(--color-surface)" stroke="var(--color-chart-6)" strokeWidth="3" />
            <text x={lx} y={cy + 4} textAnchor={right ? 'end' : 'start'} className="pointer-events-none fill-text-muted text-[11px] font-bold">{chart.dragged.label}</text>
          </g>
        );
      })()}
    </svg>
  );
}

function Callout({ x, y, label: target, dark = false, W }: { x: number; y: number; label: string; dark?: boolean; W: number }) {
  // The value eases between drags; the box is sized by the final text so it never jitters.
  const label = useTweenText(target);
  const w = target.length * 7.4 + 20;
  const left = Math.min(x, W - w - 4);
  return (
    <g className="ll-tween" style={{ transform: `translate(${left.toFixed(1)}px, ${y.toFixed(1)}px)` }}>
      <rect x={0} y={-14} width={w} height={28} rx={8} fill={dark ? 'var(--color-ink)' : 'var(--color-surface-strong)'} />
      <text x={w / 2} y={5} textAnchor="middle" className={cx('text-[13px] font-bold tabular-nums', dark ? 'fill-on-primary' : 'fill-text-muted')}>{label}</text>
    </g>
  );
}

// ----- Decision slider ------------------------------------------------------------------------

function DecisionCard({ vm }: { vm: Ready }) {
  const s = vm.slider;
  const span = Math.max(1, s.max - s.min);
  const at = (age: number) => `${((age - s.min) / span) * 100}%`;
  return (
    <div className="flex flex-col gap-lg rounded-xl bg-ink p-xl text-on-primary shadow-md">
      <span className="text-xs font-bold uppercase tracking-wide text-chart-6">{s.eyebrow}</span>
      <p className="font-display text-3xl font-extrabold">
        {s.title.replace(String(s.value), '')}
        <span className="text-primary">{s.value}</span>
        {s.titleNot}
      </p>
      <div className="relative pt-lg">
        {/* The plan's year: a dashed ghost knob behind the real control. */}
        {s.base !== s.value && (
          <span aria-hidden="true" className="pointer-events-none absolute top-[22px] h-5 w-5 -translate-x-1/2 rounded-full border-2 border-dashed border-chart-6"
            style={{ left: at(s.base) }} />
        )}
        <label htmlFor="lifeline-age" className="sr-only">{s.label}</label>
        <input
          id="lifeline-age"
          data-testid="lifeline-slider"
          type="range"
          min={s.min}
          max={s.max}
          step={1}
          value={s.value}
          aria-valuetext={s.formatValue(s.value)}
          onChange={(e) => vm.setAge(Number(e.target.value))}
          className="relative w-full cursor-pointer accent-primary"
        />
        <div aria-hidden="true" className="mt-xs flex justify-between text-xs text-chart-6 tabular-nums">
          {s.ticks.map((a) => <span key={a} className={a === s.value ? 'font-bold text-primary' : undefined}>{a}</span>)}
        </div>
      </div>
      <div className="flex flex-wrap gap-sm">
        {s.facts.map((f) => (
          <span key={f.label} className="rounded-full bg-on-primary/10 px-md py-xs text-sm font-semibold">{f.label}</span>
        ))}
      </div>
      {s.isEstimate && (
        <span className="flex items-center gap-sm text-xs text-chart-6"><EstimateTag /> {s.estimateNote}</span>
      )}
    </div>
  );
}
