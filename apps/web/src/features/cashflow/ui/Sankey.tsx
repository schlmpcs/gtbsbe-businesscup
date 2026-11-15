'use client';

// The Cash Flow Sankey: sources (pay, and what came out of savings) → Income → where it went, from the
// view-model's flow (the engine's links, by category or by group). Laid out in real pixels at the card's
// width so labels stay readable on a phone; only drawing geometry here (each band's height is its share
// of the Income node). Ribbons are smooth bezier bands colored by budget group; they fade in one after
// another. A list under the chart gives the same flows as text for screen readers.
import { cashflow as t, planner } from '@/copy';
import { cx, formatMoney } from '@/ui-kit';
import { GROUP_TONE, MOTION, TONE_BG, TONE_FILL, useWidth, type ChartTone } from '@/ui-kit/reports';
import type { BudgetGroupId, CashFlowFlowTargetVM, CashFlowFlowVM } from '../model/types';

export const targetTone = (target: CashFlowFlowTargetVM): ChartTone =>
  target.kind === 'savings' ? 'positive' : target.kind === 'oneOffs' ? 'c3' : GROUP_TONE[target.group];

export const targetName = (target: CashFlowFlowTargetVM): string =>
  target.kind === 'category'
    ? planner.categories[target.id]
    : target.kind === 'group'
      ? planner.budgetGroups[target.id]
      : target.kind === 'savings'
        ? t.nodes.savings
        : t.nodes.oneOffs;

const SOURCE_TONE: Record<'pay' | 'fromSavings', ChartTone> = { pay: 'positive', fromSavings: 'c6' };

const NODE = 10;
const GAP = 10;
const LABEL = 34; // two label lines
const TOP = 26; // room for the Income label above the middle node

type Box = { y: number; h: number };

/** Stacks values top to bottom with a gap, at `unit` px per dollar, starting at `y0`. */
function stack(values: readonly number[], unit: number, y0: number, gap: number): Box[] {
  let y = y0;
  return values.map((v) => {
    const h = Math.max(2, v * unit);
    const box = { y, h };
    y += h + gap;
    return box;
  });
}

/** Stacks node heights top to bottom: at least GAP apart, and node centers at least one label apart. */
function place(heights: readonly number[], y0: number): Box[] {
  const out: Box[] = [];
  heights.forEach((h, i) => {
    const prev = out[i - 1];
    const y = prev === undefined ? y0 : Math.max(prev.y + prev.h + GAP, prev.y + prev.h / 2 + LABEL - h / 2);
    out.push({ y, h });
  });
  return out;
}

/** A band from (x0, y0..y0+h0) to (x1, y1..y1+h1) as a smooth filled curve. */
const band = (x0: number, y0: number, h0: number, x1: number, y1: number, h1: number) => {
  const c = (x1 - x0) * 0.5;
  return `M${x0},${y0} C${x0 + c},${y0} ${x1 - c},${y1} ${x1},${y1} L${x1},${y1 + h1} C${x1 - c},${y1 + h1} ${x0 + c},${y0 + h0} ${x0},${y0 + h0} Z`;
};

const HALO = '[paint-order:stroke] stroke-surface [stroke-width:4px] [stroke-linejoin:round]';

