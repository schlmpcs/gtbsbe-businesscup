// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { goal as copy } from '@/copy';
import { GoalCard } from './ui/GoalCard';
import type { GoalVM } from './model/types';
it('renders negative progress and unreachable saving as plain, bounded output', () => {
  const goal = { target: 100000, years: 10 };
  const vm: GoalVM = {
    access: 'open',
    proHref: '/pro',
    goal,
    setGoal: () => {},
    clearGoal: () => {},
    presets: { targets: [50000, 100000], years: [5, 10] },
    inputError: false,
    moveLabels: [],
    status: {
      status: 'ready',
      data: {
        goal,
        projected: { month: 120, mid: -10000, low: -20000, high: -1000 },
        gap: 110000,
        progress: -0.1,
        verdict: 'behind',
      },
    },
    saving: { status: 'ready', data: { extraMonthly: 0, reachable: false } },
    moves: { status: 'ready', data: null },
  };
  render(<GoalCard vm={vm} />);
  expect(screen.getByRole('progressbar').getAttribute('value')).toBe('0');
  expect(screen.getByText(/not projected to be reachable/)).toBeTruthy();
  expect(screen.getByText(/Behind:/)).toBeTruthy();
});

it('shows the Pro lock instead of the goal editor for free users, and a quiet line while Pro is unknown', () => {
  const base: GoalVM = {
    access: 'locked',
    proHref: '/pro',
    goal: null,
    setGoal: () => {},
    clearGoal: () => {},
    presets: { targets: [50000], years: [10] },
    inputError: false,
    moveLabels: [],
    status: { status: 'ready', data: null },
    saving: { status: 'ready', data: null },
    moves: { status: 'ready', data: null },
  };
  const { rerender } = render(<GoalCard vm={base} />);
  expect(screen.getByRole('heading', { name: copy.lock.title })).toBeTruthy();
  expect(screen.getByRole('link', { name: copy.lock.cta }).getAttribute('href')).toBe('/pro');
  expect(screen.queryByRole('button', { name: copy.start })).toBeNull();
  rerender(<GoalCard vm={{ ...base, access: 'loading' }} />);
  expect(screen.getByText(copy.checkingPro)).toBeTruthy();
  expect(screen.queryByRole('heading', { name: copy.lock.title })).toBeNull();
});
