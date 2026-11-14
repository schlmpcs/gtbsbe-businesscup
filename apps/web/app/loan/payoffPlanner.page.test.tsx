// @vitest-environment jsdom
// The Loan Lab page with the debt payoff planner composed in (M13). The wiring is replaced here, as its engine is
// not bound yet: with it null the page is the one page.test.tsx covers; with options the planner takes the payoff
// order card's place and nothing else on the page changes.
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loan as t } from '@/copy';
import { plannerOptions } from '@/features/loan/model/payoffTestUtils';
import type { PayoffPlannerOptions } from '@/features/loan/model/usePayoffPlanner';
import { resetClientState } from '@/test/clientState';
import LoanLabPage from './page';

const wiring = vi.hoisted(() => ({ current: null as PayoffPlannerOptions | null }));
vi.mock('@/features/loan/model/wiring', () => ({ usePayoffWiring: () => wiring.current }));

beforeEach(() => {
  resetClientState();
  wiring.current = null;
});

async function renderReady() {
  render(<LoanLabPage />);
  await screen.findByRole('table', { name: t.compare.caption });
}

describe('/loan with the planner', () => {
  it('is today\'s page while the planner is not wired: the payoff order card, no planner', async () => {
    await renderReady();
    expect(screen.getByRole('heading', { name: t.payoffOrder.title })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: t.planner.title })).toBeNull();
  });

  it('shows the planner in place of the payoff order card, with a link to the balance sheet', async () => {
    wiring.current = plannerOptions().options;
    await renderReady();
    const section = await screen.findByRole('region', { name: t.planner.title });
    expect(screen.queryByRole('heading', { name: t.payoffOrder.title })).toBeNull();
    expect(within(section).getByRole('link', { name: t.planner.editDebts })).toHaveAttribute('href', '/me/balance');
    expect(within(section).getByRole('table', { name: t.planner.compare.caption })).toBeInTheDocument();
  });

  it('moving the planner\'s extra leaves the selected offer\'s own extra-payment result alone', async () => {
    wiring.current = plannerOptions().options;
    await renderReady();
    const before = screen.getByTestId('extra-payoff').textContent;
    fireEvent.change(await screen.findByRole('slider', { name: t.planner.extra.label }), { target: { value: '300' } });
    await waitFor(() => expect(screen.getByRole('slider', { name: t.planner.extra.label })).toHaveValue('300'));
    expect(screen.getByTestId('extra-payoff').textContent).toBe(before);
    expect(before).toBe(t.extra.payoffMonths(36));
  });
});
