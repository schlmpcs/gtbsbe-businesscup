// @vitest-environment jsdom
// "What is due this month?" end to end in the browser layer: the view-model hook on the real stores (the
// ledger, the accounts, the profile), checked against Recurring so both screens show the same bills, and
// the screen rendered from it.
import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bills as t } from '@/copy';
import { cloneProfileDemo } from '@/fixtures';
import { subscriptionsExpected } from '@/fixtures/tools';
import { FIXTURE_NOW, resetFixtureStores } from '@/features/dashboard/model/resetFixtureStores';
import { useRecurring } from '@/features/recurring/model/useRecurring';
import { markLedgerLoaded, setLedgerStore } from '@/features/transactions/model/transactionsStore';
import { clearAccounts, initAccounts } from '@/lib/model/accounts';
import { memoryRecordStore } from '@/lib/model/idb';
import { createTransactionStore } from '@/lib/model/transactions';
import { useAppStore } from '@/state';
import { waitForReady } from '@/test/clientState';
import { useBills, useNextBill } from './model/useBills';
import type { BillsVM } from './model/types';
import { BillsScreen } from './ui/BillsScreen';

const NOW = FIXTURE_NOW; // Sunday 15 November 2026, noon
const TODAY = '2026-11-15';

const A = ({ href, className, children }: { href: string; className?: string; children?: ReactNode }) => (
  <a href={href} className={className}>
    {children}
  </a>
);

async function emptyLedger() {
  const store = createTransactionStore({ db: memoryRecordStore([]) });
  setLedgerStore(store);
  await store.load();
  markLedgerLoaded(store);
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

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  await resetFixtureStores();
});
afterEach(() => {
  vi.useRealTimers();
  setLedgerStore(null);
});

describe('useBills', () => {
  it('shows the same bills and amounts as Recurring for the month', async () => {
    const r = await ready();
    const rec = renderHook(() => useRecurring({ today: TODAY })).result.current;
    const recurringBills = rec.sections.filter((s) => s.id !== 'income').flatMap((s) => s.items);
    expect(r.current.month.charges).toHaveLength(recurringBills.length);
    expect(r.current.month.total).toBeCloseTo(recurringBills.reduce((s, i) => s + i.amount, 0), 6);
    expect(r.current.month.charges.map((c) => c.bill.amount).sort()).toEqual(recurringBills.map((i) => i.amount).sort());
    const labels = r.current.month.charges.map((c) => `${c.date.day} ${c.bill.label}`);
    expect(labels).toEqual(expect.arrayContaining(['1 Rent & utilities', '20 Credit card payment']));
  });

  it('splits the month into gone out and still to pay, by kind, and against take-home pay', async () => {
    const r = await ready();
    const { month } = r.current;
    expect(month.paid.total + month.toPay.total).toBeCloseTo(month.total, 6);
    expect(month.paid.count + month.toPay.count).toBe(month.charges.length);
    // Rent on the 1st has gone out; the card and the auto loan on the 20th are still to pay.
    expect(month.charges.find((c) => c.bill.id === 'rent')!.isPast).toBe(true);
    expect(month.toPay.total).toBeGreaterThanOrEqual(193.92 + 412);
    expect(month.verdict).toBe('toPay');
    expect(month.byKind.reduce((s, k) => s + k.share, 0)).toBeCloseTo(1, 6);
    expect(month.byKind.map((k) => k.kind)).toEqual(['rent', 'debt', 'subscription']);
    expect(month.leftAfter).toMatchObject({ takeHome: 5200, amount: 5200 - month.total });
    act(() => r.current.prevMonth());
    expect(r.current.month.verdict).toBe('past');
    expect(r.current.month.toPay.count).toBe(0);
  });

  it('is empty with no bill at all, and points to the statement upload', async () => {
    const profile = cloneProfileDemo();
    profile.spending.rentUtilities = { value: 0, isEstimate: false };
    profile.debts = [];
    useAppStore.setState({ profile });
    clearAccounts();
    initAccounts();
    await emptyLedger();
    const { result } = renderHook(() => useBills({ now: NOW }));
    await waitForReady(result);
    expect(result.current).toEqual({ status: 'empty', uploadHref: '/me/upload' });
  });

  it('with no statement charge in the ledger, takes the subscriptions the audit found', async () => {
    await emptyLedger();
    seedAudit();
    const r = await ready();
    const subs = r.current.bills.filter((b) => b.kind === 'subscription').map((b) => b.label);
    expect(subs).toContain('Netflix');
    // Apple was dismissed in the audit: not a bill.
    expect(subs).not.toContain('Apple');
  });

  it('a due day the user sets is saved, moves the bill and is no longer an estimate', async () => {
    const r = await ready();
    expect(r.current.bills.find((b) => b.id === 'rent')).toMatchObject({ dueDay: 1, dueDayIsEstimate: true, dueDaySetByUser: false });
    act(() => r.current.setDueDay('rent', 15));
    expect(r.current.bills.find((b) => b.id === 'rent')).toMatchObject({ dueDay: 15, dueDayIsEstimate: false, dueDaySetByUser: true });
    expect(r.current.soon.charges[0]!.bill.id).toBe('rent');
    expect(r.current.soon.charges[0]!.isToday).toBe(true);
    expect(useAppStore.getState().bills.dueDays).toEqual({ rent: 15 });
    act(() => r.current.setPaydays([25]));
    expect(r.current.paydays).toEqual({ days: [25], isEstimate: false });
    expect(r.current.beforePayday!.charges.map((c) => c.bill.id)).toContain('rent');
  });

  it('moves between months; a due day of 31 lands on the last day of February', async () => {
    const r = await ready();
    act(() => r.current.setDueDay('rent', 31));
    act(() => r.current.nextMonth());
    act(() => r.current.nextMonth());
    act(() => r.current.nextMonth());
    expect(r.current.month.month).toBe('2027-02');
    expect(r.current.month.isCurrent).toBe(false);
    expect(r.current.month.verdict).toBe('future');
    expect(r.current.month.charges.find((c) => c.bill.id === 'rent')!.date.day).toBe(28);
    act(() => r.current.thisMonth());
    expect(r.current.month.month).toBe('2026-11');
    expect(r.current.month.charges.find((c) => c.bill.id === 'rent')!.date.day).toBe(30);
  });
});

