// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { goal as goalCopy } from '@/copy';
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
  expect(screen.getByTestId('goal-verdict').textContent).toBe(goalCopy.verdictLabel.behind);
  expect(screen.getByText(goalCopy.verdict.behind)).toBeTruthy();
});

it('offers at most 3 target presets as light chips and keeps the years input (no year chips)', () => {
  const vm: GoalVM = {
    goal: null,
    setGoal: () => {},
    clearGoal: () => {},
    presets: { targets: [50000, 100000, 250000, 500000, 1000000], years: [5, 10, 15] },
    inputError: false,
    moveLabels: [],
    status: { status: 'ready', data: null },
    saving: { status: 'ready', data: null },
    moves: { status: 'ready', data: null },
  };
  render(<GoalCard vm={vm} />);
  expect(screen.getAllByRole('button', { name: /^\$[\d,]+$/ })).toHaveLength(3);
  expect(screen.queryByRole('button', { name: /years$/ })).toBeNull();
  expect(screen.getByRole('textbox', { name: goalCopy.years })).toBeTruthy();
});
