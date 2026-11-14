// @vitest-environment jsdom
// The Loan Lab page as it ships: the real payoff engine, the real tools.payoff slice of the store and the real
// wiring (nothing mocked; only the date is fixed, to 14 November 2026, so a saved target month cannot go stale).
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loan as t } from '@/copy';
import { useAppStore } from '@/state';
import { resetClientState } from '@/test/clientState';
import LoanLabPage from './page';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 14, 12));
  resetClientState();
  useAppStore.setState({ tools: {} });
  window.history.pushState({}, '', '/loan');
});
afterEach(() => {
  vi.useRealTimers();
  window.history.pushState({}, '', '/');
});

async function planner() {
  render(<LoanLabPage />);
  return screen.findByRole('region', { name: t.planner.title });
}

describe('/loan on the real engine and store', () => {
  it('shows the planner in place of the payoff order card, with the three methods side by side', async () => {
    const section = await planner();
    expect(screen.queryByRole('heading', { name: t.payoffOrder.title })).toBeNull();
    const table = within(section).getByRole('table', { name: t.planner.compare.caption });
    const debtFree = within(within(table).getByRole('row', { name: new RegExp(`^${t.planner.compare.rows.debtFree}`) })).getAllByRole('cell');
    // 43 months after November 2026, the same for all three at extra $0 (usePayoffPlanner.engine.test.ts).
    expect(debtFree.map((c) => c.textContent)).toEqual(['June 2030', 'June 2030', 'June 2030']);
    expect(section.textContent).not.toMatch(/NaN|Infinity|undefined/);
  });

  it('moves the debt-free date when the extra moves, and leaves the selected offer\'s own extra alone', async () => {
    const section = await planner();
    const before = screen.getByTestId('extra-payoff').textContent;
    fireEvent.change(within(section).getByRole('slider', { name: t.planner.extra.label }), { target: { value: '500' } });
    const table = within(section).getByRole('table', { name: t.planner.compare.caption });
    const cells = () => within(within(table).getByRole('row', { name: new RegExp(`^${t.planner.compare.rows.debtFree}`) })).getAllByRole('cell').map((c) => c.textContent);
    await waitFor(() => expect(cells()[0]).not.toBe(cells()[2]));
    expect(cells()[0]).not.toBe('June 2030'); // sooner than the minimums' June 2030
    expect(cells()[2]).toBe('June 2030'); // minimums only do not move with the extra
    expect(screen.getByTestId('extra-payoff').textContent).toBe(before);
  });

  it('saves the picks to tools.payoff, as picked, and nothing else leaves the store alone', async () => {
    const section = await planner();
    fireEvent.change(within(section).getByRole('slider', { name: t.planner.extra.label }), { target: { value: '150' } });
    fireEvent.click(within(section).getByRole('radio', { name: t.planner.method.names.snowball }));
    fireEvent.change(within(section).getByLabelText(t.planner.target.label), { target: { value: '2029-12' } });
    await waitFor(() => expect(useAppStore.getState().tools.payoff).toEqual({ method: 'snowball', extra: 150, targetMonth: '2029-12' }));
    expect(useAppStore.getState().tools.subscriptions).toBeUndefined();
    expect(useAppStore.getState().tools.overpaying).toBeUndefined();
  });

  it('restores the picks from the store as they were saved, and the target month does not move with the date', async () => {
    useAppStore.setState({ tools: { payoff: { method: 'snowball', extra: 200, targetMonth: '2029-12' } } });
    const section = await planner();
    expect(within(section).getByRole('radio', { name: t.planner.method.names.snowball })).toBeChecked();
    expect(within(section).getByRole('slider', { name: t.planner.extra.label })).toHaveValue('200');
    expect((within(section).getByLabelText(t.planner.target.label) as HTMLInputElement).value).toBe('2029-12');
    expect(screen.getByTestId('payoff-target-result').textContent).toMatch(/December 2029/);
  });

  it('is hidden in streamer mode: no numbers, nothing saved', async () => {
    window.history.pushState({}, '', '/loan?stream=1');
    const section = await planner();
    expect(within(section).getByText(t.planner.hidden)).toBeInTheDocument();
    expect(within(section).queryByRole('table')).toBeNull();
    expect(section.textContent).not.toMatch(/\$\d/);
    expect(useAppStore.getState().tools.payoff).toBeUndefined();
  });
});
