// @vitest-environment jsdom
// P1 Dashboard screen wired to useDashboard on the fixtures (accounts, November 2026 ledger, demo profile).
import { useAppStore } from '@/state/store';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dashboard as t, planner } from '@/copy';
import { useAccountsStore } from '@/lib/model/accounts';
import { usePlanStore } from '@/features/plan/model/planStore';
import { useBudgetStore } from '@/features/budget/model/budgetStore';
import { formatMoney, formatRate } from '@/ui-kit';
import { FIXTURE_NOW, resetFixtureStores } from './model/resetFixtureStores';
import { useDashboard } from './model/useDashboard';
import { DashboardScreen } from './ui/DashboardScreen';

const A = ({ href, children, className, 'aria-label': label }: { href: string; children?: ReactNode; className?: string; 'aria-label'?: string }) => (
  <a href={href} className={className} aria-label={label}>
    {children}
  </a>
);

function Dashboard() {
  return <DashboardScreen vm={useDashboard({ today: '2026-11-15', now: new Date(2026, 10, 15, 9) })} Link={A} />;
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FIXTURE_NOW);
  await resetFixtureStores();
});
afterEach(() => vi.useRealTimers());

describe('DashboardScreen', () => {
  it('shows every widget from the fixtures, with links to the full screens', () => {
    render(<Dashboard />);
    expect(screen.getByRole('heading', { level: 1, name: t.title })).toBeInTheDocument();
    expect(screen.getByText(t.greeting.morning)).toBeInTheDocument();
    for (const title of [t.plan, t.netWorth, t.spending, t.budget, t.recurring, t.recent, t.goals, t.duel]) {
      expect(screen.getByRole('heading', { level: 2, name: title })).toBeInTheDocument();
    }
    expect(screen.getByTestId('dashboard-net-worth-value')).toHaveTextContent(formatMoney(-5900));
    expect(screen.getByTestId('dashboard-spending-value')).toHaveTextContent(formatMoney(2544.96));
    expect(screen.getByRole('link', { name: t.seeAllLabel(t.screens.accounts) })).toHaveAttribute('href', '/accounts');
    expect(screen.getByRole('link', { name: t.seeAllLabel(t.screens.cashFlow) })).toHaveAttribute('href', '/cashflow');
    expect(screen.getByRole('link', { name: t.open })).toHaveAttribute('href', '/plan');
    expect(screen.getByRole('link', { name: t.duelPlay })).toHaveAttribute('href', '/play');
    expect(within(screen.getByTestId('dashboard-recent')).getAllByRole('listitem')).toHaveLength(5);
    // Recurring: the loan and card payments on the 20th.
    expect(screen.getByText(t.recurringRemaining(formatMoney(605.92)))).toBeInTheDocument();
    // No budget and no goals yet: empty states with one button each.
    expect(within(screen.getByTestId('dashboard-budget')).getByRole('link', { name: t.budgetEmpty.cta })).toHaveAttribute('href', '/budget');
    expect(within(screen.getByTestId('dashboard-goals')).getByRole('link', { name: t.goalsEmpty.cta })).toHaveAttribute('href', '/goals');
  });

  it('shows the real Chance of success once the run is done', async () => {
    render(<Dashboard />);
    expect(within(screen.getByTestId('dashboard-chance')).getByText(t.chanceRunning)).toBeInTheDocument();
    const meter = await screen.findByRole('meter', { name: t.chance }, { timeout: 10_000 });
    const rate = usePlanStore.getState().chanceResult!.successRate;
    expect(meter).toHaveAttribute('aria-valuetext', formatRate(rate, 0));
  });

  it('computes the checklist from the stores and can be dismissed', () => {
    useAppStore.setState({ profileOrigin: 'user' });
    render(<Dashboard />);
    const card = screen.getByTestId('dashboard-checklist');
    expect(within(card).getByText('3/6')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: t.checklist.setBudget })).toHaveAttribute('href', '/budget');
    act(() => useBudgetStore.getState().create({ rentUtilities: 1950, car: 310, childcare: 0, groceries: 520, eatingOut: 340, subscriptions: 85, debtPayments: 0, other: 450 }, 5200));
    expect(within(card).getByText('4/6')).toBeInTheDocument();
    // The budget card now shows planned vs actual by group.
    const budget = screen.getByTestId('dashboard-budget');
    expect(within(budget).getByText(planner.budgetGroups.essentials)).toBeInTheDocument();
    fireEvent.click(within(card).getByRole('button', { name: t.dismissLabel }));
    expect(screen.queryByTestId('dashboard-checklist')).toBeNull();
  });

  it('switches the net worth period and shows empty states without accounts', async () => {
    render(<Dashboard />);
    const nw = screen.getByTestId('dashboard-net-worth');
    fireEvent.click(within(nw).getByRole('button', { name: t.netWorthPeriodNames['12m'] }));
    expect(within(nw).getByRole('button', { name: t.netWorthPeriodNames['12m'] })).toHaveAttribute('aria-pressed', 'true');
    expect(within(nw).getByText(t.netWorthChange(formatMoney(15300, { signed: true }), t.netWorthPeriodNames['12m']))).toBeInTheDocument();
    act(() => useAccountsStore.setState({ accounts: [] }));
    await waitFor(() => expect(within(screen.getByTestId('dashboard-net-worth')).getByRole('link', { name: t.netWorthEmpty.cta })).toHaveAttribute('href', '/accounts?add=1'));
  });
});
