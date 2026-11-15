'use client';

import { loan as t } from '@/copy';
import { formatMoney } from '@/ui-kit';
import { ToolLineChart } from '@/ui-kit/ToolLineChart';
import type { PayoffChartVM, PayoffChoice } from '../model/types';

/** Year ticks across `months` (about 4–6 labels). */
function yearTicks(months: number): number[] {
  const years = Math.max(1, Math.ceil(months / 12));
  const step = years <= 6 ? 1 : years <= 12 ? 2 : years <= 30 ? 5 : 10;
  const ticks: number[] = [];
  for (let y = 0; y <= years; y += step) ticks.push(y * 12);
  return ticks;
}

/** Total balance over time: the picked method (solid, drawn in) against minimums only (dashed). */
export function BalanceChart({ chart, method }: { chart: PayoffChartVM; method: PayoffChoice }) {
  const picked = t.planner.method.names[method];
  const start = chart.selected[0]?.balance ?? 0;
  return (
    <div className="flex flex-col gap-xs">
      <ToolLineChart
        title={t.planner.chart.title}
        summary={`${picked}: ${formatMoney(start)}`}
        series={[
          { id: 'minimum', label: t.planner.chart.minimum, tone: 'ink', dashed: true, points: chart.minimum.map((p) => ({ x: p.month, y: p.balance })) },
          { id: 'picked', label: picked, tone: 'primary', area: true, points: chart.selected.map((p) => ({ x: p.month, y: p.balance })) },
        ]}
        xTicks={yearTicks(chart.horizonMonths)}
        formatX={(m) => t.balance.tick(m)}
        formatY={(v) => formatMoney(v, { compact: true })}
      />
      <p className="text-xs text-text-muted">{t.planner.chart.footnote}</p>
    </div>
  );
}
