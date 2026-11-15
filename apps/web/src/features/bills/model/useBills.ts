// Bills calendar view-model (/tools/bills) and the Home line "Next bill: …" (useNextBill).
//
// Reads the app store: the profile (rent & utilities, debts), the subscription audit kept in this
// browser (tools.subscriptions) and the due days and paydays the user set (bills). The date math is in
// ./calendar (pure, tested); this hook only reads the clock (`opts.now`, else the current time).
import { knownServices } from '@lifeguessr/data/subscriptions';
import { useCallback, useMemo, useState } from 'react';
import { bills as copy } from '@/copy';
import { renewalsFromFindings, type RenewalItem } from '@/lib/ics';
import type { Money } from '@lifeguessr/types';
import { useAppReady, useAppStore, useHydrated } from '@/state';
import { useProfile } from '@/state/profile';
import { usePersistedReady } from '@/features/dashboard/model/persisted';
import { detectFindings, findingItem, planItems } from '@/features/recurring/model/items';
import { useRecurringStore } from '@/features/recurring/model/recurringStore';
import { displayNameOf } from '@/features/subscriptions/model/audit';
import { useLedger } from '@/features/transactions/model/transactionsStore';
import { useAccountsReady, useAccountsStore } from '@/lib/model/accounts';
import { runEngine } from '@/lib/model/errors';
import {
  billsInMonth, daysBetween, dayIndex, dueBeforePayday, dueSoon, monthKey, monthWeeks, nextBill, shiftMonth, splitByToday, sumOf,
  weekday, type BillDef, type BillOccurrence, type CalDate,
} from './calendar';
import { downloadBillsCalendar } from './exportIcs';
import { billsFromRecurring, billsFromSources, paydaysFrom, type RecurringBillSource } from './sources';
import type { BillKindVM, BillsVM, BillVM, CalendarCellVM, ChargeVM, DayVM, ExportOutcomeVM, MonthVM, NextBillVM } from './types';

export const UPLOAD_HREF = '/me/upload';

const KINDS: BillKindVM[] = ['rent', 'debt', 'subscription'];

const labels = { rent: copy.labels.rent, debt: (kind: keyof typeof copy.labels.debt) => copy.labels.debt[kind] };

