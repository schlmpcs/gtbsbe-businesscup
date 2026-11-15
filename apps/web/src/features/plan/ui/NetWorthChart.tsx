'use client';

// The hero card of /plan: the KPI strip (rules-based, from usePlan → kpis), "money lasts until" as a
// status pill, the display toggle, and one big net worth chart: years along the bottom (age in the
// tooltip), $0 line with the zone below it hatched, event badges along the top with a thin line down
// to their year (click opens the editor; arrow keys move it a year), the retirement line, and the
// "AI estimate" as a separate dashed series only when the view-model says it passed its checks.
import { plan as copy } from '@/copy';
import { Tag, cx } from '@/ui-kit';
import type { AiLineVM, PlanChartVM, PlanDisplay, PlanKpiVM } from '../model/types';
import { EventIcon, eventBadgeStyle } from './EventIcon';
import { LineChart, type ChartSeries } from './LineChart';

export type NetWorthChartProps = {
  kpis: readonly PlanKpiVM[];
  chart: PlanChartVM;
  aiLine: AiLineVM;
  display: { value: PlanDisplay; label: string; options: { value: PlanDisplay; label: string }[] };
  onDisplayChange: (d: PlanDisplay) => void;
  onOpenEvent: (id: string) => void;
  onMoveEvent: (id: string, year: number) => void;
};

export function NetWorthChart({ kpis, chart, aiLine, display, onDisplayChange, onOpenEvent, onMoveEvent }: NetWorthChartProps) {
  const t = copy.screen.chart;
  const ageOf = new Map(chart.points.map((p) => [p.year, p.age]));
  const retireAge = chart.retireYear !== null ? ageOf.get(chart.retireYear) : undefined;

  const series: ChartSeries[] = [
    {
      id: 'plan',
      label: t.yourPlan,
      color: 'var(--color-primary)',
      negativeColor: 'var(--color-negative)',
      area: true,
      strong: true,
      points: chart.points.map((p) => ({ x: p.year, y: p.netWorth, label: p.netWorthLabel })),
    },
  ];
  const aiShown = aiLine.status === 'shown' && (aiLine.points?.length ?? 0) > 0;
  if (aiShown) {
    series.push({
      id: 'ai',
      label: aiLine.label,
      color: 'var(--color-chart-5)',
      dashed: true,
      points: (aiLine.points ?? []).map((p) => ({ x: p.year, y: p.netWorth })),
    });
  }

  return (
    <section aria-labelledby="plan-overview" className="card card-pad flex min-w-0 flex-col gap-lg">
      <h2 id="plan-overview" className="sr-only">{t.heading}</h2>
      <KpiStrip kpis={kpis} retireAge={retireAge} />

      <div className="flex flex-wrap items-center justify-between gap-sm border-t border-border pt-lg">
        <h3 className="text-lg font-bold">{t.heading}</h3>
        <div role="group" aria-label={copy.assumptions.labels.display} className="flex rounded-full bg-surface-strong p-xs text-xs">
          {display.options.map((o) => (
            <button
              key={o.value}
              type="button"
              aria-pressed={o.value === display.value}
              onClick={() => onDisplayChange(o.value)}
              className={cx(
                'min-h-9 rounded-full px-md font-semibold transition-colors',
                o.value === display.value ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text',
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <LineChart
        title={t.title}
        series={series}
        legend={aiShown}
        belowZeroLabel={t.belowZero}
        heightClass="h-64 sm:h-80"
        xTicks={chart.xTicks.map((k) => ({ x: k.year, label: k.label }))}
        xLabel={(year) => t.tooltipHeader(year, ageOf.get(year) ?? 0)}
        {...(chart.retireYear !== null && retireAge !== undefined ? { reference: { x: chart.retireYear, label: t.retireLine(retireAge) } } : {})}
        markers={chart.markers.map((m) => ({
          id: m.id,
          x: m.year,
          label: t.marker(m.label, m.year, m.age),
          icon: <EventIcon id={m.icon} className="size-md" />,
          badgeStyle: eventBadgeStyle(m.icon),
          dim: !m.enabled,
          onSelect: () => onOpenEvent(m.id),
          onNudge: (d) => onMoveEvent(m.id, m.year + d),
        }))}
        footnote={t.inDollars(display.label)}
      />
      {aiLine.status === 'shown' && <p className="text-xs text-text-muted">{t.aiNote}</p>}
      {aiLine.status === 'loading' && <p className="text-xs text-text-muted">{t.aiLoading}</p>}
      {aiLine.status === 'rejected' && aiLine.reasonMessage && (
        <p className="text-xs text-text-muted">
          {aiLine.label}: {aiLine.reasonMessage}
        </p>
      )}
    </section>
  );
}

/** Four numbers in one strip (2×2 on a phone) and "money lasts until" as a pill. */
function KpiStrip({ kpis, retireAge }: { kpis: readonly PlanKpiVM[]; retireAge: number | undefined }) {
  const t = copy.screen;
  const byId = (id: PlanKpiVM['id']) => kpis.find((k) => k.id === id);
  const shortfall = byId('shortfall');
  const numbers = [byId('netWorthEndOfYear'), byId('netWorthAtRetirement'), byId('netWorthAtEnd')].filter((k): k is PlanKpiVM => !!k);

  const items: { id: string; label: string; value: string; tooltip: string; bad: boolean }[] = numbers.map((k) => ({
    id: k.id, label: k.label, value: k.value, tooltip: k.tooltip, bad: k.tone === 'bad',
  }));
  // Retirement age sits third: today → at retirement → when → at the end.
  if (retireAge !== undefined) {
    items.splice(2, 0, { id: 'retireAge', label: t.kpis.retireAge, value: t.kpis.retireAgeValue(retireAge), tooltip: t.kpis.retireAgeTooltip, bad: false });
  }

  return (
    <div className="flex flex-col gap-md">
      <div className="flex flex-wrap items-center justify-between gap-sm">
        <p className="text-sm font-semibold text-text-muted">{t.kpis.label}</p>
        {shortfall && (
          <p
            data-kpi={shortfall.id}
            title={shortfall.tooltip}
            className={cx(
              'flex items-center gap-sm rounded-full py-xs pl-sm pr-xs text-sm font-semibold',
              shortfall.tone === 'bad' ? 'bg-negative/10 text-negative' : 'bg-positive-soft text-positive',
            )}
          >
            <span aria-hidden="true" className={cx('size-sm rounded-full', shortfall.tone === 'bad' ? 'bg-negative' : 'bg-positive')} />
            <span>
              {shortfall.label}: <span className="tabular-nums">{shortfall.value}</span>
            </span>
            <span className="sr-only">{shortfall.tooltip}</span>
            <Tag className="bg-surface" title={t.kpiSourceHint}>{t.kpiSource}</Tag>
          </p>
        )}
      </div>
      <ul aria-label={t.kpis.label} className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-border lg:grid-cols-4">
        {items.map((k) => (
          <li key={k.id} data-kpi={k.id} className="flex min-w-0 flex-col gap-xs bg-surface p-md sm:p-lg">
            <span className="truncate text-xs font-medium text-text-muted sm:text-sm" title={k.tooltip}>
              {k.label}
            </span>
            <span
              className={cx(
                'font-display text-xl font-extrabold leading-tight tabular-nums sm:text-3xl',
                k.bad ? 'text-negative' : 'text-text',
              )}
            >
              {k.value}
            </span>
            <span className="sr-only">{k.tooltip}</span>
            <Tag className="w-fit" title={t.kpiSourceHint}>
              {t.kpiSource}
            </Tag>
          </li>
        ))}
      </ul>
    </div>
  );
}
