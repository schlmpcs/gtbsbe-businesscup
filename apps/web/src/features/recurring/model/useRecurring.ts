// View-model of the Recurring screen (MP11, #171). Fixture-backed: recurring charges come from the
// engine's `detectSubscriptions` over the in-memory ledger (the audit behind /tools/subscriptions);
// income, rent and the accounts' payments from the demo profile and accounts. No network.
// MP11b: the real ledger and accounts stores, and the person's profile instead of the demo one.
// The existing /tools/subscriptions model stays where it is (MP14 moves the route); only its engine
// call and the bills calendar's date helpers are reused.
import { addMonths } from '@lifeguessr/engine';
import { useCallback, useMemo, useState } from 'react';
import { profileDemo } from '@/fixtures';
import { dueDateIn, monthWeeks } from '@/features/bills/model/calendar';
import { useAccountsStore } from '@/features/accounts/model/accountsStore';
import { useTransactionsStore } from '@/features/transactions/model/transactionsStore';
import { usEasternDate } from '@/lib/dates';
import { runEngine } from '@/lib/model/errors';
import { formatMonthYear } from '@/lib/format';
import { detectFindings, findingItem, occursIn, planItems, type RecurringSource } from './items';
import { useRecurringStore } from './recurringStore';
import type { RecurringCalendarCellVM, RecurringItemVM, RecurringSectionId, RecurringSectionVM, RecurringVM } from './types';

const SECTIONS: RecurringSectionId[] = ['income', 'expenses', 'creditCards'];
const byDay = (a: RecurringItemVM, b: RecurringItemVM): number => (a.dayOfMonth ?? 0) - (b.dayOfMonth ?? 0) || (a.id < b.id ? -1 : 1);

export function useRecurring({ today: todayArg }: { today?: string } = {}): RecurringVM {
  const today = todayArg ?? usEasternDate();
  const todayMonth = today.slice(0, 7);
  const transactions = useTransactionsStore((s) => s.transactions);
  const accounts = useAccountsStore((s) => s.accounts);
  const hidden = useRecurringStore((s) => s.notRecurring);
  const [month, setMonth] = useState(todayMonth);

  const detected = useMemo(() => runEngine(() => detectFindings(transactions)), [transactions]);
  const sources = useMemo<RecurringSource[]>(() => {
    const found = detected.status === 'ready' ? detected.data.map(findingItem) : [];
    const planned = planItems(profileDemo, accounts).map((item): RecurringSource => ({ item, anchor: null }));
    return [...planned, ...found].filter((s) => !hidden.includes(s.item.id));
  }, [detected, accounts, hidden]);

  const inMonth = useMemo(() => sources.filter((s) => occursIn(s, month)).map((s) => s.item), [sources, month]);
  const sections = useMemo<RecurringSectionVM[]>(
    () =>
      SECTIONS.map((id) => {
        const items = inMonth.filter((i) => i.section === id).sort(byDay);
        return { id, items, total: items.reduce((sum, i) => sum + i.amount, 0) };
      }),
    [inMonth],
  );

  const calendar = useMemo(() => {
    const year = Number(month.slice(0, 4));
    const m = Number(month.slice(5, 7));
    const weeks = monthWeeks(year, m).map((week) =>
      week.map((day): RecurringCalendarCellVM => {
        if (day === null) return { day: null, iso: null, isToday: false, items: [] };
        const iso = `${month}-${String(day).padStart(2, '0')}`;
        // A due day the month does not have (the 31st in April) moves to the month's last day.
        const items = inMonth.filter((i) => i.dayOfMonth !== null && dueDateIn(i.dayOfMonth, year, m).day === day).sort(byDay);
        return { day, iso, isToday: iso === today, items };
      }),
    );
    return { weeks };
  }, [inMonth, month, today]);

  const markNotRecurring = useCallback((id: string) => useRecurringStore.getState().markNotRecurring(id), []);
  const prev = useCallback(() => setMonth((m) => addMonths(m, -1)), []);
  const next = useCallback(() => setMonth((m) => addMonths(m, 1)), []);
  const goToday = useCallback(() => setMonth(todayMonth), [todayMonth]);

  return {
    ready: true,
    month,
    monthLabel: formatMonthYear(month),
    isCurrent: month === todayMonth,
    sections,
    calendar,
    // Pay alone is not "something recurring": the person has no statement charge and no account payment.
    empty: sources.every((s) => s.item.origin === 'profile'),
    error: detected.status === 'error' ? detected.error : null,
    markNotRecurring,
    prev,
    next,
    today: goToday,
  };
}
