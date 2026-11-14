// @vitest-environment jsdom
// P4 Cash Flow screen wired to useCashFlow on the fixture ledger (2026-07 to 2026-11).
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cashflow as t, planner } from '@/copy';
import { FIXTURE_NOW, resetFixtureStores } from '@/features/dashboard/model/resetFixtureStores';
import { ledger } from '@/features/transactions/model/transactionsStore';
import { formatMoney } from '@/ui-kit';
import { useCashFlow } from './model/useCashFlow';
import { CashFlowScreen } from './ui/CashFlowScreen';

const A = ({ href, children, className }: { href: string; children?: ReactNode; className?: string }) => (
  <a href={href} className={className}>
    {children}
  </a>
);
const links = { guess: '/me/guess', upload: '/me/upload' };

function CashFlow() {
  return <CashFlowScreen vm={useCashFlow({ today: '2026-11-15' })} links={links} Link={A} />;
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FIXTURE_NOW);
  await resetFixtureStores();
});
afterEach(() => vi.useRealTimers());

describe('CashFlowScreen', () => {
  it('shows the KPIs, six monthly bars and the category breakdown', () => {
    render(<CashFlow />);
    const kpis = screen.getByTestId('cashflow-kpis');
    expect(within(kpis).getByText(formatMoney(2400))).toBeInTheDocument(); // November income
    expect(within(kpis).getByText(formatMoney(-144.96))).toBeInTheDocument(); // savings
    expect(screen.getAllByTestId('cashflow-bar')).toHaveLength(6);
    const breakdown = screen.getByRole('list', { name: t.breakdownLabel });
    expect(within(breakdown).getByText(new RegExp(planner.categories.rentUtilities))).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(t.periods.quarterly));
    expect(screen.getAllByTestId('cashflow-bar')).toHaveLength(4);
  });

  it('draws the Sankey from the engine links', () => {
    render(<CashFlow />);
    fireEvent.click(screen.getByLabelText(t.views.sankey));
    const svg = screen.getByTestId('cashflow-sankey');
    expect(svg).toHaveAttribute('role', 'img');
    // November spends more than came in, so the gap flows from savings.
    expect(within(svg).getByText(t.nodes.fromSavings)).toBeInTheDocument();
    expect(within(svg).getByText(planner.categories.rentUtilities)).toBeInTheDocument();
  });

  it('points to import when there are no transactions', async () => {
    await ledger().clear();
    render(<CashFlow />);
    expect(screen.getByTestId('cashflow-empty')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t.emptyLinks.upload })).toHaveAttribute('href', '/me/upload');
  });
});
