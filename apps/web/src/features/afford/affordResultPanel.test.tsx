// @vitest-environment jsdom
// S11 result panel: the with / without numbers say who made them (the rules engine, never the AI model).
import type { ForecastPoint } from '@lifeguessr/types';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { afford, forecast } from '@/copy';
import type { AffordResultVM } from './model/types';
import { AffordResultPanel } from './ui/AffordResultPanel';

const point = (month: number, mid: number): ForecastPoint => ({ month, low: mid - 10, mid, high: mid + 10 });
const points = (base: number): ForecastPoint[] => Array.from({ length: 121 }, (_, m) => point(m, base + m * 100));

const data: AffordResultVM = {
  verdict: 'fits',
  waitMonths: null,
  failsOn: null,
  baselineFails: false,
  cheapestWay: 'cash',
  todaysDollars: false,
  forecastSource: 'rules',
  withPoints: points(1000),
  withoutPoints: points(1200),
  horizons: ([1, 12, 60, 120] as const).map((month) => ({
    month, with: point(month, 1000), without: point(month, 1200), deltaMid: -200,
  })),
};

describe('AffordResultPanel', () => {
  it('labels the chart and the horizon numbers with the rules-based source', () => {
    render(
      <AffordResultPanel
        result={{ status: 'ready', data }}
        rules={{ cushionMonths: 1, debtLoadRed: 0.36 }}
        invalidFields={[]}
        purchaseLabel="Laptop"
        chosenWay="cash"
      />,
    );
    for (const card of [screen.getByTestId('afford-chart'), screen.getByTestId('afford-horizons')]) {
      expect(within(card).getByTestId('afford-forecast-source')).toHaveTextContent(forecast.source.rules);
    }
    expect(screen.getAllByTestId('afford-forecast-source')).toHaveLength(2);
    expect(within(screen.getByTestId('afford-chart')).getByRole('figure', { name: afford.result.chartTitle('Laptop') })).toBeInTheDocument();
    expect(within(screen.getByTestId('afford-horizons')).getByRole('table', { name: afford.result.horizonsCaption })).toBeInTheDocument();
  });
});
