// @vitest-environment jsdom
// Display pieces: Stat, Tag, EstimateTag, SourceNote, Gauge, BarBreakdown, ForecastChart, Money.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { common } from '@/copy';
import { BarBreakdown } from './BarBreakdown';
import { ForecastChart } from './ForecastChart';
import { formatRate } from './format';
import { Gauge, gaugeZone } from './Gauge';
import { Money, Percent } from './Money';
import { SourceNote } from './SourceNote';
import { Stat } from './Stat';
import { Tag } from './Tag';
import { EstimateTag } from './EstimateTag';

const hud = { name: 'HUD Fair Market Rents', year: 2025, url: 'https://www.huduser.gov/portal/datasets/fmr.html' };

describe('Stat', () => {
  it('shows label, value, estimate tag and source', () => {
    render(<Stat label="Rent" value="$1,950" isEstimate source={hud} hint="per month" />);
    expect(screen.getByText('Rent')).toBeInTheDocument();
    expect(screen.getByText('$1,950')).toBeInTheDocument();
    expect(screen.getByText(common.estimateTag)).toBeInTheDocument();
    expect(screen.getByText('per month')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /HUD Fair Market Rents/ })).toHaveAttribute('href', hud.url);
  });

  it('has no estimate tag unless asked', () => {
    render(<Stat label="Cash" value="$3,800" />);
    expect(screen.queryByText(common.estimateTag)).not.toBeInTheDocument();
  });
});

describe('Tag / EstimateTag', () => {
  it('renders its text and passes attributes through, with a solid or a dashed outline', () => {
    render(
      <p>
        <Tag data-testid="solid" title="who made it">AI estimate</Tag>
        <Tag data-testid="dashed" variant="dashed" className="mt-xs">our assumption</Tag>
      </p>,
    );
    expect(screen.getByTestId('solid')).toHaveTextContent('AI estimate');
    expect(screen.getByTestId('solid')).toHaveAttribute('title', 'who made it');
    expect(screen.getByTestId('solid')).toHaveClass('border-border', 'rounded-full');
    expect(screen.getByTestId('solid')).not.toHaveClass('border-dashed');
    expect(screen.getByTestId('dashed')).toHaveClass('border-dashed', 'mt-xs');
  });

  it('EstimateTag is a dashed tag with its hint for screen readers', () => {
    render(<EstimateTag />);
    const tag = screen.getByTitle(common.estimateHint);
    expect(tag).toHaveClass('border-dashed');
    expect(tag).toHaveTextContent(`${common.estimateTag}: ${common.estimateHint}`);
  });
});

describe('SourceNote', () => {
  it('prints name and year without a link when there is no URL', () => {
    render(<SourceNote source={{ name: 'BLS CPI', year: 2025 }} />);
    expect(screen.getByText(`${common.kit.sourcePrefix} BLS CPI, 2025`)).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('toggle variant reveals the source on tap', async () => {
    const user = userEvent.setup();
    render(<SourceNote source={hud} variant="toggle" />);
    const button = screen.getByRole('button', { name: common.kit.showSource });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link')).not.toBeInTheDocument(); // hidden
    await user.click(button);
    expect(screen.getByRole('button', { name: common.kit.hideSource })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: /HUD/ })).toBeVisible();
  });
});

describe('Money / Percent', () => {
  it('formats through the shared formatters', () => {
    render(
      <p>
        <Money value={1234.5} /> <Money value={-120} signed /> <Percent value={0.228} />
      </p>,
    );
    expect(screen.getByText('$1,235')).toBeInTheDocument();
    expect(screen.getByText('−$120')).toBeInTheDocument();
    expect(screen.getByText('22.8%')).toBeInTheDocument();
  });
});

describe('Gauge', () => {
  const thresholds = { yellow: 0.2, red: 0.36 };

  it('classifies zones with the thresholds it is given', () => {
    expect(gaugeZone(0.1, thresholds)).toBe('low');
    expect(gaugeZone(0.2, thresholds)).toBe('medium');
    expect(gaugeZone(0.36, thresholds)).toBe('medium');
    expect(gaugeZone(0.37, thresholds)).toBe('high');
    // Same value, different thresholds → different zone: nothing is hardcoded in the kit.
    expect(gaugeZone(0.3, { yellow: 0.4, red: 0.5 })).toBe('low');
  });

  it('is a labelled meter that speaks its value and zone', () => {
    render(<Gauge label="Debt load" value={0.42} thresholds={thresholds} max={0.6} formatValue={(v) => formatRate(v)} />);
    const meter = screen.getByRole('meter', { name: 'Debt load' });
    expect(meter).toHaveAttribute('aria-valuenow', '0.42');
    expect(meter).toHaveAttribute('aria-valuemax', '0.6');
    expect(meter).toHaveAttribute('aria-valuetext', `42%, ${common.kit.gaugeZones.high}`);
  });

  it('pins the reading to the dial when the value is past max, and accepts custom zone words', () => {
    render(
      <Gauge
        label="Debt load"
        value={0.9}
        thresholds={thresholds}
        max={0.6}
        zoneLabels={{ high: 'Heavy' }}
        formatValue={(v) => formatRate(v)}
      />,
    );
    const meter = screen.getByRole('meter', { name: 'Debt load' });
    expect(meter).toHaveAttribute('aria-valuenow', '0.6');
    expect(within(meter).getByText('Heavy')).toBeInTheDocument();
    expect(within(meter).getByText('90%')).toBeInTheDocument();
  });
});

