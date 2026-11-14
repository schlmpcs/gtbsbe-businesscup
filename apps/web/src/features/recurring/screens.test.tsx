// @vitest-environment jsdom
// P6 Recurring screen wired to useRecurring on the fixtures.
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recurring as t } from '@/copy';
import { FIXTURE_NOW, resetFixtureStores } from '@/features/dashboard/model/resetFixtureStores';
import { formatMoney } from '@/ui-kit';
import { useRecurring } from './model/useRecurring';
import { RecurringScreen } from './ui/RecurringScreen';

const A = ({ href, children, className }: { href: string; children?: ReactNode; className?: string }) => (
  <a href={href} className={className}>
    {children}
  </a>
);
const links = { guess: '/me/guess', upload: '/me/upload' };

function Recurring() {
  return <RecurringScreen vm={useRecurring({ today: '2026-11-15' })} links={links} Link={A} />;
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FIXTURE_NOW);
  await resetFixtureStores();
});
afterEach(() => vi.useRealTimers());

describe('RecurringScreen', () => {
  it('lists pay, bills and cards with amounts and due days, and hides one', () => {
    render(<Recurring />);
    expect(screen.getByTestId('recurring-month')).toHaveTextContent('November 2026');
    const expenses = screen.getByTestId('recurring-section-expenses');
    expect(within(expenses).getByText(t.labels.rent)).toBeInTheDocument();
    expect(within(expenses).getByText(formatMoney(1950, { cents: true }))).toBeInTheDocument();
    expect(within(expenses).getAllByText(t.due(1)).length).toBeGreaterThan(0);
    expect(within(screen.getByTestId('recurring-section-income')).getByText(t.labels.takeHomePay)).toBeInTheDocument();

    fireEvent.click(within(expenses).getByRole('button', { name: t.markNotRecurringLabel(t.labels.rent) }));
    expect(within(screen.getByTestId('recurring-section-expenses')).queryByText(t.labels.rent)).toBeNull();
  });

  it('shows the month calendar with today marked', () => {
    render(<Recurring />);
    fireEvent.click(screen.getByRole('tab', { name: t.views.calendar }));
    const table = screen.getByRole('table', { name: t.calendarLabel('November 2026') });
    expect(within(table).getAllByRole('row')).toHaveLength(1 + 5); // header + five weeks
    expect(screen.getByTestId('recurring-today')).toHaveTextContent('15');
  });
});
