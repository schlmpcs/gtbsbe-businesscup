'use client';

// The Cash Flow Sankey: the engine's nodes and links (summary.sankey) drawn as three columns, sources →
// Income → where it went. Only drawing geometry here (heights in proportion to each link's dollars);
// every amount is the engine's. Labels sit right of the last column, one per node, pushed apart so they
// never overlap; a list under the chart gives the same flows as text.
import { cashflow as t, planner } from '@/copy';
import { formatMoney } from '@/ui-kit';
import type { CashFlowSummary } from '../model/types';

const NAMES: Record<string, string> = { ...planner.categories, ...t.nodes };
const nameOf = (id: string) => NAMES[id] ?? id;

const W = 340;
const NODE = 8;
const COL = [0, 96, 186];
const LABEL_X = COL[2]! + NODE + 6;
const GAP = 4;
const LINE = 13; // one label line
const BODY = 220; // drawing height for the flows

const LINK_FILL: Record<string, string> = {
  income: 'fill-chart-1',
  savings: 'fill-chart-4',
  fromSavings: 'fill-chart-2',
  total: 'fill-chart-6',
  category: 'fill-chart-1',
};

type Box = { id: string; y: number; h: number };

export function Sankey({ summary }: { summary: CashFlowSummary }) {
  const { nodes, links } = summary.sankey;
  if (nodes.length === 0) return <p className="text-sm text-text-muted">{t.sankeyEmpty}</p>;

  const kindOf = new Map(nodes.map((n) => [n.id, n.kind]));
  const sources = links.filter((l) => l.target === 'income');
  const targets = links.filter((l) => l.source === 'income');
  const total = Math.max(
    sources.reduce((s, l) => s + l.value, 0),
    targets.reduce((s, l) => s + l.value, 0),
  );
  const gaps = (n: number) => Math.max(0, n - 1) * GAP;
  const unit = total > 0 ? (BODY - gaps(Math.max(sources.length, targets.length))) / total : 0;
  const stack = (list: typeof links, key: 'source' | 'target'): Box[] => {
    let y = 0;
    return list.map((l) => {
      const h = Math.max(1, l.value * unit);
      const box = { id: l[key], y, h };
      y += h + GAP;
      return box;
    });
  };
  const left = stack(sources, 'source');
  const right = stack(targets, 'target');
  const midH = Math.max(1, total * unit);

  // Labels: two lines (name, amount) at each right node's middle, pushed down to avoid overlaps.
  const labelY: number[] = [];
  right.forEach((b, i) => {
    const want = b.y + b.h / 2 - LINE / 2;
    labelY.push(i === 0 ? Math.max(0, want) : Math.max(want, labelY[i - 1]! + LINE * 2 + 2));
  });
  const height = Math.max(BODY + LINE + 4, (labelY[labelY.length - 1] ?? 0) + LINE * 2 + 4);

  // A link band from (x0, y0..y0+h0) to (x1, y1..y1+h1), drawn as a filled curve.
  const band = (x0: number, y0: number, x1: number, y1: number, h: number) => {
    const mx = (x0 + x1) / 2;
    return `M${x0},${y0} C${mx},${y0} ${mx},${y1} ${x1},${y1} L${x1},${y1 + h} C${mx},${y1 + h} ${mx},${y0 + h} ${x0},${y0 + h} Z`;
  };

  return (
    <figure className="flex flex-col gap-md">
      <svg
        role="img"
        aria-label={t.sankeyLabel}
        viewBox={`0 0 ${W} ${height}`}
        className="h-auto w-full max-w-2xl"
        data-testid="cashflow-sankey"
      >
        {left.map((b, i) => {
          // The middle column has no gaps: the band lands at its stacked offset.
          const y1 = b.y - i * GAP;
          return (
            <path key={`in-${b.id}`} d={band(COL[0]! + NODE, b.y, COL[1]!, y1, b.h)} className={LINK_FILL[b.id === 'fromSavings' ? 'fromSavings' : 'total']} opacity={0.35}>
              <title>{`${nameOf(b.id)} → ${t.nodes.income}: ${formatMoney(sources[i]!.value)}`}</title>
            </path>
          );
        })}
        {right.map((b, i) => {
          const y0 = b.y - i * GAP;
          const kind = kindOf.get(b.id) ?? 'category';
          return (
            <path key={`out-${b.id}`} d={band(COL[1]! + NODE, y0, COL[2]!, b.y, b.h)} className={LINK_FILL[kind]} opacity={0.35}>
              <title>{`${t.nodes.income} → ${nameOf(b.id)}: ${formatMoney(targets[i]!.value)}`}</title>
            </path>
          );
        })}
        {left.map((b) => (
          <g key={`node-in-${b.id}`}>
            <rect x={COL[0]} y={b.y} width={NODE} height={b.h} rx={2} className="fill-ink" />
            <text x={COL[0]! + NODE + 4} y={Math.max(LINE, b.y + b.h / 2)} className="fill-text text-xs font-semibold">
              {nameOf(b.id)}
            </text>
            <text x={COL[0]! + NODE + 4} y={Math.max(LINE, b.y + b.h / 2) + LINE} className="fill-text-muted text-xs tabular-nums">
              {formatMoney(sources[left.indexOf(b)]!.value)}
            </text>
          </g>
        ))}
        <rect x={COL[1]} y={0} width={NODE} height={midH} rx={2} className="fill-ink" />
        <text x={COL[1]! + NODE + 4} y={LINE - 2} className="fill-text text-xs font-semibold">
          {t.nodes.income}
        </text>
        {right.map((b, i) => (
          <g key={`node-out-${b.id}`}>
            <rect x={COL[2]} y={b.y} width={NODE} height={b.h} rx={2} className="fill-ink" />
            <text x={LABEL_X} y={labelY[i]! + LINE - 3} className="fill-text text-xs font-medium">
              {nameOf(b.id)}
            </text>
            <text x={LABEL_X} y={labelY[i]! + LINE * 2 - 3} className="fill-text-muted text-xs tabular-nums">
              {formatMoney(targets[i]!.value)}
            </text>
          </g>
        ))}
      </svg>
      <figcaption>
        <ul aria-label={t.sankeyLabel} className="sr-only">
          {links.map((l) => (
            <li key={`${l.source}-${l.target}`}>{`${nameOf(l.source)} → ${nameOf(l.target)}: ${formatMoney(l.value)}`}</li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}
