// One compared line: your amount, the typical range as a bar with your marker, where you sit (a word
// and an icon, never colour alone), the gap, the 10-year effect, and the source with its estimate tag.
// Placeholder look: the designer's S23 frames replace it. Nothing is computed here.
import type { ComponentType, CSSProperties, ReactNode } from 'react';
import { overpaying as t } from '@/copy';
import { Money, SourceNote, Tag, cx, formatMoney } from '@/ui-kit';
import { MOTION, PlanImpactPanel } from '@/ui-kit/reports';
import type { BenchmarkRowVM, PlanImpactVM, Position } from '../model/types';

const ICON: Record<Position, string> = {
  below: 'M8 3v9M4.5 8.5 8 12l3.5-3.5', // arrow down
  inRange: 'M3 6h10M3 10h10', // equals
  above: 'M8 13V4M4.5 7.5 8 4l3.5 3.5', // arrow up
};

function PositionTag({ position }: { position: Position }) {
  return (
    <Tag data-testid="position" className="gap-xs py-xs text-sm text-text">
      <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 shrink-0 fill-none stroke-current" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d={ICON[position]} />
      </svg>
      {t.result.positions[position]}
    </Tag>
  );
}

const DOT: Record<Position, string> = { below: 'bg-ink', inRange: 'bg-positive', above: 'bg-negative' };

/**
 * The typical range as a band on a linear axis, its middle as a tick, and what you pay as a dot with its
 * label kept inside the bar (it slides by its own width as the dot nears an end). Positions come from the
 * view-model; the band grows in and the dot fades in (CSS only, none with reduced motion).
 */
function RangeBar({ row }: { row: BenchmarkRowVM }) {
  const { bar, yours, typical } = row;
  const vars = { '--lo': bar.low, '--hi': bar.high, '--mid': bar.mid, '--you': bar.yours } as CSSProperties;
  return (
    <figure
      role="img"
      aria-label={t.result.barLabel(formatMoney(yours), formatMoney(typical.low), formatMoney(typical.mid), formatMoney(typical.high))}
      className="flex flex-col gap-xs"
    >
      <div aria-hidden="true" className="relative pt-xl" style={vars}>
        <span className="absolute top-0 left-[calc(var(--you)*100%)] -translate-x-[calc(var(--you)*100%)] whitespace-nowrap text-xs font-bold tabular-nums">
          {t.result.yourMarker} {formatMoney(yours)}
        </span>
        <div className="relative h-2xl">
          <div className="absolute inset-x-0 top-1/2 h-xs -translate-y-1/2 rounded-full bg-surface-strong" />
          <div className={cx('absolute top-1/2 left-[calc(var(--lo)*100%)] h-lg w-[calc((var(--hi)_-_var(--lo))*100%)] -translate-y-1/2 rounded-sm bg-chart-band', MOTION.growX)} />
          <div className="absolute top-1/2 left-[calc(var(--mid)*100%)] h-lg w-xs -translate-x-1/2 -translate-y-1/2 rounded-full bg-chart-1" />
          <div className={cx('absolute top-1/2 left-[calc(var(--you)*100%)] size-4 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface', DOT[row.position], MOTION.fade)} />
        </div>
      </div>
      <div aria-hidden="true" className="flex justify-between gap-sm text-xs text-text-muted tabular-nums">
        <span>{formatMoney(bar.min)}</span>
        <span className="flex items-center gap-xs">
          <span className="inline-block h-sm w-xs rounded-full bg-chart-1" />
          {t.result.middle} {formatMoney(typical.mid)}
        </span>
        <span>{formatMoney(bar.max)}</span>
      </div>
    </figure>
  );
}

type LinkLike = ComponentType<{ href: string; className?: string; children?: ReactNode }>;

export type BenchmarkRowProps = {
  row: BenchmarkRowVM;
  /** Paying the middle of the range, measured on the plan; absent when the line has no move. */
  impact?: PlanImpactVM;
  Link?: LinkLike;
};

export function BenchmarkRow({ row, impact, Link }: BenchmarkRowProps) {
  return (
    <li
      data-testid="benchmark-row"
      data-line={row.line}
      data-position={row.position}
      className="flex flex-col gap-md rounded-xl bg-surface p-lg shadow-md"
    >
      <div className="flex flex-wrap items-start justify-between gap-sm">
        <h3 className="text-lg font-bold leading-tight">{t.lines[row.line]}</h3>
        <PositionTag position={row.position} />
      </div>

      <p className="flex flex-wrap items-baseline gap-x-sm">
        <span className="text-sm text-text-muted">{t.result.you}</span>
        <Money value={row.yours} className="font-display text-3xl font-extrabold" />
        <span className="text-sm text-text-muted">{t.result.perMonthShort}</span>
      </p>

      <RangeBar row={row} />

      <p className="flex flex-wrap items-center gap-sm text-sm">
        <span>{t.result.typicalRange(formatMoney(row.typical.low), formatMoney(row.typical.high))}</span>
        {row.isEstimate && (
          <Tag variant="dashed" data-testid="range-estimate" title={t.result.estimateWhy}>
            {t.result.estimate}
            <span className="sr-only">: {t.result.estimateWhy}</span>
          </Tag>
        )}
      </p>

      {row.position === 'below' && <p className="text-sm text-text-muted">{t.result.belowNote}</p>}

      {row.position === 'above' && (
        <div className="flex flex-col gap-sm text-sm">
          <p data-testid="gap" className="font-semibold">
            {t.result.gap(formatMoney(row.gapPerMonth), formatMoney(row.gapPerYear))}
          </p>
          {impact?.status === 'ready' ? (
            <PlanImpactPanel
              data-testid="row-impact"
              lead={row.toMiddlePerMonth !== null ? t.result.planLead(formatMoney(row.toMiddlePerMonth)) : undefined}
              in10y={impact.in10y}
              atRetirement={impact.atRetirement}
              year10={impact.year10}
              retireAge={impact.retireAge}
              scenarioName={impact.scenarioName}
              isSample={impact.isSample}
              state={impact.state}
              onAdd={impact.add}
              onRemove={impact.remove}
              planHref={impact.planHref}
              Link={Link}
            />
          ) : (
            <p className="text-text-muted">{t.result.planNotMeasured}</p>
          )}
        </div>
      )}

      <SourceNote source={row.source} />
    </li>
  );
}
