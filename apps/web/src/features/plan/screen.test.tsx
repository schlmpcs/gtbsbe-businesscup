// @vitest-environment jsdom
// P8 /plan, P9 Compare and P10 Chance of success: the presentational screen wired to its real
// view-model hooks on the engine: the demo profile at 2026-11 and the demo scenarios (no network).
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { plan as copy } from '@/copy';
import { useAppStore } from '@/state/store';
import { resetPlanStore } from './model/planStore';
import { useAiLine, type AiLinePreview } from './model/useAiLine';
import { useAssumptions } from './model/useAssumptions';
import { useChanceOfSuccess } from './model/useChanceOfSuccess';
import { useCompare } from './model/useCompare';
import { useEventCatalog } from './model/useEventCatalog';
import { useEventEditor } from './model/useEventEditor';
import { usePlan } from './model/usePlan';
import { usePlanMoves } from './model/usePlanMoves';
import { useScenarios } from './model/useScenarios';
import { PlanScreen, type PlanViewId } from './ui/PlanScreen';

function Harness({ initialView = 'plan', ai }: { initialView?: PlanViewId; ai?: AiLinePreview }) {
  const [view, setView] = useState<PlanViewId>(initialView);
  const scenarios = useScenarios();
  const plan = usePlan(scenarios.activeId);
  const catalog = useEventCatalog();
  const editor = useEventEditor(catalog.openEventId);
  const assumptions = useAssumptions();
  const moves = usePlanMoves();
  const aiLine = useAiLine(ai);
  const chance = useChanceOfSuccess();
  const other = scenarios.items.find((s) => s.id !== scenarios.activeId)?.id ?? null;
  const compare = useCompare(scenarios.activeId, other ?? '');
  return (
    <PlanScreen
      view={view}
      onViewChange={setView}
      plan={plan}
      scenarios={scenarios}
      catalog={catalog}
      editor={editor}
      assumptions={assumptions}
      moves={moves}
      aiLine={aiLine}
      compare={compare}
      compareWithId={other}
      onCompareWith={() => {}}
      chance={chance}
    />
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(new Date('2026-11-14T12:00:00'));
  useAppStore.getState().reset();
  resetPlanStore();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const t = copy.screen;

describe('PlanScreen', () => {
  it('draws no AI estimate line by default', () => {
    render(<Harness />);
    expect(screen.queryByText(t.chart.aiNote)).toBeNull();
  });

  it('shows the rules-based KPI strip, the chart with event markers and the AI estimate line', () => {
    const points = [{ year: 2026, netWorth: -3000 }, { year: 2030, netWorth: 60000 }];
    const { container } = render(<Harness ai={{ status: 'shown', points }} />);
    expect(screen.getByRole('heading', { level: 1, name: t.title })).toBeTruthy();
    const kpis = container.querySelectorAll('[data-kpi]');
    // Four numbers (this year, at retirement, retirement age, at the end) + the "money lasts until" pill.
    expect([...kpis].map((k) => (k as HTMLElement).dataset.kpi)).toEqual(['shortfall', 'netWorthEndOfYear', 'netWorthAtRetirement', 'retireAge', 'netWorthAtEnd']);
    for (const k of kpis) expect(within(k as HTMLElement).getByText(t.kpiSource)).toBeTruthy();
    expect(within(container.querySelector('[data-kpi="netWorthEndOfYear"]') as HTMLElement).getByText(copy.kpi.netWorthEndOfYear.label)).toBeTruthy();
    expect(within(container.querySelector('[data-kpi="retireAge"]') as HTMLElement).getByText(t.kpis.retireAgeValue(67))).toBeTruthy();

    expect(screen.getByRole('figure', { name: t.chart.title })).toBeTruthy();
    // Markers for the demo scenario's events (Retire, Social Security, Buy a home).
    expect(screen.getByRole('button', { name: new RegExp(`^${copy.events.buyHome.title}, 2032`) })).toBeTruthy();
    // The AI line is a separate, labeled series.
    expect(screen.getByText(copy.aiLine.label)).toBeTruthy();
    expect(screen.getByText(t.chart.aiNote)).toBeTruthy();
  });

  it('hides the AI line when the view-model rejects it', () => {
    render(<Harness ai={{ status: 'rejected', reason: 'outsideBand' }} />);
    expect(screen.queryByText(t.chart.aiNote)).toBeNull();
    expect(screen.getByText(new RegExp(copy.aiLine.rejected.outsideBand))).toBeTruthy();
    // Only one series: no legend entry for the AI estimate.
    expect(screen.queryByText(copy.aiLine.label, { selector: 'span.text-text' })).toBeNull();
  });

  it('ranks Next Moves in dollars and adds one to the plan', () => {
    const { container } = render(<Harness />);
    const moves = container.querySelectorAll('[data-move]');
    expect(moves.length).toBeGreaterThan(0);
    const first = moves[0] as HTMLElement;
    fireEvent.click(within(first).getByRole('button', { name: t.moves.add }));
    expect(within(container.querySelector(`[data-move="${first.dataset.move}"]`) as HTMLElement).getByText(copy.moves.added)).toBeTruthy();
  });

  it('adds an event from the catalog and opens its editor', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: t.events.add }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(copy.events.haveKid.title) }));
    expect(screen.getByText(copy.editor.fields.childcareMonthly!)).toBeTruthy();
    expect(screen.getByRole('heading', { name: t.editor.previewTitle })).toBeTruthy();
    // The new event is in the list (Events tab).
    fireEvent.click(screen.getByRole('tab', { name: t.tabs.events }));
    expect(screen.getByRole('button', { name: t.events.edit(copy.events.haveKid.title) })).toBeTruthy();
  });

  it('year-by-year table: years as columns, Assets opens into groups and accounts', () => {
    render(<Harness />);
    const table = screen.getByRole('region', { name: t.tabs.accounts });
    expect(within(table).getByRole('columnheader', { name: /2026/ })).toBeTruthy();
    expect(within(table).getByRole('rowheader', { name: t.tables.netWorth })).toBeTruthy();
    // Assets is open; its groups are closed until clicked.
    const cash = within(table).getByRole('button', { name: t.tables.expand(copy.groups.cash) });
    fireEvent.click(cash);
    expect(within(table).getByRole('button', { name: t.tables.collapse(copy.groups.cash) }).getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(within(table).getByRole('button', { name: t.tables.collapse(copy.tables.accounts.assets) }));
    expect(within(table).queryByRole('button', { name: t.tables.collapse(copy.groups.cash) })).toBeNull();
  });

  it('Assumptions panel: collapsible sections and an inflation slider that writes the assumption', () => {
    render(<Harness />);
    const panel = screen.getByRole('complementary', { name: t.assumptions.title });
    for (const title of [t.assumptions.timelineTitle, t.assumptions.inflationTitle, t.assumptions.growthTitle]) {
      expect(within(panel).getByText(title)).toBeTruthy();
    }
    const slider = within(panel).getByRole('slider', { name: new RegExp(t.assumptions.inflationSlider) });
    fireEvent.change(slider, { target: { value: '0.04' } });
    expect((within(panel).getByRole('slider', { name: new RegExp(t.assumptions.inflationSlider) }) as HTMLInputElement).value).toBe('0.04');
  });

  it('links "Check a decision" to /afford and /loan', () => {
    render(<Harness />);
    expect(screen.getByRole('link', { name: new RegExp(t.decisions.afford.title) }).getAttribute('href')).toBe('/afford');
    expect(screen.getByRole('link', { name: new RegExp(t.decisions.loan.title) }).getAttribute('href')).toBe('/loan');
  });

  it('Compare view: the sentence and the difference table', () => {
    const { container } = render(<Harness initialView="compare" />);
    expect(screen.getByTestId('compare-sentence').textContent).toMatch(/Baseline/);
    expect(container.querySelectorAll('[data-diff]')).toHaveLength(3);
  });

  it('Chance view: idle, then a run shows the percentage and the fan', () => {
    render(<Harness initialView="chance" />);
    expect(screen.getByText(copy.chance.idle)).toBeTruthy();
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: t.chance.run }));
    });
    expect(screen.getByText(copy.chance.running)).toBeTruthy();
    act(() => void vi.advanceTimersByTime(0));
    expect(screen.getByTestId('chance-pct').textContent).toMatch(/%$/);
    expect(screen.getByRole('meter')).toBeTruthy();
    expect(screen.getByRole('figure', { name: t.chance.fanTitle })).toBeTruthy();
    // Three histograms, each with the plan's own value; settings live in the side panel.
    const hist = document.querySelectorAll('[data-histogram]');
    expect(hist).toHaveLength(3);
    expect(within(hist[0] as HTMLElement).getByText(/^Plan \$/)).toBeTruthy();
    expect(screen.getByRole('complementary', { name: t.chance.settingsTitle })).toBeTruthy();
    // Range mode swaps the sampled paths for the p10–p90 band.
    fireEvent.click(screen.getByRole('button', { name: t.chance.modes.range }));
    expect(screen.getByText(t.chance.band)).toBeTruthy();
  });

  it('switches views from the view switch', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: t.views.chance }));
    expect(screen.getByRole('button', { name: t.views.chance }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByText(copy.chance.idle)).toBeTruthy();
  });
});
