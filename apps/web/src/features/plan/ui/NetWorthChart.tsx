'use client';

// The hero chart of /plan: net worth per year to the end of the plan, event markers on top, the
// retirement line, and the "AI estimate" as a separate dashed series only when the view-model says the
// line passed its checks ('shown'). Every number arrives from usePlan / useAiLine.
import { useState } from 'react';
import { plan as copy } from '@/copy';
import { Button, Card, cx } from '@/ui-kit';
import type { AiLineVM, PlanChartVM, PlanDisplay } from '../model/types';
import { EventIcon } from './EventIcon';
import { LineChart, type ChartSeries } from './LineChart';

export type NetWorthChartProps = {
  chart: PlanChartVM;
  aiLine: AiLineVM;
  display: { value: PlanDisplay; label: string; options: { value: PlanDisplay; label: string }[] };
  onDisplayChange: (d: PlanDisplay) => void;
  onOpenEvent: (id: string) => void;
  onMoveEvent: (id: string, year: number) => void;
};

export function NetWorthChart({ chart, aiLine, display, onDisplayChange, onOpenEvent, onMoveEvent }: NetWorthChartProps) {
  const t = copy.screen.chart;
  const [showTable, setShowTable] = useState(false);
  const ageOf = new Map(chart.points.map((p) => [p.year, p.age]));

  const series: ChartSeries[] = [
    {
      id: 'plan',
      label: t.yourPlan,
      color: 'var(--color-chart-1)',
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
  const retireAge = chart.retireYear !== null ? ageOf.get(chart.retireYear) : undefined;

  return (
    <Card title={t.title}>
      <div className="flex flex-col gap-md">
        <div role="group" aria-label={copy.assumptions.labels.display} className="flex w-fit rounded-md bg-surface-strong p-xs text-xs">
          {display.options.map((o) => (
            <button
              key={o.value}
              type="button"
              aria-pressed={o.value === display.value}
              onClick={() => onDisplayChange(o.value)}
              className={cx(
                'min-h-9 rounded-sm px-sm font-semibold',
                o.value === display.value ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text',
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        <LineChart
          title={t.title}
          series={series}
          xTicks={chart.xTicks.map((k) => ({ x: k.year, label: String(k.age) }))}
          xCaption={t.axisAge}
          xLabel={(year) => t.tooltipHeader(year, ageOf.get(year) ?? 0)}
          {...(chart.retireYear !== null && retireAge !== undefined ? { reference: { x: chart.retireYear, label: t.retireLine(retireAge) } } : {})}
          markers={chart.markers.map((m) => ({
            id: m.id,
            x: m.year,
            label: t.marker(m.label, m.year, m.age),
            icon: <EventIcon id={m.icon} className="size-md" />,
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
        <div>
          <Button variant="ghost" size="sm" onClick={() => setShowTable((v) => !v)} aria-expanded={showTable}>
            {showTable ? t.hideTable : t.showTable}
          </Button>
        </div>
        {showTable && (
          <div className="max-h-80 overflow-auto rounded-md border border-border">
            <table className="w-full text-sm tabular-nums">
              <thead className="sticky top-0 bg-surface-strong text-left text-xs text-text-muted">
                <tr>
                  <th scope="col" className="px-md py-sm font-medium">{t.axisYear}</th>
                  <th scope="col" className="px-md py-sm font-medium">{t.axisAge}</th>
                  <th scope="col" className="px-md py-sm text-right font-medium">{copy.screen.tables.netWorth}</th>
                </tr>
              </thead>
              <tbody>
                {chart.points.map((p) => (
                  <tr key={p.year} className="border-t border-border">
                    <td className="px-md py-xs">{p.year}</td>
                    <td className="px-md py-xs">{p.age}</td>
                    <td className={cx('px-md py-xs text-right', p.belowZero && 'text-negative')}>{p.netWorthLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}
