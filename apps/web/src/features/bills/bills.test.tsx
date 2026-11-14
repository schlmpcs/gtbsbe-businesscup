// @vitest-environment jsdom
// The bills calendar end to end in the browser layer: the view-model hook on the real store, and the
// screen rendered from it.
import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { bills as t } from '@/copy';
import { cloneProfileDemo } from '@/fixtures';
import { subscriptionsExpected } from '@/fixtures/tools';
import { useAppStore } from '@/state';
import { resetClientState, waitForReady } from '@/test/clientState';
import { useBills, useNextBill } from './model/useBills';
import type { BillsVM } from './model/types';
import { BillsScreen } from './ui/BillsScreen';

// Saturday 14 November 2026, local noon.
const NOW = new Date(2026, 10, 14, 12);

const A = ({ href, className, children }: { href: string; className?: string; children?: ReactNode }) => (
  <a href={href} className={className}>
    {children}
  </a>
);

function seedUser() {
  useAppStore.setState({ profile: cloneProfileDemo(), profileOrigin: 'user' });
}

function seedAudit() {
  useAppStore.getState().setTool('subscriptions', {
    ticks: [],
    confirmed: [],
    dismissed: ['apple-com-bill'],
    cancelMarked: [],
    audit: structuredClone(subscriptionsExpected) as never,
  });
}

type Ready = Extract<BillsVM, { status: 'ready' }>;

async function ready(): Promise<{ current: Ready }> {
  const hook = renderHook(() => useBills({ now: NOW }));
  await waitForReady(hook.result);
  expect(hook.result.current.status).toBe('ready');
  return hook.result as { current: Ready };
}

beforeEach(resetClientState);

describe('useBills', () => {
  it('is empty with nothing of the user’s yet, and points to the statement upload', async () => {
    const { result } = renderHook(() => useBills({ now: NOW }));
    await waitForReady(result);
    expect(result.current).toEqual({ status: 'empty', uploadHref: '/me/upload' });
  });

  it('shows only the statement’s subscriptions while the profile is still the starting one', async () => {
    seedAudit();
    const r = await ready();
    expect(r.current.bills.every((b) => b.kind === 'subscription')).toBe(true);
    // Apple was dismissed in the audit: not a bill.
    expect(r.current.bills.map((b) => b.label)).not.toContain('Apple');
  });

  it('builds the month from rent, debts and subscriptions', async () => {
    seedUser();
    seedAudit();
    const r = await ready();
    const vm = r.current;
    expect(vm.month.month).toBe('2026-11');
    expect(vm.month.weeks).toHaveLength(5);
    const labels = vm.month.charges.map((c) => `${c.date.day} ${c.bill.label}`);
    expect(labels).toEqual(expect.arrayContaining(['1 Rent & utilities', '7 Netflix', '20 Credit card payment', '20 Car loan payment']));
    // The yearly Prime charge is not in November.
    expect(vm.month.charges.some((c) => c.bill.cadence === 'yearly')).toBe(false);
    const sum = vm.month.charges.reduce((s, c) => s + c.bill.amount, 0);
    expect(vm.month.total).toBeCloseTo(sum, 6);
    expect(vm.month.totalIsEstimate).toBe(true); // the card minimum is our estimate
    // Today is the 14th: the 7-day window is 14-20 November; the 1st/15th paydays → next is the 15th.
    expect(vm.soon.charges.map((c) => c.bill.label)).toEqual(['Car loan payment', 'Credit card payment']);
    expect(vm.paydays).toEqual({ days: [1, 15], isEstimate: true });
    expect(vm.beforePayday!.payday.iso).toBe('2026-11-15');
    expect(vm.beforePayday!.charges).toEqual([]);
  });

  it('a due day the user sets is saved, moves the bill and is no longer an estimate', async () => {
    seedUser();
    const r = await ready();
    expect(r.current.bills.find((b) => b.id === 'rent')).toMatchObject({ dueDay: 1, dueDayIsEstimate: true, dueDaySetByUser: false });
    act(() => r.current.setDueDay('rent', 14));
    expect(r.current.bills.find((b) => b.id === 'rent')).toMatchObject({ dueDay: 14, dueDayIsEstimate: false, dueDaySetByUser: true });
    expect(r.current.soon.charges[0]!.bill.id).toBe('rent');
    expect(r.current.soon.charges[0]!.isToday).toBe(true);
    expect(useAppStore.getState().bills.dueDays).toEqual({ rent: 14 });
    act(() => r.current.setPaydays([20]));
    expect(r.current.paydays).toEqual({ days: [20], isEstimate: false });
    expect(r.current.beforePayday!.charges.map((c) => c.bill.id)).toEqual(['rent']);
  });

  it('moves between months; a due day of 31 lands on the last day of February', async () => {
    seedUser();
    const r = await ready();
    act(() => r.current.setDueDay('rent', 31));
    act(() => r.current.nextMonth());
    act(() => r.current.nextMonth());
    act(() => r.current.nextMonth());
    expect(r.current.month.month).toBe('2027-02');
    expect(r.current.month.isCurrent).toBe(false);
    expect(r.current.month.charges.find((c) => c.bill.id === 'rent')!.date.day).toBe(28);
    act(() => r.current.thisMonth());
    expect(r.current.month.month).toBe('2026-11');
    expect(r.current.month.charges.find((c) => c.bill.id === 'rent')!.date.day).toBe(30);
  });
});

describe('useNextBill', () => {
  it('is null with nothing known, else the next charge and how many days away', async () => {
    const empty = renderHook(() => useNextBill(NOW));
    expect(empty.result.current).toBeNull();
    seedUser();
    const { result } = renderHook(() => useNextBill(NOW));
    await act(async () => {});
    expect(result.current).toMatchObject({ inDays: 6, date: { iso: '2026-11-20' } });
  });
});

describe('BillsScreen', () => {
  function Connected() {
    return <BillsScreen vm={useBills({ now: NOW })} Link={A} />;
  }

  it('shows the empty state with a link to the statement upload', async () => {
    render(<Connected />);
    expect(await screen.findByRole('link', { name: t.empty.upload })).toHaveAttribute('href', '/me/upload');
  });

  it('shows the grid, the next 7 days, the month total and edits a due day inline', async () => {
    seedUser();
    seedAudit();
    render(<Connected />);
    const grid = await screen.findByRole('table', { name: t.month.gridLabel('November 2026') });
    expect(within(grid).getAllByRole('columnheader')).toHaveLength(7);
    expect(screen.getAllByTestId('bills-day').length).toBeGreaterThan(3);
    const soon = screen.getByTestId('bills-soon-list');
    expect(within(soon).getByText(t.soon.line('Fri', 20, 'Credit card payment'))).toBeInTheDocument();
    expect(screen.getByTestId('bills-month-total')).toHaveTextContent(t.month.total);

    fireEvent.change(screen.getByRole('combobox', { name: t.list.dueDay('Netflix') }), { target: { value: '16' } });
    expect(useAppStore.getState().bills.dueDays['sub:netflix-com-ca']).toBe(16);
    expect(within(screen.getByTestId('bills-soon-list')).getByText(t.soon.line('Mon', 16, 'Netflix'))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: t.list.reset }));
    expect(useAppStore.getState().bills.dueDays).toEqual({});
    expect(screen.getByRole('button', { name: t.export.button })).toBeEnabled();
  });
});
