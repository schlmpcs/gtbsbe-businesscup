// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { spend as t } from '@/copy';
import { spendChart } from './model/useSpend';
import type { QuickAddVM, SpendSummaryVM, SpendVM } from './model/types';
import { SpendScreen } from './ui/SpendScreen';

const summary: SpendSummaryVM = {
  month: '2026-11', day: 14, spent: 87, usual: 3655, usualFromHistory: false, projected: 2531, safeToday: 71.94,
  daysLeft: 17, billsDue: 2345, remaining: 1223, everydayBudget: 1310, leftShare: 1223 / 1310, pacePerDay: 1310 / 30,
  daysInMonth: 30, entryCount: 1,
};

const quickAdd = {
  ready: true, text: '', setText: vi.fn(), submit: vi.fn(), status: 'idle', error: null, draftSource: null, drafts: [],
  setDraftCategory: vi.fn(), confirm: vi.fn(), cancel: vi.fn(), categories: ['groceries'], presets: [], addPreset: vi.fn(),
  lastAdded: null, undo: vi.fn(), speech: { supported: false, listening: false, error: false, toggle: vi.fn() },
} satisfies QuickAddVM;

const vm = (over: Partial<SpendVM> = {}): SpendVM => {
  const days = [{ date: '2026-11-14', day: 14, total: 87, entries: [{ id: 'a', category: 'groceries' as const, amount: 87, label: 'groceries' }] }];
  const { chart, chartMax } = spendChart(summary, days);
  return {
    status: 'ready', summary: { status: 'ready', data: summary }, days, chart, chartMax,
    byCategory: [{ category: 'groceries', amount: 87, share: 1 }], remove: vi.fn(), quickAdd, ...over,
  };
};

describe('SpendScreen', () => {
  it('shows the safe-to-spend ring, the month KPIs, a bar per day with the pace line, and no "Back home" link', () => {
    render(<SpendScreen vm={vm()} />);
    expect(screen.getByTestId('spend-safe')).toHaveTextContent('$72');
    expect(screen.getByTestId('spend-spent')).toHaveTextContent('$87');
    expect(screen.getByText(t.safe.left('$1,223', '$1,310'))).toBeInTheDocument();
    expect(screen.getByText(t.chart.pace('$44'))).toBeInTheDocument();
    expect(screen.getByTestId('spend-chart').querySelectorAll('[title]')).toHaveLength(30);
    expect(screen.queryByText(/Back to Home/)).toBeNull();
  });

  it('an empty month shows the empty state instead of the lists', () => {
    render(<SpendScreen vm={vm({ days: [], byCategory: [] })} />);
    expect(screen.getByTestId('spend-empty')).toHaveTextContent(t.empty.title);
    expect(screen.queryByTestId('spend-days')).toBeNull();
  });
});
