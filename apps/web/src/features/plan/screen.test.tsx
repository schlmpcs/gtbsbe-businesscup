// @vitest-environment jsdom
// P8 /plan, P9 Compare and P10 Chance of success: the presentational screen wired to its real
// view-model hooks on the MP2 fixtures (no network, no worker).
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { plan as copy } from '@/copy';
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
  resetPlanStore();
  vi.useFakeTimers();
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

  it('shows the four rules-based KPIs, the chart with event markers and the AI estimate line', () => {
    const { container } = render(<Harness ai={{ status: 'shown' }} />);
    expect(screen.getByRole('heading', { level: 1, name: t.title })).toBeTruthy();
    const kpis = container.querySelectorAll('[data-kpi]');
    expect(kpis).toHaveLength(4);
    for (const k of kpis) expect(within(k as HTMLElement).getByText(t.kpiSource)).toBeTruthy();
    expect(within(kpis[0] as HTMLElement).getByText(copy.kpi.netWorthEndOfYear.label)).toBeTruthy();

    expect(screen.getByRole('figure', { name: t.chart.title })).toBeTruthy();
    // Markers for the fixture's events (Retire, Social Security, Buy a home).
    expect(screen.getByRole('button', { name: new RegExp(`^${copy.events.buyHome.title}, 2029`) })).toBeTruthy();
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
    // The new event is in the list.
    expect(screen.getByRole('button', { name: t.events.edit(copy.events.haveKid.title) })).toBeTruthy();
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
    expect(screen.getByTestId('chance-pct').textContent).toMatch(/%$/);
    expect(screen.getByRole('meter')).toBeTruthy();
    expect(screen.getByRole('figure', { name: t.chance.fanTitle })).toBeTruthy();
  });

  it('switches views from the view switch', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: t.views.chance }));
    expect(screen.getByRole('button', { name: t.views.chance }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByText(copy.chance.idle)).toBeTruthy();
  });
});
