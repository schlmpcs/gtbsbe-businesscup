// Bills calendar view-model (/tools/bills) and the Home line "Next bill: …" (useNextBill).
//
// Reads the app store: the profile (rent & utilities, debts), the subscription audit kept in this
// browser (tools.subscriptions) and the due days and paydays the user set (bills). The date math is in
// ./calendar (pure, tested); this hook only reads the clock (`opts.now`, else the current time).
import { knownServices } from '@lifeguessr/data/subscriptions';
import { useCallback, useMemo, useState } from 'react';
import { bills as copy } from '@/copy';
import { renewalsFromFindings, type RenewalItem } from '@/lib/ics';
import { isSampleActive, useAppReady, useAppStore, useHydrated } from '@/state';
import { displayNameOf } from '@/features/subscriptions/model/audit';
import {
  billsInMonth, daysBetween, dayIndex, dueBeforePayday, dueSoon, monthKey, monthWeeks, nextBill, shiftMonth, sumOf,
  weekday, type BillDef, type BillOccurrence, type CalDate,
} from './calendar';
import { downloadBillsCalendar } from './exportIcs';
import { billsFromSources, paydaysFrom } from './sources';
import type { BillsVM, BillVM, CalendarCellVM, ChargeVM, DayVM, ExportOutcomeVM, MonthVM, NextBillVM } from './types';

export const UPLOAD_HREF = '/me/upload';

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
 * Every bill we know of, or `empty` when nothing of the user's is known yet: the profile is still the
 * starting one (and the sample life is not on) and no statement found a subscription.
 */
function useBillDefs(ready: boolean): { ready: boolean; empty: boolean; defs: BillDef[]; userDays: Record<string, number> } {
  const profile = useAppStore((s) => s.profile);
  const profileOrigin = useAppStore((s) => s.profileOrigin);
  const sample = useAppStore(isSampleActive);
  const dueDays = useAppStore((s) => s.bills.dueDays);
  const renewals = useRenewals();
  const ownProfile = profileOrigin !== 'demo' || sample;
  const defs = useMemo(
    () => billsFromSources({ profile, renewals, dueDays, labels }).filter((b) => ownProfile || b.kind === 'subscription'),
    [profile, renewals, dueDays, ownProfile],
  );
  return { ready, empty: defs.length === 0, defs, userDays: dueDays };
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
  const { ready, empty, defs, userDays } = useBillDefs(useAppReady());
  const savedPaydays = useAppStore((s) => s.bills.paydays);
  const setBillDueDay = useAppStore((s) => s.setBillDueDay);
  const storePaydays = useAppStore((s) => s.setPaydays);
  const loadSample = useAppStore((s) => s.loadSample);
  const isDemoProfile = useAppStore((s) => s.profileOrigin) === 'demo';
  // The sample life's rent and loans (the same "Try with sample data" the other screens offer); only while the profile is still the demo.
  const trySample = useCallback(() => {
    loadSample();
  }, [loadSample]);
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
    });
    const ym = shiftMonth(today.year, today.month, offset);
    const inMonth = billsInMonth(defs, ym.year, ym.month);
    const charges = inMonth.map(charge);
    const weeks: CalendarCellVM[][] = monthWeeks(ym.year, ym.month).map((week) =>
      week.map((day) => {
        if (day === null) return { day: null, iso: null, isToday: false, charges: [], total: 0 };
        const date = { year: ym.year, month: ym.month, day };
        const onDay = charges.filter((c) => c.date.day === day);
        return {
          day,
          iso: isoOf(date),
          isToday: dayIndex(date) === dayIndex(today),
          charges: onDay,
          total: onDay.reduce((s, c) => s + c.bill.amount, 0),
        };
      }),
    );
    const month: MonthVM = {
      month: monthKey(ym.year, ym.month),
      year: ym.year,
      isCurrent: offset === 0,
      weeks,
      charges,
      total: sumOf(inMonth),
      totalIsEstimate: inMonth.some((o) => o.bill.amountIsEstimate),
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
  }, [defs, userDays, today, offset, paydays]);

  const setDueDay = useCallback((id: string, day: number | null) => setBillDueDay(id, day), [setBillDueDay]);
  const setPaydays = useCallback((days: number[]) => storePaydays(days.length > 0 ? days : null), [storePaydays]);

  if (!ready) return { status: 'loading' };
  if (empty) return { status: 'empty', uploadHref: UPLOAD_HREF, trySample: isDemoProfile ? trySample : null };
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