export function Sankey({ flow }: { flow: CashFlowFlowVM }) {
  const [ref, width] = useWidth<HTMLDivElement>(720);
  const { sources, targets, total } = flow;
  if (total <= 0 || targets.length === 0) return <p className="py-2xl text-center text-sm text-text-muted">{t.sankeyEmpty}</p>;

  const W = Math.max(300, width);
  const narrow = W < 560;
  const labelW = narrow ? 112 : 168;
  const xR = W - labelW - NODE; // right nodes
  const xM = Math.round((narrow ? 0.34 : 0.4) * xR); // the Income node
  // Flows take FLOW px in all; the right column then spaces its nodes so every two-line label sits
  // beside its own node (small nodes get a bigger gap), which sets the drawing's height.
  const FLOW = narrow ? 200 : 260;
  const unit = FLOW / total;
  const right = place(targets.map((x) => Math.max(2, x.value * unit)), TOP);
  const last = right[right.length - 1]!;
  const body = last.y + last.h - TOP;
  const height = TOP + body + 10;
  const midH = total * unit;
  const mid = { y: TOP + (body - midH) / 2, h: midH };
  const leftGap = 24;
  const leftH = total * unit + leftGap * Math.max(0, sources.length - 1);
  const left = stack(sources.map((s) => s.value), unit, TOP + (body - leftH) / 2, leftGap);
  const rightLabels = right.map((b) => b.y + b.h / 2 - LABEL / 2 + 4);

  // Where each band enters and leaves the Income node: stacked without gaps, in order.
  const midIn = stack(sources.map((s) => s.value), unit, mid.y, 0);
  const midOut = stack(targets.map((x) => x.value), unit, mid.y, 0);

  return (
    <div ref={ref} className="w-full min-w-0">
      <figure className="m-0 flex flex-col gap-md">
        <svg
          role="img"
          aria-label={t.sankeyLabel}
          viewBox={`0 0 ${W} ${height}`}
          width="100%"
          height={height}
          className="block h-auto w-full overflow-visible text-xs"
          data-testid="cashflow-sankey"
        >
          {sources.map((s, i) => {
            const b = left[i]!;
            const y1 = midIn[i]!.y;
            return (
              <path
                key={`in-${s.id}`}
                d={band(NODE, b.y, b.h, xM, y1, b.h)}
                className={cx(TONE_FILL[SOURCE_TONE[s.id]], 'opacity-35 transition-opacity hover:opacity-60', MOTION.fade)}
                style={{ transitionDelay: `${i * 60}ms` }}
              >
                <title>{`${t.nodes[s.id]} → ${t.nodes.income}: ${formatMoney(s.value)}`}</title>
              </path>
            );
          })}
          {targets.map((x, i) => {
            const b = right[i]!;
            const y0 = midOut[i]!.y;
            return (
              <path
                key={`out-${x.kind}-${x.id}`}
                d={band(xM + NODE, y0, b.h, xR, b.y, b.h)}
                className={cx(TONE_FILL[targetTone(x)], 'opacity-35 transition-opacity hover:opacity-60', MOTION.fade)}
                style={{ transitionDelay: `${120 + i * 60}ms` }}
              >
                <title>{`${t.nodes.income} → ${targetName(x)}: ${formatMoney(x.value)}`}</title>
              </path>
            );
          })}

          {sources.map((s, i) => {
            const b = left[i]!;
            const cy = b.y + b.h / 2;
            return (
              <g key={`node-in-${s.id}`}>
                <rect x={0} y={b.y} width={NODE} height={b.h} rx={3} className={TONE_FILL[SOURCE_TONE[s.id]]} />
                <text x={NODE + 6} y={cy - 2} className={cx('fill-text font-semibold', HALO)}>
                  {t.nodes[s.id]}
                </text>
                <text x={NODE + 6} y={cy + 13} className={cx('fill-text-muted tabular-nums', HALO)}>
                  {formatMoney(s.value)}
                </text>
              </g>
            );
          })}

          <rect x={xM} y={mid.y} width={NODE} height={mid.h} rx={3} className="fill-ink" />
          <text x={xM + NODE / 2} y={mid.y - 8} textAnchor="middle" className={cx('fill-text font-bold', HALO)}>
            <tspan>{t.nodes.income}</tspan>
            <tspan className="fill-text-muted font-normal tabular-nums">{` ${formatMoney(total)}`}</tspan>
          </text>

          {targets.map((x, i) => {
            const b = right[i]!;
            const ly = rightLabels[i]!;
            return (
              <g key={`node-out-${x.kind}-${x.id}`}>
                <rect x={xR} y={b.y} width={NODE} height={b.h} rx={3} className={TONE_FILL[targetTone(x)]} />
                <text x={xR + NODE + 8} y={ly + 10} className="fill-text font-semibold">
                  {targetName(x)}
                </text>
                <text x={xR + NODE + 8} y={ly + 25} className="fill-text-muted tabular-nums">
                  {formatMoney(x.value)}
                </text>
              </g>
            );
          })}
        </svg>
        <figcaption className="flex flex-wrap gap-x-lg gap-y-xs text-xs text-text-muted">
          <Legend tone="positive" label={t.nodes.pay} />
          {(Object.keys(GROUP_TONE) as BudgetGroupId[]).map((g) => (
            <Legend key={g} tone={GROUP_TONE[g]} label={planner.budgetGroups[g]} />
          ))}
          <ul aria-label={t.sankeyLabel} className="sr-only">
            {sources.map((s) => (
              <li key={`in-${s.id}`}>{`${t.nodes[s.id]} → ${t.nodes.income}: ${formatMoney(s.value)}`}</li>
            ))}
            {targets.map((x) => (
              <li key={`out-${x.kind}-${x.id}`}>{`${t.nodes.income} → ${targetName(x)}: ${formatMoney(x.value)}`}</li>
            ))}
          </ul>
        </figcaption>
      </figure>
    </div>
  );
}

function Legend({ tone, label }: { tone: ChartTone; label: string }) {
  return (
    <span aria-hidden="true" className="flex items-center gap-xs">
      <span className={cx('size-2.5 rounded-full', TONE_BG[tone])} />
      {label}
    </span>
  );
}

/** A faded, number-free Sankey shape for the empty state. */
export function GhostSankey({ className }: { className?: string }) {
  const ins: [number, number, number, ChartTone][] = [
    [90, 110, 80, 'positive'],
    [200, 190, 28, 'c6'],
  ];
  const outs: [number, number, number, ChartTone][] = [
    [110, 30, 40, 'c1'],
    [150, 110, 26, 'c1'],
    [176, 175, 18, 'c2'],
    [194, 230, 14, 'c2'],
    [208, 280, 10, 'c5'],
  ];
  return (
    <svg viewBox="0 0 360 320" className={cx('h-full w-full', className)} aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      {ins.map(([y0, y1, h, tone]) => (
        <path key={`gi-${y0}`} d={band(14, y0, h, 160, y1, h)} className={cx(TONE_FILL[tone], 'opacity-40')} />
      ))}
      {outs.map(([y0, y1, h, tone]) => (
        <path key={`go-${y0}`} d={band(172, y0, h, 330, y1, h)} className={cx(TONE_FILL[tone], 'opacity-40')} />
      ))}
      {ins.map(([y0, , h, tone]) => (
        <rect key={`gn-${y0}`} x={4} y={y0} width={10} height={h} rx={3} className={TONE_FILL[tone]} />
      ))}
      <rect x={160} y={110} width={12} height={108} rx={3} className="fill-ink" />
      {outs.map(([y0, y1, h, tone]) => (
        <rect key={`gr-${y0}`} x={330} y={y1} width={10} height={h} rx={3} className={TONE_FILL[tone]} />
      ))}
    </svg>
  );
}