describe('useNextBill', () => {
  it('the next charge and how many days away', async () => {
    const { result } = renderHook(() => useNextBill(NOW));
    await act(async () => {});
    expect(result.current).not.toBeNull();
    expect(result.current!.inDays).toBeGreaterThanOrEqual(0);
  });
});

describe('BillsScreen', () => {
  function Connected() {
    return <BillsScreen vm={useBills({ now: NOW })} Link={A} />;
  }

  it('answers first, then the grid, the next 7 days and an inline due-day edit', async () => {
    render(<Connected />);
    const grid = await screen.findByRole('table', { name: t.month.gridLabel('November 2026') });
    expect(within(grid).getAllByRole('columnheader')).toHaveLength(7);
    expect(screen.getAllByTestId('bills-day').length).toBeGreaterThan(3);
    expect(screen.getByTestId('bills-verdict')).toHaveTextContent('still to pay this month');
    expect(screen.getByTestId('bills-kpis')).toHaveTextContent(t.kpi.due);
    expect(screen.getByTestId('bills-split')).toBeInTheDocument();
    const soon = screen.getByTestId('bills-soon-list');
    expect(within(soon).getByText(t.soon.line('Fri', 20, 'Credit card payment'))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t.recurringLink })).toHaveAttribute('href', '/recurring');

    fireEvent.change(screen.getByRole('combobox', { name: t.list.dueDay('Rent & utilities') }), { target: { value: '16' } });
    expect(useAppStore.getState().bills.dueDays.rent).toBe(16);
    expect(within(screen.getByTestId('bills-soon-list')).getByText(t.soon.line('Mon', 16, 'Rent & utilities'))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: t.list.reset }));
    expect(useAppStore.getState().bills.dueDays).toEqual({});
    expect(screen.getByRole('button', { name: t.export.button })).toBeEnabled();
  });
});
