// @vitest-environment jsdom
// P7 Goals screen wired to useGoals on the fixtures (the engine's goalStatus on the demo profile).
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { goals as t } from '@/copy';
import { FIXTURE_NOW, resetFixtureStores } from '@/features/dashboard/model/resetFixtureStores';
import { useGoals } from './model/useGoals';
import { GoalsScreen } from './ui/GoalsScreen';

const A = ({ href, children, className }: { href: string; children?: ReactNode; className?: string }) => (
  <a href={href} className={className}>
    {children}
  </a>
);
const links = { loan: '/loan', guess: '/me/guess', upload: '/me/upload' };

function Goals() {
  return <GoalsScreen vm={useGoals()} links={links} Link={A} />;
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FIXTURE_NOW);
  await resetFixtureStores();
});
afterEach(() => vi.useRealTimers());

function type(label: string, value: string) {
  const input = screen.getByLabelText(label);
  act(() => {
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value } });
    fireEvent.blur(input);
  });
}

describe('GoalsScreen', () => {
  it('starts empty, refuses a bad goal and adds a good one with a status and monthly saving', () => {
    render(<Goals />);
    expect(screen.getByTestId('goals-empty')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t.emptyLinks.guess })).toHaveAttribute('href', '/me/guess');

    fireEvent.click(screen.getByRole('button', { name: t.add }));
    expect(screen.getByRole('alert')).toHaveTextContent(t.invalid);

    type(t.form.name, 'Emergency fund');
    type(t.form.target, '15000');
    type(t.form.years, '3');
    fireEvent.click(screen.getByRole('button', { name: t.add }));
    const card = screen.getByTestId('goal-card');
    expect(within(card).getByRole('heading', { name: 'Emergency fund' })).toBeInTheDocument();
    expect(within(card).getByText(t.eta(3))).toBeInTheDocument();
    expect(within(card).getByText(t.monthlyToStayOnTrack)).toBeInTheDocument();
    expect(card.textContent).toMatch(new RegExp(`${t.statuses.onTrack}|${t.statuses.atRisk}`));

    fireEvent.click(within(card).getByRole('button', { name: t.removeLabel('Emergency fund') }));
    expect(screen.queryByTestId('goal-card')).toBeNull();
  });

  it('Pay down links to the Loan Lab', () => {
    render(<Goals />);
    fireEvent.click(screen.getByRole('tab', { name: t.tabs.payDown }));
    expect(within(screen.getByTestId('goals-paydown')).getByRole('link', { name: t.payDown.cta })).toHaveAttribute('href', '/loan');
  });
});
