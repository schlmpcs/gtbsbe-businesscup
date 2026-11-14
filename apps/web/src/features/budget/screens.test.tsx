// @vitest-environment jsdom
// P5 Budget screen wired to useBudget on the fixtures (demo profile, November 2026 ledger).
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { budget as t, planner } from '@/copy';
import { FIXTURE_NOW, resetFixtureStores } from '@/features/dashboard/model/resetFixtureStores';
import { formatMoney } from '@/ui-kit';
import { useBudget } from './model/useBudget';
import { BudgetScreen } from './ui/BudgetScreen';

const A = ({ href, children, className }: { href: string; children?: ReactNode; className?: string }) => (
  <a href={href} className={className}>
    {children}
  </a>
);
const links = { guess: '/me/guess', upload: '/me/upload' };

function Budget() {
  return <BudgetScreen vm={useBudget({ today: '2026-11-15' })} links={links} Link={A} />;
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FIXTURE_NOW);
  await resetFixtureStores();
});
afterEach(() => vi.useRealTimers());

describe('BudgetScreen', () => {
  it('shows the create state, then planned vs actual by group after creating a budget', () => {
    render(<Budget />);
    expect(screen.getByTestId('budget-period')).toHaveTextContent('November 2026');
    expect(screen.getByTestId('budget-empty')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t.emptyLinks.guess })).toHaveAttribute('href', '/me/guess');

    fireEvent.click(screen.getByRole('button', { name: t.create }));
    expect(screen.queryByTestId('budget-empty')).toBeNull();
    for (const g of Object.values(planner.budgetGroups)) expect(screen.getByRole('heading', { name: g })).toBeInTheDocument();
    // Planned total 3655 a month (the demo profile's spending).
    expect(within(screen.getByTestId('budget-totals')).getByText(formatMoney(3655))).toBeInTheDocument();
    const rent = screen.getByTestId('budget-row-rentUtilities');
    expect(rent).toHaveTextContent(t.ofPlanned(formatMoney(1883.15), formatMoney(1950)));
    expect(rent).toHaveTextContent(t.statuses.onPace);
  });

  it('edits a planned amount and switches to the year', () => {
    render(<Budget />);
    fireEvent.click(screen.getByRole('button', { name: t.create }));
    const input = screen.getByRole('textbox', { name: t.editPlanned(planner.categories.groceries) });
    act(() => {
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '400' } });
      fireEvent.blur(input);
    });
    expect(screen.getByTestId('budget-row-groceries')).toHaveTextContent(t.ofPlanned(formatMoney(169.47), formatMoney(400)));

    fireEvent.click(screen.getByLabelText(t.modes.year));
    expect(screen.getByTestId('budget-period')).toHaveTextContent('2026');
    expect(screen.queryByRole('textbox', { name: t.editPlanned(planner.categories.groceries) })).toBeNull();
  });
});
