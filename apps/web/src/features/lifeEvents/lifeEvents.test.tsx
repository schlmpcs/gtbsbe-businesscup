// @vitest-environment jsdom
// The life events screen on the real view-model, engine and area data (demo profile, Dallas).
import { lifeEvents } from '@lifeguessr/engine';
import { areaData } from '@lifeguessr/data/areas';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { lifeEvents as t } from '@/copy';
import { cloneProfileDemo } from '@/fixtures';
import { areaForZip } from '@/lib/areas';
import { formatMoney } from '@/ui-kit';
import { computeLifeEvents, newEvent } from './model/compute';
import { useLifeEvents } from './model/useLifeEvents';
import { LifeEventsScreen } from './ui/LifeEventsScreen';

const YEAR = 2026;

function Harness() {
  return <LifeEventsScreen vm={useLifeEvents(cloneProfileDemo(), { currentYear: YEAR })} />;
}

describe('computeLifeEvents', () => {
  const profile = cloneProfileDemo();
  const home = areaForZip(profile.zip)!;

  it('shows the engine’s numbers as effects (a cost is negative) and marks starting values as estimates', () => {
    const baby = newEvent('baby', 'b', [], home.metro);
    const car = newEvent('car', 'c', [], home.metro);
    const r = computeLifeEvents({ profile, events: [baby, car], edited: new Set(), home, areas: areaData, currentYear: YEAR });
    const engine = lifeEvents(profile, [baby, car], { home, areas: areaData, rates: { inflationAnnual: home.cpiYoY.value } });
    expect(r.result!.delta).toBe(engine.delta);
    expect(r.events[0]!.monthlyEffect).toBe(-engine.events[0]!.monthly);
    expect(r.events[0]!.calendarYear).toBe(YEAR + 2);
    expect(r.events[1]!.oneOffEffect).toBe(-3_000);
    expect(r.events[1]!.isEstimate).toBe(true);
    const edited = computeLifeEvents({ profile, events: [car], edited: new Set(['c']), home, areas: areaData, currentYear: YEAR });
    expect(edited.events[0]!.isEstimate).toBe(engine.events[1]!.isEstimate);
  });

  it('a move goes to the first other metro; invalid numbers give no result instead of throwing', () => {
    const metros = [{ zip: home.zip, metro: home.metro }, { zip: '77008', metro: 'Houston, TX' }];
    expect(newEvent('move', 'm', metros, home.metro)).toMatchObject({ kind: 'move', toZip: '77008' });
    const bad = { id: 'x', kind: 'purchase' as const, startYear: 1, amount: -1 };
    expect(computeLifeEvents({ profile, events: [bad], edited: new Set(), home, areas: areaData, currentYear: YEAR }).result).toBeNull();
  });
});

describe('LifeEventsScreen', () => {
  it('adds a baby, shows the delta and the per-event line with its source, and moves it by year', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(t.title);
    expect(screen.getByText(t.result.noEvents)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.picker.add(t.kinds.baby) }));
    const delta = screen.getByTestId('life-delta');
    expect(delta.textContent).toMatch(/^−\$[\d,]+ in 10 years$/);
    const line = screen.getByTestId('life-event-line');
    expect(within(line).getByText(new RegExp(`^Baby in ${YEAR + 2}: −\\$[\\d,]+/mo$`))).toBeInTheDocument();
    expect(within(line).getByText(/^Childcare: −\$/)).toBeInTheDocument();

    // The year select moves the chip; a later baby costs less in 10 years.
    const before = delta.textContent;
    await user.selectOptions(screen.getByRole('combobox', { name: t.edit.year }), '5');
    expect(within(screen.getByTestId('life-event-line')).getByText(new RegExp(`^Baby in ${YEAR + 5}:`))).toBeInTheDocument();
    expect(screen.getByTestId('life-delta').textContent).not.toBe(before);

    // Arrow keys on the chip move it too.
    const chip = screen.getByTestId('life-chip');
    chip.focus();
    await user.keyboard('{ArrowRight}');
    expect(within(screen.getByTestId('life-event-line')).getByText(new RegExp(`^Baby in ${YEAR + 6}:`))).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.edit.remove }));
    expect(screen.queryByTestId('life-chip')).toBeNull();
    expect(screen.getByText(t.result.noEvents)).toBeInTheDocument();
  });

  it('a raise is a positive delta', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: t.picker.add(t.kinds.raise) }));
    expect(screen.getByTestId('life-delta').textContent).toMatch(/^\+\$[\d,]+ in 10 years$/);
    expect(formatMoney(1, { signed: true })).toBe('+$1');
  });
});