describe('BarBreakdown', () => {
  const items = [
    { id: 'rent', label: 'Rent + utilities', amount: 1950, source: hud },
    { id: 'groceries', label: 'Groceries', amount: 520, isEstimate: true },
    { id: 'car', label: 'Car', amount: 310, isEstimate: true },
  ];

  it('lists every item with its amount, tags estimates, and shows sources', () => {
    render(<BarBreakdown label="Monthly costs" items={items} total={2780} />);
    const list = screen.getByRole('list', { name: 'Monthly costs' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(within(rows[0]!).getByText('$1,950')).toBeInTheDocument();
    expect(within(rows[0]!).queryByText(common.estimateTag)).not.toBeInTheDocument();
    expect(within(rows[0]!).getByRole('link', { name: /HUD/ })).toBeInTheDocument();
    expect(within(rows[1]!).getByText(common.estimateTag)).toBeInTheDocument();
    expect(within(rows[2]!).getByText(common.estimateTag)).toBeInTheDocument();
    expect(screen.getByText(common.kit.breakdown.total)).toBeInTheDocument();
    expect(screen.getByText('$2,780')).toBeInTheDocument();
  });

  it('scales bars to the largest amount, or to scaleMax', () => {
    const { container, rerender } = render(<BarBreakdown label="Costs" items={items} />);
    const widths = () =>
      Array.from(container.querySelectorAll<HTMLElement>('li [style]')).map((el) => el.style.width);
    expect(widths()[0]).toBe('100%');
    expect(parseFloat(widths()[1]!)).toBeCloseTo((520 / 1950) * 100, 5);
    rerender(<BarBreakdown label="Costs" items={items} scaleMax={3900} />);
    expect(widths()[0]).toBe('50%');
  });
});

describe('ForecastChart', () => {
  const points = Array.from({ length: 121 }, (_, month) => ({
    month,
    mid: 1000 * month,
    low: 900 * month,
    high: 1100 * month,
  }));

  it('names the figure and gives screen readers a yearly table', () => {
    render(<ForecastChart title="You in 10 years" series={{ label: 'Your plan', points }} />);
    expect(screen.getByRole('figure', { name: 'You in 10 years' })).toBeInTheDocument();
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(1 + 11); // header + years 0..10
    expect(within(rows[11]!).getByRole('rowheader')).toHaveTextContent(common.kit.chart.yearLabel(10));
    expect(within(rows[11]!).getByText('$120K')).toBeInTheDocument();
    expect(within(rows[11]!).getByText(common.kit.chart.range('$108K', '$132K'))).toBeInTheDocument();
  });

  it('adds the comparison series to the legend and table', () => {
    const compare = points.map((p) => ({ ...p, mid: p.mid / 2, low: p.low / 2, high: p.high / 2 }));
    render(
      <ForecastChart
        title="Compare"
        series={{ label: 'Without the car', points }}
        compare={{ label: 'With the car', points: compare }}
      />,
    );
    expect(screen.getAllByText('With the car').length).toBeGreaterThan(0);
    expect(screen.getByRole('columnheader', { name: `With the car: ${common.kit.chart.tableMid}` })).toBeInTheDocument();
    const lastRow = screen.getAllByRole('row').at(-1)!;
    expect(within(lastRow).getByText('$60K')).toBeInTheDocument();
  });

  it('names the band with `bandLabel`, and with the default label when none is given', () => {
    const { rerender } = render(<ForecastChart title="Band" series={{ label: 'Plan', points }} />);
    expect(screen.getByText(common.kit.chart.rangeLegend)).toBeInTheDocument();
    rerender(<ForecastChart title="Band" series={{ label: 'Plan', points }} bandLabel="Range from the model" />);
    expect(screen.getByText('Range from the model')).toBeInTheDocument();
    expect(screen.queryByText(common.kit.chart.rangeLegend)).not.toBeInTheDocument();
  });

  it('can hide the bands', () => {
    render(<ForecastChart title="No band" series={{ label: 'Plan', points }} showBand={false} />);
    expect(screen.queryByText(common.kit.chart.rangeLegend)).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Range/ })).not.toBeInTheDocument();
  });
});
