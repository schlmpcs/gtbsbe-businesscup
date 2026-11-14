// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { GoalCard } from './ui/GoalCard';
import type { GoalVM } from './model/types';
it('renders negative progress and unreachable saving as plain, bounded output', () => {
  const goal = { target: 100000, years: 10 };
  const vm: GoalVM = {
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
