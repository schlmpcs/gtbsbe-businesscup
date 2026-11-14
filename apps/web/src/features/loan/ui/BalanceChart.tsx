'use client';

import { loan as t } from '@/copy';
import { ForecastChart } from '@/ui-kit';
import type { PayoffChartVM, PayoffChoice } from '../model/types';

/** A balance as the chart wrapper's point: the wrapper draws a mid line with a band, and the band is off. */
const toPoints = (points: PayoffChartVM['selected']) => points.map((p) => ({ month: p.month, low: p.balance, mid: p.balance, high: p.balance }));

/**
 * Total balance over time, the picked method (solid) against minimums only (dashed), through the chart wrapper.
 * The wrapper draws two series; the designer's three-line version replaces this one.
 */
export function BalanceChart({ chart, method }: { chart: PayoffChartVM; method: PayoffChoice }) {
  return (
    <ForecastChart
      title={t.planner.chart.title}
      showBand={false}
      series={{ label: t.planner.method.names[method], points: toPoints(chart.selected) }}
      compare={{ label: t.planner.chart.minimum, points: toPoints(chart.minimum) }}
      footnote={t.planner.chart.footnote}
    />
  );
}