export function toCalDate(now: Date): CalDate {
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

const isoOf = (d: CalDate): string => `${monthKey(d.year, d.month)}-${String(d.day).padStart(2, '0')}`;
const dayVM = (d: CalDate): DayVM => ({ iso: isoOf(d), day: d.day, weekday: weekday(d) });

/** The audit's renewals with the services' own names; findings the user dismissed are left out. */
function useRenewals(): RenewalItem[] {
  const sub = useAppStore((s) => s.tools.subscriptions);
  return useMemo(() => {
    const findings = sub?.audit?.findings ?? [];
    const dismissed = new Set(sub?.dismissed ?? []);
    const shown = findings.filter((f) => !dismissed.has(f.id)).map((f) => ({ ...f, label: displayNameOf(f, knownServices) }));
    return renewalsFromFindings(shown, { confirmed: new Set(sub?.confirmed ?? []) });
  }, [sub]);
}

/**
 * Every bill we know of: the same items as Recurring (/recurring), so both screens agree. Rent and the
 * accounts' payments from the profile and the Accounts store; the charges the engine's statement detector
 * finds in the person's ledger (Transactions); items marked "not recurring" there are left out. With no
 * statement charge in the ledger, the subscription audit kept by /tools/subscriptions fills the
 * subscriptions instead. `empty` when there is nothing at all. On the sample profile these are the
 * sample's (the sample banner says so).
 */
function useBillDefs(appReady: boolean): {
  ready: boolean; empty: boolean; defs: BillDef[]; userDays: Record<string, number>; takeHome: { value: Money; isEstimate: boolean };
} {
  const profile = useProfile();
  const dueDays = useAppStore((s) => s.bills.dueDays);
  const renewals = useRenewals();
  const { lines, ready: ledgerReady } = useLedger();
  const accountsReady = useAccountsReady();
  const accounts = useAccountsStore((s) => s.accounts);
  const hidden = useRecurringStore((s) => s.notRecurring);
  const hiddenReady = usePersistedReady(useRecurringStore);
  const findings = useMemo(() => {
    const ran = runEngine(() => detectFindings(lines));
    return ran.status === 'ready' ? ran.data : [];
  }, [lines]);
  const defs = useMemo(() => {
    const items: RecurringBillSource[] = [
      ...planItems(profile, accounts).map((item) => ({
        ...item,
        label: item.labelKey === 'rent' ? copy.labels.rent : copy.labels.payment(item.label),
        anchor: null,
      })),
      ...findings.map((f) => {
        const { item, anchor } = findingItem(f);
        return { ...item, label: displayNameOf(f, knownServices), anchor };
      }),
    ].filter((i) => !hidden.includes(i.id));
    const fromLedger = billsFromRecurring(items, dueDays);
    if (findings.length > 0) return fromLedger;
    // No statement charge in the ledger: the subscriptions the audit found (if any).
    const audit = billsFromSources({ profile, renewals, dueDays, labels }).filter((b) => b.kind === 'subscription');
    return [...fromLedger, ...audit];
  }, [profile, accounts, findings, hidden, renewals, dueDays]);
  return {
    ready: appReady && ledgerReady && accountsReady && hiddenReady,
    empty: defs.length === 0,
    defs,
    userDays: dueDays,
    takeHome: profile.takeHomePay,
  };
}

function toBillVM(b: BillDef, userDays: Record<string, number>): BillVM {
  return {
    id: b.id,
    kind: b.kind,
    label: b.label,
    amount: b.amount,
    amountIsEstimate: b.amountIsEstimate,
    cadence: b.cadence,
    dueDay: b.dueDay,
    dueDayIsEstimate: b.dueDayIsEstimate,
    dueDaySetByUser: userDays[b.id] !== undefined,
  };
}

export function useBills(opts: { now?: Date } = {}): BillsVM {
  const { ready, empty, defs, userDays, takeHome } = useBillDefs(useAppReady());
  const savedPaydays = useAppStore((s) => s.bills.paydays);
  const setBillDueDay = useAppStore((s) => s.setBillDueDay);
  const storePaydays = useAppStore((s) => s.setPaydays);
  const [offset, setOffset] = useState(0);
  const [exportOutcome, setExportOutcome] = useState<ExportOutcomeVM | null>(null);
  const nowMs = opts.now?.getTime();
  const today = useMemo(() => toCalDate(nowMs === undefined ? new Date() : new Date(nowMs)), [nowMs]);
  const paydays = useMemo(() => paydaysFrom(savedPaydays), [savedPaydays]);

  const view = useMemo(() => {
    const vms = new Map(defs.map((b) => [b.id, toBillVM(b, userDays)]));
    const charge = (o: BillOccurrence): ChargeVM => ({
      bill: vms.get(o.bill.id)!,
      date: dayVM(o.date),
      isToday: dayIndex(o.date) === dayIndex(today),
      isPast: dayIndex(o.date) < dayIndex(today),
    });
    const ym = shiftMonth(today.year, today.month, offset);
    const inMonth = billsInMonth(defs, ym.year, ym.month);
    const charges = inMonth.map(charge);
    const weeks: CalendarCellVM[][] = monthWeeks(ym.year, ym.month).map((week) =>
      week.map((day) => {
        if (day === null) return { day: null, iso: null, isToday: false, isPast: false, charges: [], total: 0 };
        const date = { year: ym.year, month: ym.month, day };
        const onDay = charges.filter((c) => c.date.day === day);
        return {
          day,
          iso: isoOf(date),
          isToday: dayIndex(date) === dayIndex(today),
          isPast: dayIndex(date) < dayIndex(today),
          charges: onDay,
          total: onDay.reduce((s, c) => s + c.bill.amount, 0),
        };
      }),
    );
    const split = splitByToday(inMonth, today);
    const total = sumOf(inMonth);
    const month: MonthVM = {
      month: monthKey(ym.year, ym.month),
      year: ym.year,
      isCurrent: offset === 0,
      weeks,
      charges,
      total,
      totalIsEstimate: inMonth.some((o) => o.bill.amountIsEstimate),
      paid: { total: sumOf(split.paid), count: split.paid.length },
      toPay: { total: sumOf(split.toPay), count: split.toPay.length },
      byKind: KINDS.map((kind) => {
        const of = inMonth.filter((o) => o.bill.kind === kind);
        return { kind, total: sumOf(of), count: of.length, share: total > 0 ? sumOf(of) / total : 0 };
      }).filter((k) => k.count > 0),
      verdict:
        inMonth.length === 0 ? 'nothing' : offset > 0 ? 'future' : offset < 0 ? 'past' : split.toPay.length > 0 ? 'toPay' : 'clear',
      leftAfter:
        Number.isFinite(takeHome.value) && takeHome.value > 0
          ? { takeHome: takeHome.value, amount: takeHome.value - total, isEstimate: takeHome.isEstimate || inMonth.some((o) => o.bill.amountIsEstimate) }
          : null,
    };
    const soonOcc = dueSoon(defs, today);
    const before = dueBeforePayday(defs, today, paydays.days);
    return {
      month,
      soon: { charges: soonOcc.map(charge), total: sumOf(soonOcc), totalIsEstimate: soonOcc.some((o) => o.bill.amountIsEstimate) },
      beforePayday: before && {
        payday: dayVM(before.payday),
        charges: before.bills.map(charge),
        total: before.total,
        totalIsEstimate: before.totalIsEstimate,
      },
      bills: [...vms.values()],
    };
  }, [defs, userDays, today, offset, paydays, takeHome]);

  const setDueDay = useCallback((id: string, day: number | null) => setBillDueDay(id, day), [setBillDueDay]);
  const setPaydays = useCallback((days: number[]) => storePaydays(days.length > 0 ? days : null), [storePaydays]);

  if (!ready) return { status: 'loading' };
  if (empty) return { status: 'empty', uploadHref: UPLOAD_HREF };
  return {
    status: 'ready',
    today: dayVM(today),
    ...view,
    prevMonth: () => setOffset((o) => o - 1),
    nextMonth: () => setOffset((o) => o + 1),
    thisMonth: () => setOffset(0),
    paydays,
    setPaydays,
    setDueDay,
    exportCalendar: () => setExportOutcome(downloadBillsCalendar(defs, today)),
    exportOutcome,
  };
}

/** S1 Home: the next bill due today or later. Null while loading or when no bill is known. */
export function useNextBill(now?: Date): NextBillVM {
  // The Home screen's own hook already runs the session sync (useAppReady): only wait for saved state here.
  const { ready, empty, defs } = useBillDefs(useHydrated());
  const nowMs = now?.getTime();
  return useMemo(() => {
    if (!ready || empty) return null;
    const today = toCalDate(nowMs === undefined ? new Date() : new Date(nowMs));
    const next = nextBill(defs, today);
    if (!next) return null;
    return { label: next.bill.label, amount: next.bill.amount, inDays: daysBetween(today, next.date), date: dayVM(next.date) };
  }, [ready, empty, defs, nowMs]);
}

